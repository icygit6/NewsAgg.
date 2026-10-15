"""Offline unittest receipt; called by record-verification.mjs."""
import contextlib
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.getcwd())
cases = []

class Result(unittest.TextTestResult):
    def addSuccess(self, test):
        super().addSuccess(test)
        cases.append({'name': test.id(), 'status': 'passed'})

    def addFailure(self, test, err):
        super().addFailure(test, err)
        cases.append({'name': test.id(), 'status': 'failed'})

    def addError(self, test, err):
        super().addError(test, err)
        cases.append({'name': test.id(), 'status': 'failed'})

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        cases.append({'name': test.id(), 'status': 'skipped'})

with contextlib.redirect_stdout(io.StringIO()):
    suite = unittest.defaultTestLoader.discover(sys.argv[1], pattern=sys.argv[2])
    result = unittest.TextTestRunner(stream=io.StringIO(), resultclass=Result).run(suite)
print(json.dumps({'cases': cases, 'passed': sum(c['status'] == 'passed' for c in cases), 'failed': len(result.failures) + len(result.errors), 'skipped': len(result.skipped)}))
sys.exit(0 if result.wasSuccessful() else 1)
