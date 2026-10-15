// Node test reporter: publish names/status only, never captured test payloads.
export default async function* (events) {
  const cases = [];
  for await (const event of events) {
    if (['test:pass', 'test:fail'].includes(event.type) && event.data.details?.type !== 'suite') {
      cases.push({ name: event.data.name, status: event.data.skip ? 'skipped' : event.type === 'test:pass' ? 'passed' : 'failed' });
    }
  }
  yield JSON.stringify({ cases, passed: cases.filter(c => c.status === 'passed').length, failed: cases.filter(c => c.status === 'failed').length, skipped: cases.filter(c => c.status === 'skipped').length });
}
