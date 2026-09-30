import unittest
from unittest.mock import patch
from core.nlp import run_toxicity


class ToxicityTests(unittest.TestCase):
    def test_non_english_and_empty_are_missing_not_zero(self):
        with patch('core.nlp._toxicity') as model:
            for text, lang in [('中文新聞', 'zh-TW'), ('', 'en')]:
                self.assertEqual(run_toxicity(text, lang), {'label': None, 'score': None})
            model.assert_not_called()

    def test_model_failure_is_missing_not_non_toxic(self):
        with patch('core.nlp._toxicity', side_effect=RuntimeError('unavailable')):
            self.assertEqual(run_toxicity('English news', 'en'), {'label': None, 'score': None})

    def test_uses_toxic_probability_not_the_highest_other_label(self):
        with patch('core.nlp._toxicity') as model:
            model.return_value.return_value = [{'label': 'insult', 'score': .8}, {'label': 'toxic', 'score': .02}]
            self.assertEqual(run_toxicity('English news', 'en-US'), {'label': 'non-toxic', 'score': .02})
            model.return_value.assert_called_once_with('English news', top_k=None)

    def test_real_zero_is_retained(self):
        with patch('core.nlp._toxicity') as model:
            model.return_value.return_value = [[{'label': 'toxic', 'score': 0.0}]]
            self.assertEqual(run_toxicity('English news'), {'label': 'non-toxic', 'score': 0.0})
