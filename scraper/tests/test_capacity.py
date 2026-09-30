import unittest
from types import SimpleNamespace
from unittest.mock import patch
import run_all
from core import config

class CapacityTests(unittest.TestCase):
    def test_capacity_guard_stops_before_more_enrichment_without_deleting_data(self):
        statements = []
        class Cursor:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def execute(self, sql, *args): self.sql = sql; statements.append(sql)
            def fetchone(self):
                return (config.STORAGE_BUDGET_BYTES,) if 'pg_database_size' in self.sql else (1,)
            def fetchall(self): return []
        class Conn:
            def cursor(self): return Cursor()
            def commit(self): pass
            def close(self): pass
        spec = SimpleNamespace(key='test', target_per_category=15, categories={'Science': []})
        args = SimpleNamespace(refresh_existing=False, target=15, report_path=None)
        report = {'articleIds': [], 'errors': 0}
        with patch.object(run_all.db, 'connect', return_value=Conn()), \
             patch.object(run_all.db, 'existing_canonicals', return_value=set()), \
             patch.object(run_all, 'all_specs', return_value=[spec]), \
             patch.object(run_all, 'run_source') as enrich:
            run_all.scrape(args, True, report, Conn())
        enrich.assert_not_called()
        self.assertEqual(report['counts']['storage_budget_reached'], 1)
        self.assertEqual(report['status'], 'partial')
        self.assertFalse(any('DELETE' in sql.upper() for sql in statements))
