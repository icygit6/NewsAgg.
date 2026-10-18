import type { EvidenceText } from './EvaluationPanel';

// Numeric order matches the revised report and EndNote RIS dated 18 October 2026.
const references: Array<[number, string, string, string, string]> = [
  [1,"Automated Text Classification of News Articles: A Practical Guide","https://www.cambridge.org/core/journals/political-analysis/article/automated-text-classification-of-news-articles-a-practical-guide/10462DB284B1CD80C0FAE796AD786BC6","News corpus and validation design; report I.1, III.3.1 and E4. Does not establish global representativeness.","新聞語料與驗證設計；報告 I.1、III.3.1、E4。不證明全球代表性。"],
  [2,"XLM-T: Multilingual language models in Twitter for sentiment analysis and beyond","https://aclanthology.org/2022.lrec-1.27/","LREC 2022, 258–266. Sentiment research; report II.4.1. Twitter-to-news domain shift remains.","LREC 2022，258–266；報告 II.4.1 的情感研究來源，仍有 Twitter 至新聞的領域落差。"],
  [3,"twitter-xlm-roberta-base-sentiment","https://huggingface.co/cardiffnlp/twitter-xlm-roberta-base-sentiment","Exact sentiment checkpoint; report II.4.1. Chinese is absent from its eight sentiment fine-tuning languages.","精確情感 checkpoint；報告 II.4.1。八種情感微調語言不含中文。"],
  [4,"FinBERT: Financial sentiment analysis with pre-trained language models","https://arxiv.org/abs/1908.10063","2019 arXiv preprint and ProsusAI/finbert checkpoint; report II.4.1. English Business routing has no local A/B gain claim.","2019 arXiv 預印本及 ProsusAI/finbert；報告 II.4.1。英文 Business 路由未經本專題 A/B 改善驗證。"],
  [5,"Benchmarking zero-shot text classification: Datasets, evaluation and entailment approach","https://doi.org/10.18653/v1/D19-1404","EMNLP-IJCNLP 2019, 3914–3923. NLI classification; report II.4.1–4.2. Local thresholds are not prescribed by the paper.","EMNLP-IJCNLP 2019，3914–3923；報告 II.4.1–4.2。NLI 方法來源，不提供本站最優門檻。"],
  [6,"NewsAgg source code and dated operational evidence, including baseline 4bf3166, recovery cc4518c and inspected revision 3fd1ba1","https://github.com/icygit6/NewsAgg","Implementation and dated measurements; report II–IV and appendices C/E. Private access may be required.","實作與具日期量測；報告 II–IV 及附錄 C/E。私有程式庫可能需要權限。"],
  [7,"mDeBERTa-v3-base-mnli-xnli","https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli","Exact NLI topic checkpoint and training languages; report II.4.1–4.2. A model card, not a peer-reviewed paper.","精確 NLI 主題 checkpoint 與訓練語言；報告 II.4.1–4.2。模型卡並非同儕審查論文。"],
  [8,"Less Annotating, More Classifying: Addressing the Data Scarcity Issue of Supervised Machine Learning with Deep Transfer Learning and BERT-NLI","https://www.cambridge.org/core/journals/political-analysis/article/less-annotating-more-classifying-addressing-the-data-scarcity-issue-of-supervised-machine-learning-with-deep-transfer-learning-and-bertnli/05BB05555241762889825B080E097C27","Political Analysis 32(1), 84–100, 2024. Low-annotation NLI transfer rationale recommended by the checkpoint author; report II.4.1.","Political Analysis 32(1)，84–100，2024。模型作者推薦的少標註 NLI 遷移依據；報告 II.4.1。"],
  [9,"M3-Embedding: Multi-linguality, multi-functionality, multi-granularity text embeddings through self-knowledge distillation","https://aclanthology.org/2024.findings-acl.137/","Published Findings of ACL 2024, 2318–2335; report II.4.1/4.4. Only dense representations are implemented here.","正式 Findings of ACL 2024，2318–2335；報告 II.4.1/4.4。本站僅實作 dense 表示。"],
  [10,"BGE-M3","https://huggingface.co/BAAI/bge-m3","Exact BGE-M3 checkpoint; report II.4.1/4.4. NewsAgg uses normalized 1,024-dimensional CLS vectors and 512 tokens.","精確 BGE-M3 checkpoint；報告 II.4.1/4.4。本站使用正規化 1,024 維 CLS 向量及 512 tokens。"],
  [11,"xlm-roberta-base-ner-hrl","https://huggingface.co/Davlan/xlm-roberta-base-ner-hrl","Exact PER/ORG/LOC checkpoint; report II.4.1. Entity recognition is not factual verification.","PER/ORG/LOC 實際 checkpoint；報告 II.4.1。實體辨識不等於事實查核。"],
  [12,"toxic-bert","https://huggingface.co/unitary/toxic-bert","English toxic-comment checkpoint; report II.4.1. Toxicity is not news veracity or publisher credibility.","英文毒性留言 checkpoint；報告 II.4.1。毒性不代表新聞真假或媒體可信度。"],
  [13,"Introduction to Information Retrieval","https://nlp.stanford.edu/IR-book/","Textbook sections 6.2, 8.3 and 13.6: TF–IDF, cosine and classification evaluation; report II.4.4 and E14.","教科書 §6.2、§8.3、§13.6：TF–IDF、cosine 及分類評估；報告 II.4.4、E14。"],
  [14,"The use of MMR, diversity-based reranking for reordering documents and producing summaries","https://doi.org/10.1145/290941.291025","SIGIR 1998, 335–336. Relevance/diversity principle; report II.4.4. Summary bonuses are local adaptations.","SIGIR 1998，335–336。相關性與多樣性原則；報告 II.4.4。摘要額外加分為專題變體。"],
  [15,"The probabilistic relevance framework: BM25 and beyond","https://doi.org/10.1561/1500000019","BM25 theoretical framework; report II.4.4. Original author record gives 3(4), 333–389 (2009).","BM25 理論；報告 II.4.4。原作者書目為 3(4)，333–389（2009）。"],
  [16,"BM25Similarity: Lucene 9.12.3 core API","https://lucene.apache.org/core/9_12_3/core/org/apache/lucene/search/similarities/BM25Similarity.html","Exact positive-IDF variant and defaults k1=1.2, b=0.75; report II.4.4. NewsAgg implements BM25 itself, not with Lucene.","正值 IDF 變體與預設 k1=1.2、b=0.75；報告 II.4.4。本站自行實作 BM25，並非使用 Lucene。"],
  [17,"Reciprocal rank fusion outperforms Condorcet and individual rank learning methods","https://doi.org/10.1145/1571941.1572114","SIGIR 2009, 758–759. RRF equation and k=60; report II.4.4. Ranking scores are not answer probabilities.","SIGIR 2009，758–759。RRF 公式與 k=60；報告 II.4.4。排序分數不是答案正確機率。"],
  [18,"A new readability yardstick","https://doi.org/10.1037/h0057532","1948 original English reading-ease study; report II.4.5. Not a reader-comprehension or truth test.","1948 英文閱讀易讀度原始研究；報告 II.4.5。不是理解率或真偽測試。"],
  [19,"Derivation of new readability formulas (Automated Readability Index, Fog Count and Flesch Reading Ease formula) for Navy enlisted personnel","https://stars.library.ucf.edu/istlibrary/56/","1975 Navy technical report; report II.4.5. The original reader population differs from NewsAgg users.","1975 海軍技術報告；報告 II.4.5。原始讀者族群不同於本站使用者。"],
  [20,"SMOG grading—A new readability formula","","1969 SMOG origin; report II.4.5. NewsAgg uses the textstat coefficient variant and a 30-sentence minimum.","1969 SMOG 來源；報告 II.4.5。本站採 textstat 係數變體及至少 30 句限制。"],
  [21,"textstat: Readability implementations, inspected version 0.7.13","https://github.com/textstat/textstat","Actual readability library, inspected version 0.7.13; report II.4.5. Internal counts can differ from displayed word_count.","實際易讀度函式庫，核對版本 0.7.13；報告 II.4.5。內部計數可能不同於畫面 word_count。"],
  [22,"Sentiment Is Not Stance: Target-Aware Opinion Classification for Political Text Analysis","https://www.cambridge.org/core/journals/political-analysis/article/sentiment-is-not-stance-targetaware-opinion-classification-for-political-text-analysis/743A9DD62DF3F2F448E199BDD1C37C8D","Political Analysis 31(2), 235–256, 2023. Sentiment/stance distinction; report V.2 and E4. Not a causal explanation of local errors.","Political Analysis 31(2)，235–256，2023。情感／立場區分；報告 V.2、E4。不直接解釋本站錯誤原因。"],
  [23,"A coefficient of agreement for nominal scales","https://doi.org/10.1177/001316446002000104","1960 origin of chance-corrected pairwise agreement; report E12/E14. Kappa does not prove correctness or independence.","1960 機會校正配對一致性的來源；報告 E12/E14。κ 不證明答案正確或標註獨立。"],
  [24,"Survey Article: Inter-Coder Agreement for Computational Linguistics","https://aclanthology.org/J08-4004/","Computational Linguistics 34(4), 555–596, 2008. NLP annotation agreement and interpretation; report E12/E14.","Computational Linguistics 34(4)，555–596，2008。NLP 標註一致性與解讀；報告 E12/E14。"],
];

