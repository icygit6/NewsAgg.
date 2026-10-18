import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { EvaluationPanel } from './EvaluationPanel';
import data from '../../data/evaluation.json';

const state = vi.hoisted(() => ({ language: 'en', isDark: false }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => state }));
beforeEach(() => { state.language = 'en'; state.isDark = false; });
afterEach(cleanup);
const mount = () => render(<MemoryRouter><EvaluationPanel /></MemoryRouter>);

describe('public research evidence', () => {
  it('recomputes every public confusion matrix and preserves class-denominator rules', () => {
    const groups = [
      ...data.references.flatMap(r => Object.values(r.tasks).flatMap(m => [m, ...Object.values(m.bySource), ...Object.values(m.byLanguage)])),
      ...data.pairs.flatMap(p => Object.values(p.tasks)),
    ];
    expect(groups).toHaveLength(114);
    for (const m of groups) {
      expect(m.matrix.flat().reduce((a, b) => a + b, 0)).toBe(m.n);
      expect(m.matrix.reduce((a, row, i) => a + row[i], 0)).toBe(m.matches);
      const f1s = m.matrix.map((row, i) => {
        const rows = row.reduce((a, b) => a + b, 0);
        const cols = m.matrix.reduce((a, r) => a + r[i], 0);
        return rows + cols ? 2 * row[i] / (rows + cols) : 0;
      });
      expect(f1s.reduce((a, b) => a + b, 0) / m.labels.length).toBeCloseTo(m.macroF1, 12);
      expect(m.matches / m.n).toBeCloseTo(m.agreement, 12);
    }
  });
  it('exports only aggregate evidence and retains unresolved gold status', () => {
    expect(data.finalAccuracy).toBeNull();
    expect(data.humanDisagreementUnion).toBe(93);
    expect(data.references.filter(r => r.kind === 'human')).toHaveLength(4);
    expect(data.pairs).toHaveLength(15);
    expect(JSON.stringify(data)).not.toMatch(/01257\d{3}|@|rationale|coordinator_only|article_id/);
  });
  it('switches task and reference together in matrices and worked calculations', () => {
    mount();
    fireEvent.click(within(screen.getByRole('group', { name: 'Reference for details' })).getByRole('button', { name: 'Human D' }));
    const matrix = screen.getByRole('table', { name: 'Human D → NewsAgg' });
    expect(within(matrix).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('68/120')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Task' })).getByRole('button', { name: 'Topic · 8 classes' }));
    expect(within(screen.getByRole('table', { name: 'Human D → NewsAgg' })).getAllByRole('row')).toHaveLength(9);
    expect(screen.getByText('91/120')).toBeInTheDocument();
    expect(screen.getByText(/Macro F1 = .* = 0.7478/)).toBeInTheDocument();
  });
  it('shows all reference pairs and keeps them distinct from system comparisons', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Human & AI comparisons' }));
    expect(within(screen.getByRole('table', { name: 'Pairwise reference comparisons' })).getAllByRole('row')).toHaveLength(16);
    expect(screen.queryByRole('table', { name: 'System-to-reference scores' })).not.toBeInTheDocument();
  });
  it('renders Chinese controls, definitions and source-language detail without translation calls', () => {
    state.language = 'zhTW'; state.isDark = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mount();
    expect(screen.getByRole('heading', { name: '分析背後的數據' })).toBeInTheDocument();
    expect(screen.getByLabelText('評估任務')).toBeInTheDocument();
    expect(screen.getByText(/Macro F1 是各類 F1 的平均值/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '模型與計算' }));
    expect(screen.getByText(/^閱讀難度估計/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it('shows actual test records and explicitly states unmeasured outcomes', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Verification' }));
    expect(screen.getByRole('table', { name: 'Verification ledger' })).toBeInTheDocument();
    expect(screen.getByText('What has not been measured')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download test results JSON' })).toHaveAttribute('download');
  });
  it('explains names and matches the revised 24 report references with relevance disclosures', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Glossary & references' }));
    expect(screen.getByText('F1 / macro F1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Automated Text Classification of News Articles: A Practical Guide' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A coefficient of agreement for nominal scales' })).toHaveAttribute('href', 'https://doi.org/10.1177/001316446002000104');
    expect(screen.getByText(/^\[24\]/)).toBeInTheDocument();
    expect(screen.queryByText(/^\[25\]/)).not.toBeInTheDocument();
    expect(screen.getByText(/NewsAgg implements BM25 itself, not with Lucene/)).toBeInTheDocument();
  });
});
