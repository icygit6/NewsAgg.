import unittest
from core.nlp import reading_metrics

class ReadabilityTests(unittest.TestCase):
    def test_chinese_and_unsupported_language_are_not_zero_grades(self):
        for text, language in [('今天公布了最新的研究結果。' * 10, 'zh-TW'), ('Ini berita tentang penelitian baru.', 'id')]:
            result = reading_metrics(text, language)
            self.assertIsNone(result['flesch_score'])
            self.assertIsNone(result['flesch_kincaid'])
            self.assertIsNone(result['smog_index'])
    def test_short_english_has_flesch_but_no_unsupported_smog(self):
        result = reading_metrics('The cat sat on the mat. The dog ran away.', 'en')
        self.assertIsInstance(result['flesch_score'], float)
        self.assertIsNotNone(result['flesch_kincaid'])
        self.assertIsNone(result['smog_index'])
    def test_long_english_has_smog(self):
        result = reading_metrics('Researchers conducted comprehensive investigations into environmental conservation. ' * 35, 'en')
        self.assertGreater(result['smog_index'], 0)
    def test_empty_text_has_no_grade(self):
        self.assertIsNone(reading_metrics('', 'en')['flesch_score'])