export function ResearchReferences({ tx }: { tx: EvidenceText }) {
  const glossary = [
    ['NLP', 'Natural language processing: computational analysis of human language.', '自然語言處理：以程式分析人類語言。'],
    ['Sentiment / polarity', 'A positive/neutral/negative label and a signed score P(positive) − P(negative). Neither is a truth score.', '情感為正／中／負面標籤；極性為正面機率減負面機率，兩者都不是真偽分數。'],
    ['Confidence', 'Probability assigned to the selected model label. A confident prediction can be wrong.', '所選模型標籤的機率；高信心預測仍可能錯誤。'],
    ['Precision / recall', 'Precision asks how many predictions of a class match the reference; recall asks how many reference cases of that class were found.', '精確率看「預測為該類有多少符合參考」；召回率看「參考中的該類有多少被找出」。'],
    ['F1 / macro F1', 'F1 balances precision and recall. Macro F1 averages the class F1 scores equally, including rare classes.', 'F1 綜合精確率與召回率；Macro F1 對各類 F1 等權平均，少數類同等重要。'],
    ['Cohen κ', 'Agreement between two label sets after accounting for chance agreement implied by their class frequencies.', '根據兩組類別頻率校正偶然一致後的標註一致程度。'],
    ['Confusion matrix / support', 'A count table comparing reference labels with predictions. Support is the number of reference cases in a class.', '比較參考標註與預測的計數表；support 是該類參考樣本數。'],
    ['TP / FP / FN', 'True positive: class match. False positive: predicted class disagrees. False negative: a reference class case was missed.', 'TP：該類符合參考；FP：誤判為該類；FN：參考為該類但未找出。'],
    ['NLI / zero-shot', 'Natural language inference tests whether text supports a description. Zero-shot uses supplied class descriptions without training on NewsAgg labels.', '自然語言推論檢查文字是否支持描述；零樣本分類使用類別描述，不以 NewsAgg 標註另行訓練。'],
    ['BERT / XLM-R / mDeBERTa', 'Names of pretrained transformer language-model families. FinBERT adapts BERT to finance; XLM-R and mDeBERTa support multiple languages.', '預訓練 Transformer 語言模型家族。FinBERT 將 BERT 用於金融；XLM-R 與 mDeBERTa 支援多語。'],
    ['BGE-M3 / embedding', 'A multilingual model producing text vectors. M3 refers to multilinguality, multifunctionality and multigranularity; NewsAgg uses dense vectors.', '產生文字向量的多語模型。M3 代表多語、多功能、多粒度；NewsAgg 使用稠密向量。'],
    ['TF–IDF / cosine', 'Term frequency × inverse document frequency weights distinctive terms. Cosine compares the direction of two text vectors.', '詞頻乘逆文件頻率，提高具辨識性詞的權重；餘弦相似度比較兩個文字向量的方向。'],
    ['MMR', 'Maximal marginal relevance: select relevant sentences while penalizing repetition. NewsAgg uses an adapted selection rule.', '最大邊際相關性：選相關句子並懲罰重複；NewsAgg 使用改寫後的選句規則。'],
    ['BM25 / RRF', 'BM25 ranks lexical matches. Reciprocal rank fusion combines rank positions from lexical and semantic retrieval.', 'BM25 排序詞彙匹配；倒數排名融合（RRF）結合詞彙與語意檢索的排名。'],
    ['RAG / [n] in chat', 'Retrieval-augmented generation supplies article passages before generating an answer. [n] identifies a supplied passage.', '檢索增強生成先提供文章段落再產生回答；問答中的 [n] 指所提供的段落。'],
    ['NER', 'Named entity recognition: detect mentions of people, organizations and places.', '命名實體辨識：找出人名、組織與地點的提及。'],
    ['Flesch / FK / SMOG', 'English readability estimates based on sentence length and syllables; not tests of truth or reader comprehension.', '以句長與音節估計英文易讀度，不是真偽或讀者理解測驗。'],
    ['JSON / JSONL', 'JSON stores structured data; JSONL stores one JSON record per line. Evaluation inputs are matched by article ID.', 'JSON 儲存結構化資料；JSONL 每行一筆 JSON。評估輸入依文章識別碼配對。'],
    ['Regression test', 'Checks previously supported behavior after code changes, using controlled examples. It is not a statistical regression model.', '用受控範例檢查改碼後原有功能是否正常，並非統計迴歸模型。'],
    ['Gold labels / adjudication', 'A reviewed reference set; adjudication resolves disagreements with documented human decisions. It is still pending here.', '經審查的標準標註；裁決透過有紀錄的人工決定解決分歧，本研究尚待完成。'],
    ['SHA-256', 'A file fingerprint for detecting changes. A matching hash validates file identity, not whether the content is true.', '檔案指紋，可偵測變更；雜湊相同驗證檔案一致，不驗證內容真實。'],
    ['[1]–[24] in the report', 'Numbers follow first-citation order and match the revised Word report and EndNote RIS, not chat passage numbers.', '依首次引用順序編號，與修訂 Word 報告及 EndNote RIS 一致，不同於問答段落編號。'],
  ];
  return <div className="evidence-body">
    <div className="evidence-card"><h3>{tx('Names in plain language', '名詞簡明說明')}</h3>
      <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">{glossary.map(([term, en, zh]) => <div key={term}><dt className="font-semibold text-sm mb-1">{term}</dt><dd><p>{tx(en, zh)}</p></dd></div>)}</dl>
    </div>
    <div className="evidence-card"><h3>{tx('References used in the project report', '專題報告使用的參考文獻')}</h3>
      <p>{tx('The numbering below matches the report. Published titles are retained so they can be searched in Google Scholar; links point to original papers, author copies, model cards or official documentation. Each entry identifies its relevant report section. Model cards and software documentation establish implementation details, not peer-reviewed validation. Local thresholds and frozen results are unchanged.', '下列編號與報告一致。保留原始題名便於 Google Scholar 搜尋，連結指向原論文、作者版本、模型卡或官方文件。各項標示對應報告章節。模型卡與軟體文件說明實作，不冒充同儕審查驗證。專案門檻與固定結果未變。')}</p>
      <ol className="mt-5 space-y-5">{references.map(([id, title, url, en, zh]) => <li key={id} className="!m-0 border-t pt-4" style={{borderColor:'var(--ev-border)'}}>
        <div className="text-sm font-semibold">[{id}] {url ? <a href={url} target="_blank" rel="noreferrer">{title}</a> : title}</div><p>{tx(en, zh)}</p>
      </li>)}</ol>
    </div>
  </div>;
}
