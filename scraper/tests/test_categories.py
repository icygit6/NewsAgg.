import unittest
import sys
from types import SimpleNamespace
from unittest.mock import patch
from core import nlp

class CategoryTests(unittest.TestCase):
    @patch('core.nlp._classifier')
    @patch('core.category.second_opinion', return_value={'category':'Lifestyle','model':'test'})
    def test_gaming_personal_anecdote_cannot_pass_science_on_local_confidence(self, opinion, factory):
        factory.return_value.return_value={'labels':['Science','Lifestyle'],'scores':[.93,.04]}
        item={'title_hint':'G胖超愛唱歌？《CS》之父爆料辦公室連唱5個月', 'topic':'Science'}
        self.assertEqual(nlp.zero_shot_filter([item]),[])
        self.assertEqual(item['rejection'],'category_mismatch')
        opinion.assert_called_once()

    @patch('core.nlp._classifier')
    @patch('core.category.second_opinion', return_value=None)
    def test_near_tie_is_not_treated_as_verified_even_above_threshold(self, _, factory):
        factory.return_value.return_value={'labels':['Science','Lifestyle'],'scores':[.45,.43]}
        item={'title_hint':'A long headline with ambiguous reporting focus', 'topic':'Science'}
        self.assertEqual(nlp.zero_shot_filter([item]),[])

    @patch('core.nlp._classifier')
    def test_descriptive_labels_are_mapped_back_to_live_topic_names(self, factory):
        from core.taxonomy import LOCAL_LABELS
        factory.return_value.return_value={'labels':[LOCAL_LABELS['Science'],LOCAL_LABELS['World']],'scores':[.8,.1]}
        item={'title_hint':'Researchers discover a new method for quantum computing', 'topic':'Science'}
        self.assertEqual(nlp.zero_shot_filter([item])[0]['ai_top_label'],'Science')
        self.assertIn('science and technology',factory.return_value.call_args.kwargs['candidate_labels'][6])

    def test_classification_context_covers_end_and_stays_bounded(self):
        from core.taxonomy import classification_context
        context=classification_context('OPENING'+('a'*2000)+'MIDDLE'+('b'*2000)+'ENDING')
        self.assertTrue(context.startswith('OPENING'))
        self.assertIn('MIDDLE',context);self.assertTrue(context.endswith('ENDING'))
        self.assertLessEqual(len(context),1800)

    def test_source_budget_does_not_exhaust_other_publishers(self):
        from core import category
        response=SimpleNamespace(raise_for_status=lambda:None, json=lambda:{'choices':[{'finish_reason':'stop','message':{'content':'{"category":"Science"}'}}]})
        with patch.dict('os.environ', {'GROQ_API_KEY':'test'}), patch.object(category,'_calls',3), patch.object(category,'_retry_after',0), patch.object(category,'_calls_by_topic',{'Science':3}), patch.object(category,'_calls_by_source_topic',{('bbc','Science'):3}), patch.object(category,'_cache',{}), patch.object(category.requests,'post',return_value=response) as send:
            diagnostic={}
            self.assertIsNone(category.second_opinion('First title','x',requested_topic='Science',source='bbc',diagnostic=diagnostic))
            self.assertEqual(diagnostic['reason'],'budget')
            self.assertEqual(category.second_opinion('Second title','y',requested_topic='Science',source='cnn')['category'],'Science')
            send.assert_called_once()

    def test_api_budget_is_reserved_per_category_and_successes_are_cached(self):
        from core import category
        response=SimpleNamespace(raise_for_status=lambda:None, json=lambda:{'choices':[{'finish_reason':'stop','message':{'content':'{"category":"Science"}'}}]})
        with patch.dict('os.environ', {'GROQ_API_KEY':'test'}), patch.object(category,'_calls',12), patch.object(category,'_retry_after',0), patch.object(category,'_calls_by_topic',{'Climate':12}), patch.object(category,'_cache',{}), patch.object(category.requests,'post',return_value=response) as send:
            self.assertIsNone(category.second_opinion('Climate headline','x',requested_topic='Climate'))
            self.assertEqual(category.second_opinion('Science headline','y',requested_topic='Science')['category'],'Science')
            self.assertEqual(category.second_opinion('Science headline','y',requested_topic='Business')['category'],'Science')
            send.assert_called_once()

    @patch('core.nlp._classifier')
    @patch('core.category.second_opinion')
    def test_clear_competing_category_does_not_spend_hosted_budget(self, opinion, factory):
        factory.return_value.return_value={'labels':['Politics','Science'],'scores':[.92,.02]}
        item={'title_hint':'Election results show a clear political winner', 'topic':'Science'}
        self.assertEqual(nlp.zero_shot_filter([item]),[])
        self.assertEqual(item['rejection'],'category_mismatch')
        opinion.assert_not_called()

    def test_deberta_always_uses_supported_fp32(self):
        with patch.dict(sys.modules, {'transformers':SimpleNamespace(pipeline=lambda *a,**kw:kw), 'torch':SimpleNamespace(float32='fp32')}), patch('core.nlp.device', return_value=-1):
            nlp._classifier.cache_clear()
            try:
                self.assertEqual(nlp._classifier()['dtype'], 'fp32')
            finally:
                nlp._classifier.cache_clear()
    @patch('core.nlp._classifier')
    @patch('core.category.second_opinion', return_value=None)
    def test_rejects_shared_feed_cross_category_and_ambiguous_results(self, _, factory):
        factory.return_value.return_value = [
            {'labels': ['Science', 'Climate'], 'scores': [.48, .12]},
            {'labels': ['Climate', 'Science'], 'scores': [.3, .29]},
            {'labels': ['Climate', 'Science'], 'scores': [.75, .1]},
        ]
        candidates = [{'title_hint': title, 'topic': 'Climate'} for title in
                      ['Government appoints artificial intelligence chief', 'An ambiguous news headline for classification', 'Glaciers melt as global temperatures rise']]
        result = nlp.zero_shot_filter(candidates)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['ai_top_label'], 'Climate')

    @patch('core.nlp._classifier')
    @patch('core.category.second_opinion', return_value={'category':'Business','model':'test-model'})
    def test_second_opinion_never_invents_a_confidence_score(self, _, factory):
        factory.return_value.return_value = {'labels':['World','Business'],'scores':[.32,.25]}
        result = nlp.zero_shot_filter([{'title_hint':'Warren Buffett steps down as chairman', 'topic':'Business'}])
        self.assertEqual(result[0]['category_model'], 'test-model')
        self.assertIsNone(result[0]['ai_relevance_score'])
        self.assertEqual(result[0]['ai_label_scores'], {})

    @patch('core.nlp._classifier', side_effect=RuntimeError('offline'))
    def test_model_outage_does_not_mark_category_verified(self, _):
        self.assertEqual(nlp.zero_shot_filter([{'title_hint': 'A sufficiently long headline', 'topic': 'Science'}]), [])
