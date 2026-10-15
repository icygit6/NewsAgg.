import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from core.pipeline import SourceSpec
import run_all


class RunReportTests(unittest.TestCase):
    def test_forty_quota_rotates_five_row_topups_and_preserves_discovery_scope(self):
        specs=[SourceSpec(key=k,name=k,categories={'World':['https://example.com/world']},target_per_category=40) for k in ['a','b']]
        calls=[];serial=0
        def source(spec, **kwargs):
            nonlocal serial
            calls.append((spec.key,spec.target_per_category,kwargs['discovery_target']))
            records=[]
            for _ in range(spec.target_per_category):
                serial+=1;records.append({'id':str(serial),'source':{'id':spec.key},'topic':'World','sentiment':{'type':'neutral'}})
            return records
        report={};args=SimpleNamespace(refresh_existing=False,target=40,report_path=None)
        with patch.object(run_all,'all_specs',return_value=specs),patch.object(run_all,'run_source',side_effect=source):
            run_all.scrape(args,False,report,None)
        self.assertEqual(calls[:2],[('a',2,40),('b',2,40)])
        self.assertTrue(all(n<=5 and discovery==40 for _,n,discovery in calls[2:]))
        self.assertEqual([k for k,_,_ in calls], ['a','b']*9)
        self.assertEqual(len(report['articleIds']),80)
        self.assertEqual(report['status'],'complete')

    def test_exhausted_pair_stops_without_lowering_other_pair_target(self):
        specs=[SourceSpec(key=k,name=k,categories={'World':['https://example.com/world']},target_per_category=40) for k in ['a','b']]
        calls=[];serial=0
        def source(spec,**kwargs):
            nonlocal serial
            calls.append(spec.key)
            n=spec.target_per_category if spec.key=='b' else 0
            records=[]
            for _ in range(n):
                serial+=1;records.append({'id':str(serial),'source':{'id':spec.key},'topic':'World','sentiment':{'type':'neutral'}})
            return records
        report={};args=SimpleNamespace(refresh_existing=False,target=40,report_path=None)
        with patch.object(run_all,'all_specs',return_value=specs),patch.object(run_all,'run_source',side_effect=source):
            run_all.scrape(args,False,report,None)
        self.assertEqual(calls.count('a'),2)
        self.assertEqual(report['counts']['deficit_a_World'],40)
        self.assertEqual(report['counts']['deficit_b_World'],0)
        self.assertEqual(report['status'],'partial')
        self.assertEqual(len(report['articleIds']),40)

    def test_all_categories_get_first_pass_before_any_quota_top_up(self):
        specs=[SourceSpec(key='test',name='Test',categories={'Science':['https://example.com/science'],'World':['https://example.com/world']},target_per_category=3)]
        calls=[]
        def source(spec, **kwargs):
            topic=next(iter(spec.categories))
            calls.append((topic,spec.target_per_category,kwargs['candidate_limit']))
            return [{'id':f'{topic}-{len(calls)}-{n}','source':{'id':'test'},'topic':topic,'sentiment':{'type':'neutral'}} for n in range(spec.target_per_category)]
        report={}
        args=SimpleNamespace(refresh_existing=False,target=3,report_path=None)
        with patch.object(run_all,'all_specs',return_value=specs),patch.object(run_all,'run_source',side_effect=source):
            run_all.scrape(args,False,report,None)
        self.assertEqual(calls,[('Science',2,12),('World',2,12),('Science',1,None),('World',1,None)])
        self.assertEqual(report['counts']['deficit_test_Science'],0)
        self.assertEqual(report['counts']['deficit_test_World'],0)
        self.assertEqual(len(report['articleIds']),6)

    def test_manifest_is_atomic_and_matches_requested_run(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / 'report.json'
            with patch('sys.argv', ['run_all.py', '--no-db', '--run-key', 'test-run', '--report-path', str(report)]), patch.object(run_all, 'all_specs', return_value=[]):
                run_all.main()
            result = json.loads(report.read_text())
            self.assertEqual(result['runKey'], 'test-run')
            self.assertEqual(result['status'], 'complete')
            self.assertIsNotNone(result['finishedAt'])
            self.assertEqual(result['articleIds'], [])
            self.assertFalse(report.with_suffix('.tmp').exists())

    def test_interrupted_scraper_records_failure_and_exits_nonzero(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / 'report.json'
            with patch('sys.argv', ['run_all.py', '--no-db', '--report-path', str(report)]), patch.object(run_all, 'execute', side_effect=KeyboardInterrupt('timeout')):
                with self.assertRaises(SystemExit) as result:
                    run_all.main()
            self.assertEqual(result.exception.code, 1)
            payload = json.loads(report.read_text())
            self.assertEqual(payload['status'], 'failed')
            self.assertEqual(payload['errors'], 1)
            self.assertIsNotNone(payload['finishedAt'])

    def test_bad_age_argument_is_rejected(self):
        with patch('sys.argv', ['run_all.py', '--no-db', '--max-age-hours', '0']):
            with self.assertRaises(SystemExit) as result:
                run_all.main()
            self.assertEqual(result.exception.code, 2)
