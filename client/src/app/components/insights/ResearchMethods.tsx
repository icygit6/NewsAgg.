import { useUiText } from '../../i18n/uiText';
import { EvidenceTable, type EvidenceText } from './EvaluationPanel';

export function ResearchMethods({ tx }: { tx: EvidenceText }) {
  const ui = useUiText();
  const models = [
    ['cardiffnlp/twitter-xlm-roberta-base-sentiment', ui('General sentiment'), ui('Multilingual XLM-R scores positive, neutral and negative wording. Used for non-English business articles too; training-domain performance is not NewsAgg accuracy.')],
    ['ProsusAI/finbert', ui('Financial sentiment'), ui('English Business only. FinBERT is BERT adapted to financial language; other languages use the general model.')],
    ['MoritzLaurer/mDeBERTa-v3-base-mnli-xnli', ui('Topic confirmation'), ui('Natural language inference (NLI) compares article text with eight topic descriptions without training a new NewsAgg classifier. Score ≥ 0.38 and lead ≥ 0.12 are project thresholds, not measured accuracy.')],
    ['BAAI/bge-m3', ui('Semantic embeddings'), ui('Maps text to 1,024 numbers for similarity, extractive sentence selection and article-passage retrieval. BGE-M3 is a multilingual embedding model; an embedding is not a generated answer.')],
    ['Davlan/xlm-roberta-base-ner-hrl', tx('Named entities', '命名實體'), ui('Named entity recognition (NER) extracts people, organizations and places. No manually scored NewsAgg NER benchmark is available in this evaluation.')],
    ['unitary/toxic-bert', ui('Toxicity'), ui('English only; unsupported languages return missing values. A toxicity score estimates harmful language, not factual reliability.')],
  ];
  return <div className="evidence-body evidence-methods">
    <div className="evidence-card"><h3>{ui('What runs in NewsAgg')}</h3>
      <p>{ui('Implementation snapshot: 15 October 2026. Six local NLP models have distinct roles. Two AI annotators in the evaluation are reference raters, not extra production NLP models. Model links describe their origins; external benchmark scores are not scores measured on this website.')}</p>
      <EvidenceTable caption={ui('Local NLP model inventory')} headers={[ui('Model / source'), ui('Role'), ui('Meaning and limits')]}>
        {models.map(([id, role, description]) => <tr key={id}><td><a href={`https://huggingface.co/${id}`} target="_blank" rel="noreferrer">{id}</a></td><td>{role}</td><td>{description}</td></tr>)}
      </EvidenceTable>
      <EvidenceTable caption={ui('Remote services and fallbacks')} headers={[ui('Service'), ui('Use in this project')]}>
        <tr><td>Groq · GPT-OSS-120B</td><td>{ui('Article questions and bounded topic second opinions. Chat has a configured GPT-OSS-20B fallback. Retrieval selects up to four passages; [n] refers to a supplied passage, not an academic reference number.')}</td></tr>
        <tr><td>Google Gemini · gemini-3.5-flash-lite</td><td>{ui('Configured translation model. Multi preserves original publisher text; EN / 繁中 request translation when needed. The server caches successful translations with source hashes and model metadata.')}</td></tr>
        <tr><td>Lingva</td><td>{ui('Short-text translation fallback. Failed translation keeps the original available; it is not counted as a successful translation. No bilingual human translation-quality score has been measured here.')}</td></tr>
      </EvidenceTable>
    </div>
    <div className="evidence-grid">
      <div className="evidence-card"><h3>{ui('Sentiment & polarity')}</h3>
        <code>P(c) = Σ(lengthᵢ × Pᵢ(c)) / Σ lengthᵢ<br />polarity = P(positive) − P(negative)</code>
        <p>{ui('Up to three 1,400-character passages represent the beginning, middle and end. Probabilities are weighted by passage length. Polarity ranges from −1 to +1.')}</p>
        <p>{ui('Neutral if P(neutral) ≥ 0.52 and |polarity| ≤ 0.18. Otherwise positive at ≥ 0.10, negative at ≤ −0.10, else the highest-probability class. Confidence is P(chosen class), not a measured accuracy percentage.')}</p>
      </div>
      <div className="evidence-card"><h3>{ui('Extractive summary & TF–IDF')} [13–14]</h3>
        <code>weight(t,s) = count(t,s) × [1 + ln((N + 1)/(df(t) + 1))]<br />cos(a,b) = (a · b) / (‖a‖ ‖b‖)</code>
        <p>{ui('TF is term frequency; IDF reduces the weight of terms found in many sentences. N is the sentence count, df the number containing that term. This is the local fallback if BGE-M3 embeddings are unavailable.')}</p>
        <code>selection = relevance − 0.5 × redundancy + section bonus</code>
        <p>{ui('MMR-style selection balances relevance and diversity. Relevance combines average sentence similarity with a 0.15 title-overlap bonus; a new document section adds 0.12. These are project heuristics. Up to four original sentences fit 600 Chinese or 1,100 other-language characters; no abstractive sentences are generated.')}</p>
      </div>
      <div className="evidence-card"><h3>{ui('Reading estimates')} [17, 21–23]</h3>
        <code>Flesch = 206.835 − 1.015(W/S) − 84.6(Y/W)<br />FK grade = 0.39(W/S) + 11.8(Y/W) − 15.59<br />SMOG = 1.043 × √(30M/S) + 3.1291</code>
        <p>{ui('W = words, S = sentences, Y = syllables, M = words with at least three syllables. The project calls textstat for these conventional formulas; token/syllable counting and rounding affect output. SMOG is shown only for English with at least 30 sentences; other unsupported scores are missing.')}</p>
        <p>{ui('Reading time uses 200 English words/minute or 400 Chinese characters/minute, rounded with a minimum of one minute for nonempty text. These are estimates, not validated comprehension tests.')}</p>
        <a href="https://github.com/textstat/textstat" target="_blank" rel="noreferrer">textstat</a>
      </div>
      <div className="evidence-card"><h3>{ui('Passage retrieval: BM25 + RRF')} [15–16]</h3>
        <code>BM25 = Σ IDF(q) × [f(q,d) × 2.2] / [f(q,d) + 1.2 × (0.25 + 0.75 × |d|/avgdl)]<br />IDF(q) = ln(1 + (N − df(q) + 0.5)/(df(q) + 0.5))</code>
        <p>{ui('q is a query term, d a passage, f its term count, N the passage count and avgdl the mean passage length. The current code uses k₁ = 1.2 and b = 0.75; they are tuning choices, not accuracy percentages.')}</p>
        <code>RRF(d) = 1/(60 + semantic rank) + 1/(60 + lexical rank)</code>
        <p>{ui('Ranks start at 1. Combine semantic and lexical ranks instead of adding incompatible raw scores; return up to four selected passages in article order. If embeddings fail, use lexical retrieval. This is retrieval-augmented generation (RAG), not open-web fact checking.')}</p>
      </div>
      <div className="evidence-card"><h3>{ui('Collection, cleaning & charts')}</h3>
        <p>{ui('Daily collection at 17:00 Taipei targets 20 articles per source/category across 28 supported pairs: at most 560, subject to quality and capacity gates. It is not a guaranteed count. Coverage and eligible article supply differ by publisher.')}</p>
        <p>{ui('Date parsing, the 48-hour window, body-length checks, topic confirmation, duplicate checks and evidence-preserving summaries gate publication. Stories without a publisher photo are rejected. The daily pipeline freezes the edition at 05:40 and sends email at 05:50 when readiness checks pass; a weekly job backs up the database and removes stories older than 30 days. The public feed retains 30 days.')}</p>
        <p>{ui('Sentiment share = class count / analysed count. Trending counts stored keyword occurrences after filtering boilerplate. Business trend averages stored polarity by date; its current query treats missing polarity as 0. Market prices are third-party context, not an NLP accuracy test.')}</p>
      </div>
    </div>
  </div>;
}
