import { EvidenceTable, type EvidenceText } from './EvaluationPanel';

export function ResearchMethods({ tx }: { tx: EvidenceText }) {
  const models = [
    ['cardiffnlp/twitter-xlm-roberta-base-sentiment', tx('General sentiment', '一般情感'), tx('Multilingual XLM-R scores positive, neutral and negative wording. Used for non-English business articles too; training-domain performance is not NewsAgg accuracy.', '多語 XLM-R 對正面、中性與負面語句評分；非英文商業文章也使用此模型。訓練領域表現不等於 NewsAgg 準確率。')],
    ['ProsusAI/finbert', tx('Financial sentiment', '金融情感'), tx('English Business only. FinBERT is BERT adapted to financial language; other languages use the general model.', '僅用於英文商業新聞。FinBERT 是針對金融語言調整的 BERT；其他語言使用一般模型。')],
    ['MoritzLaurer/mDeBERTa-v3-base-mnli-xnli', tx('Topic confirmation', '主題確認'), tx('Natural language inference (NLI) compares article text with eight topic descriptions without training a new NewsAgg classifier. Score ≥ 0.38 and lead ≥ 0.12 are project thresholds, not measured accuracy.', '自然語言推論（NLI）比較文章與八類主題描述，不另行訓練 NewsAgg 分類器。分數 ≥ 0.38 且領先 ≥ 0.12 為專案門檻，並非實測準確率。')],
    ['BAAI/bge-m3', tx('Semantic embeddings', '語意向量'), tx('Maps text to 1,024 numbers for similarity, extractive sentence selection and article-passage retrieval. BGE-M3 is a multilingual embedding model; an embedding is not a generated answer.', '將文字轉為 1,024 維數值，用於相似度、擷取摘要句子與檢索文章段落。BGE-M3 是多語向量模型，向量本身不是生成的答案。')],
    ['Davlan/xlm-roberta-base-ner-hrl', tx('Named entities', '命名實體'), tx('Named entity recognition (NER) extracts people, organizations and places. No manually scored NewsAgg NER benchmark is available in this evaluation.', '命名實體辨識（NER）擷取人名、組織與地點。本次評估尚無人工評分的 NewsAgg 實體辨識基準。')],
    ['unitary/toxic-bert', tx('Toxicity', '毒性'), tx('English only; unsupported languages return missing values. A toxicity score estimates harmful language, not factual reliability.', '僅處理英文；不支援的語言回傳缺值。毒性分數估計有害語句，不代表事實可靠性。')],
  ];
  return <div className="evidence-body evidence-methods">
    <div className="evidence-card"><h3>{tx('What runs in NewsAgg', 'NewsAgg 使用的模型')}</h3>
      <p>{tx('Implementation snapshot: 15 October 2026. Six local NLP models have distinct roles. Two AI annotators in the evaluation are reference raters, not extra production NLP models. Model links describe their origins; external benchmark scores are not scores measured on this website.', '實作快照：2026 年 10 月 15 日。六個本機 NLP 模型各有用途；評估中的兩個 AI 是參考標註者，並非額外的正式 NLP 模型。模型連結說明其來源，外部基準分數不等於本站實測分數。')}</p>
      <EvidenceTable caption={tx('Local NLP model inventory', '本機 NLP 模型清單')} headers={[tx('Model / source', '模型 / 來源'), tx('Role', '用途'), tx('Meaning and limits', '說明與限制')]}>
        {models.map(([id, role, description]) => <tr key={id}><td><a href={`https://huggingface.co/${id}`} target="_blank" rel="noreferrer">{id}</a></td><td>{role}</td><td>{description}</td></tr>)}
      </EvidenceTable>
      <EvidenceTable caption={tx('Remote services and fallbacks', '遠端服務與備援')} headers={[tx('Service', '服務'), tx('Use in this project', '本專案用途')]}>
        <tr><td>Groq · GPT-OSS-120B</td><td>{tx('Article questions and bounded topic second opinions. Chat has a configured GPT-OSS-20B fallback. Retrieval selects up to four passages; [n] refers to a supplied passage, not an academic reference number.', '文章問答與有限次主題第二意見。問答設定 GPT-OSS-20B 為備援；檢索最多四段文字，[n] 指提供的文章段落，並非學術參考文獻編號。')}</td></tr>
        <tr><td>Google Gemini · gemini-3.5-flash-lite</td><td>{tx('Configured translation model. Multi preserves original publisher text; EN / 繁中 request translation when needed. The server caches successful translations with source hashes and model metadata.', '設定的翻譯模型。Multi 保留媒體原文；EN / 繁中 在需要時要求翻譯。伺服器快取成功譯文並保存來源雜湊與模型資訊。')}</td></tr>
        <tr><td>Lingva</td><td>{tx('Short-text translation fallback. Failed translation keeps the original available; it is not counted as a successful translation. No bilingual human translation-quality score has been measured here.', '短文字翻譯備援。翻譯失敗時仍可閱讀原文，不計為成功翻譯。本次尚未量測雙語人工翻譯品質分數。')}</td></tr>
      </EvidenceTable>
    </div>
    <div className="evidence-grid">
      <div className="evidence-card"><h3>{tx('Sentiment & polarity', '情感與極性')}</h3>
        <code>P(c) = Σ(lengthᵢ × Pᵢ(c)) / Σ lengthᵢ<br />polarity = P(positive) − P(negative)</code>
        <p>{tx('Up to three 1,400-character passages represent the beginning, middle and end. Probabilities are weighted by passage length. Polarity ranges from −1 to +1.', '最多三段、每段 1,400 字元，代表開頭、中段與結尾；依段落長度加權機率。極性範圍為 −1 至 +1。')}</p>
        <p>{tx('Neutral if P(neutral) ≥ 0.52 and |polarity| ≤ 0.18. Otherwise positive at ≥ 0.10, negative at ≤ −0.10, else the highest-probability class. Confidence is P(chosen class), not a measured accuracy percentage.', 'P(中性) ≥ 0.52 且 |極性| ≤ 0.18 時判為中性；否則極性 ≥ 0.10 判正面、≤ −0.10 判負面，其餘取機率最高的類別。信心值為所選類別的機率，並非實測準確率。')}</p>
      </div>
      <div className="evidence-card"><h3>{tx('Extractive summary & TF–IDF', '擷取摘要與 TF–IDF')} [13–14]</h3>
        <code>weight(t,s) = count(t,s) × [1 + ln((N + 1)/(df(t) + 1))]<br />cos(a,b) = (a · b) / (‖a‖ ‖b‖)</code>
        <p>{tx('TF is term frequency; IDF reduces the weight of terms found in many sentences. N is the sentence count, df the number containing that term. This is the local fallback if BGE-M3 embeddings are unavailable.', 'TF 是詞頻；IDF 降低出現在許多句子中的詞之權重。N 為句數，df 為包含該詞的句數。BGE-M3 無法提供向量時，使用此本機備援。')}</p>
        <code>selection = relevance − 0.5 × redundancy + section bonus</code>
        <p>{tx('MMR-style selection balances relevance and diversity. Relevance combines average sentence similarity with a 0.15 title-overlap bonus; a new document section adds 0.12. These are project heuristics. Up to four original sentences fit 600 Chinese or 1,100 other-language characters; no abstractive sentences are generated.', 'MMR 式選句兼顧相關性與多樣性。相關性結合平均句子相似度與 0.15 的標題詞重疊加分；新文章區段加 0.12。這些數字是專案啟發式設定。最多選四句原句，上限中文 600、其他語言 1,100 字元，不生成抽象式摘要句。')}</p>
      </div>
      <div className="evidence-card"><h3>{tx('Reading estimates', '閱讀難度估計')} [17, 21–23]</h3>
        <code>Flesch = 206.835 − 1.015(W/S) − 84.6(Y/W)<br />FK grade = 0.39(W/S) + 11.8(Y/W) − 15.59<br />SMOG = 1.043 × √(30M/S) + 3.1291</code>
        <p>{tx('W = words, S = sentences, Y = syllables, M = words with at least three syllables. The project calls textstat for these conventional formulas; token/syllable counting and rounding affect output. SMOG is shown only for English with at least 30 sentences; other unsupported scores are missing.', 'W＝字數、S＝句數、Y＝音節數、M＝至少三音節的字數。專案透過 textstat 計算這些通用公式；斷詞、音節估計與四捨五入會影響結果。SMOG 僅於英文且至少 30 句時顯示；不支援的分數為缺值。')}</p>
        <p>{tx('Reading time uses 200 English words/minute or 400 Chinese characters/minute, rounded with a minimum of one minute for nonempty text. These are estimates, not validated comprehension tests.', '閱讀時間以英文每分鐘 200 字、中文每分鐘 400 字元估計，四捨五入且非空文章至少一分鐘。這些是估計值，不是經驗證的閱讀理解測試。')}</p>
        <a href="https://github.com/textstat/textstat" target="_blank" rel="noreferrer">textstat</a>
      </div>
      <div className="evidence-card"><h3>{tx('Passage retrieval: BM25 + RRF', '段落檢索：BM25 + RRF')} [15–16]</h3>
        <code>BM25 = Σ IDF(q) × [f(q,d) × 2.2] / [f(q,d) + 1.2 × (0.25 + 0.75 × |d|/avgdl)]<br />IDF(q) = ln(1 + (N − df(q) + 0.5)/(df(q) + 0.5))</code>
        <p>{tx('q is a query term, d a passage, f its term count, N the passage count and avgdl the mean passage length. The current code uses k₁ = 1.2 and b = 0.75; they are tuning choices, not accuracy percentages.', 'q 為問題詞、d 為段落、f 為該詞次數、N 為段落數、avgdl 為平均段落長度。目前 k₁＝1.2、b＝0.75 是調整參數，不是準確率。')}</p>
        <code>RRF(d) = 1/(60 + semantic rank) + 1/(60 + lexical rank)</code>
        <p>{tx('Ranks start at 1. Combine semantic and lexical ranks instead of adding incompatible raw scores; return up to four selected passages in article order. If embeddings fail, use lexical retrieval. This is retrieval-augmented generation (RAG), not open-web fact checking.', '排名從 1 開始，融合語意與詞彙排名，避免直接相加不同尺度的分數；最多四段按原文順序提供。向量失敗時使用詞彙檢索。這屬檢索增強生成（RAG），並非全網事實查核。')}</p>
      </div>
      <div className="evidence-card"><h3>{tx('Collection, cleaning & charts', '擷取、清理與圖表')}</h3>
        <p>{tx('Daily collection at 17:00 Taipei targets 20 articles per source/category across 28 supported pairs: at most 560, subject to quality and capacity gates. It is not a guaranteed count. Coverage and eligible article supply differ by publisher.', '每日臺北時間 17:00 擷取；28 組來源與分類各以 20 篇為目標，最多 560 篇，仍須通過品質與容量檢查，並非保證篇數。媒體涵蓋範圍及合格文章供應量皆不同。')}</p>
        <p>{tx('Date parsing, the 48-hour window, body-length checks, topic confirmation, duplicate checks and evidence-preserving summaries gate publication. The daily pipeline also handles retention cleaning, freezing the edition at 04:30 and email at 04:40 when readiness checks pass. The public feed retains 30 days.', '發布前檢查日期、48 小時範圍、正文長度、主題、重複與原文摘要。每日流程還包含保留期限清理、04:30 固定當日版本，以及通過檢查後於 04:40 寄信；公開新聞列表保留 30 天。')}</p>
        <p>{tx('Sentiment share = class count / analysed count. Trending counts stored keyword occurrences after filtering boilerplate. Business trend averages stored polarity by date; its current query treats missing polarity as 0. Market prices are third-party context, not an NLP accuracy test.', '情感比例＝類別篇數／已分析篇數。熱門詞統計儲存的關鍵詞出現次數並排除制式文字。商業走勢按日期平均儲存的極性；目前查詢將缺少極性視為 0。市場行情屬第三方背景資訊，並非 NLP 準確率測試。')}</p>
      </div>
    </div>
  </div>;
}
