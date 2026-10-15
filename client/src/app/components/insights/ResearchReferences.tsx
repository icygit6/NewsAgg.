import type { EvidenceText } from './EvaluationPanel';

// Numbers match the existing project report; titles remain in their published language.
const references: Array<[number, string, string, string, string]> = [
  [1, 'NewsAgg source code and dated operational records', 'https://github.com/icygit6/NewsAgg.', 'Implementation evidence; private repository access may be required.', '實作證據；私有程式庫可能需要存取權限。'],
  [2, '國立臺灣海洋大學資訊工程學系：大學部專題報告範本', '', 'Team-supplied school template, not a scientific result or a public download.', '團隊提供的學校格式範本，並非科學結果或公開下載。'],
  [3, 'Pichiyan et al. (2023). Web Scraping Using Natural Language Processing: Exploiting Unstructured Text for Data Extraction and Analysis.', 'https://doi.org/10.1016/j.procs.2023.12.074', 'Procedia Computer Science 230, 193–202. Background on scraping and NLP; not a validation of NewsAgg.', 'Procedia Computer Science 230，193–202。擷取與 NLP 背景研究，並非 NewsAgg 的效能驗證。'],
  [4, 'Barbieri, Espinosa Anke & Camacho-Collados (2022). XLM-T: Multilingual Language Models in Twitter for Sentiment Analysis and Beyond.', 'https://aclanthology.org/2022.lrec-1.27/', 'LREC, 258–266. Research behind the multilingual sentiment checkpoint.', 'LREC，258–266。多語情感模型的研究來源。'],
  [5, 'Cardiff NLP: twitter-xlm-roberta-base-sentiment', 'https://huggingface.co/cardiffnlp/twitter-xlm-roberta-base-sentiment', 'Model card for the deployed general-sentiment checkpoint.', '一般情感實際使用檢查點的模型說明卡。'],
  [6, 'Araci (2019). FinBERT: Financial Sentiment Analysis with Pre-trained Language Models.', 'https://arxiv.org/abs/1908.10063', 'arXiv preprint. Financial sentiment background; checkpoint: ProsusAI/finbert.', 'arXiv 預印本。金融情感背景；檢查點為 ProsusAI/finbert。'],
  [7, 'Moritz Laurer: mDeBERTa-v3-base-mnli-xnli', 'https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli', 'Model card for the NLI topic-confirmation checkpoint.', '主題確認所用 NLI 檢查點的模型說明卡。'],
  [8, 'Yin, Hay & Roth (2019). Benchmarking Zero-shot Text Classification: Datasets, Evaluation and Entailment Approach.', 'https://aclanthology.org/D19-1404/', 'EMNLP-IJCNLP, 3914–3923. Entailment-based classification concept; NewsAgg thresholds are locally chosen.', 'EMNLP-IJCNLP，3914–3923。蘊涵式分類概念；NewsAgg 門檻由專案自行設定。'],
  [9, 'Chen et al. (2024). M3-Embedding: Multi-Linguality, Multi-Functionality, Multi-Granularity Text Embeddings Through Self-Knowledge Distillation.', 'https://arxiv.org/abs/2402.03216', 'arXiv preprint. Research behind the BGE-M3 representation.', 'arXiv 預印本。BGE-M3 文字向量的研究來源。'],
  [10, 'BAAI: BGE-M3', 'https://huggingface.co/BAAI/bge-m3', 'Model card for semantic sentence and passage embeddings.', '用於語意句子與段落向量的模型說明卡。'],
  [11, 'Davlan: xlm-roberta-base-ner-hrl', 'https://huggingface.co/Davlan/xlm-roberta-base-ner-hrl', 'Model card for named entity extraction.', '命名實體擷取的模型說明卡。'],
  [12, 'Unitary: toxic-bert', 'https://huggingface.co/unitary/toxic-bert', 'Model card for English toxicity scoring.', '英文毒性評分的模型說明卡。'],
  [13, 'Manning, Raghavan & Schütze (2008). Introduction to Information Retrieval: TF–IDF weighting.', 'https://nlp.stanford.edu/IR-book/html/htmledition/tf-idf-weighting-1.html', 'Term-weighting foundation; the project uses its own smoothed sentence-level variant.', '詞權重基礎；本專案使用自行實作的平滑句子層級變體。'],
  [14, 'Carbonell & Goldstein (1998). The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries.', 'https://www.cs.cmu.edu/afs/cs/Web/People/jgc/publication/MMR_DiversityBased_Reranking_SIGIR_1998.pdf', 'SIGIR, 335–336; DOI 10.1145/290941.291025. Relevance/diversity principle, with project-specific bonuses.', 'SIGIR，335–336；DOI 10.1145/290941.291025。相關性與多樣性原則，另加專案自訂加分。'],
  [15, 'Robertson & Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond.', 'https://www.nowpublishers.com/article/Details/INR-019', 'Foundations and Trends in Information Retrieval 3(4), 333–389. Lexical passage ranking.', 'Foundations and Trends in Information Retrieval 3(4)，333–389。詞彙段落排序依據。'],
  [16, 'Cormack, Clarke & Büttcher (2009). Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods.', 'https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf', 'SIGIR, 758–759. Fusion of lexical and semantic passage ranks.', 'SIGIR，758–759。融合詞彙與語意段落排名的依據。'],
  [17, 'Textstat maintainers: readability implementations', 'https://github.com/textstat/textstat', 'Software documentation for the formulas actually called in the project.', '本專案實際呼叫之易讀度公式的軟體文件。'],
  [18, 'GitHub: Events that trigger workflows', 'https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule', 'Operational documentation, including scheduling limitations; not an NLP paper.', '操作文件，包含排程限制；並非 NLP 論文。'],
  [19, 'Cloudflare: Quick Tunnels', 'https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/', 'Documentation for the tunnel that exposes the locally hosted site.', '公開本機網站所用通道的技術文件。'],
  [20, 'Neon: serverless Postgres platform', 'https://github.com/neondatabase/neon/blob/main/README.md', 'Database implementation background, not measured compute savings.', '資料庫技術背景，不代表實測算力節省。'],
  [21, 'Flesch (1948). A new readability yardstick.', 'https://pubmed.ncbi.nlm.nih.gov/18867058/', 'Journal of Applied Psychology 32(3), 221–233; DOI 10.1037/h0057532. Reading ease origin.', 'Journal of Applied Psychology 32(3)，221–233；DOI 10.1037/h0057532。閱讀易讀度的原始研究。'],
  [22, 'Kincaid, Fishburne, Rogers & Chissom (1975). Derivation of New Readability Formulas for Navy Enlisted Personnel.', 'https://stars.library.ucf.edu/istlibrary/56/', 'Research Branch Report 8-75. Readability-grade history; original test population differs from NewsAgg readers.', 'Research Branch Report 8-75。閱讀年級的歷史來源；原始測試族群不同於本站讀者。'],
  [23, 'McLaughlin (1969). SMOG Grading — a New Readability Formula.', 'https://ogg.osu.edu/media/documents/health_lit/WRRSMOG_Readability_Formula_G._Harry_McLaughlin__1969_.pdf', 'Journal of Reading 12, 639–646. SMOG readability origin.', 'Journal of Reading 12，639–646。SMOG 易讀度的原始研究。'],
  [24, 'Google News: overview', 'https://news.google.com/about/', 'An example of an existing aggregation product only. Google News is not one of NewsAgg’s four scraped publishers.', '僅作為既有新聞彙整產品範例；Google News 並非 NewsAgg 擷取的四家媒體之一。'],
  [25, 'Scikit-learn developers: f1_score', 'https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html', 'Precision/recall, F1 and fixed-class macro averaging definitions. The project scorer computes the published values locally.', '精確率／召回率、F1 與固定類別宏觀平均的定義；公開數值由專案本機評分程式計算。'],
  [26, 'NLTK Project: Installing NLTK Data', 'https://www.nltk.org/data.html', 'Corpus setup and search-path documentation for NLP preprocessing.', 'NLP 前處理使用的語料安裝與搜尋路徑文件。'],
  [27, 'Cohen (1960). A Coefficient of Agreement for Nominal Scales.', 'https://doi.org/10.1177/001316446002000104', 'Educational and Psychological Measurement 20(1), 37–46. Origin of chance-corrected agreement κ.', 'Educational and Psychological Measurement 20(1)，37–46。偶然一致校正指標 κ 的原始研究。'],
  [28, 'Scikit-learn developers: cohen_kappa_score', 'https://scikit-learn.org/stable/modules/generated/sklearn.metrics.cohen_kappa_score.html', 'Implementation reference for Cohen κ and its interpretation.', 'Cohen κ 計算與解讀的實作參考。'],
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
    ['[1]–[28] in the report', 'Bibliography numbers linked below. These are distinct from the per-answer passage numbers in chat.', '報告參考文獻編號，對應下列清單；不同於每次問答的段落編號。'],
  ];
  return <div className="evidence-body">
    <div className="evidence-card"><h3>{tx('Names in plain language', '名詞簡明說明')}</h3>
      <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">{glossary.map(([term, en, zh]) => <div key={term}><dt className="font-semibold text-sm mb-1">{term}</dt><dd><p>{tx(en, zh)}</p></dd></div>)}</dl>
    </div>
    <div className="evidence-card"><h3>{tx('References used in the project report', '專題報告使用的參考文獻')}</h3>
      <p>{tx('The numbering below matches the report. Published titles are retained so they can be searched in Google Scholar; links point to original papers, author copies, model cards or official documentation. Preprints, software documentation and product examples have different evidential roles. Their benchmark scores are not measured NewsAgg scores.', '下列編號與報告一致。保留原始題名便於 Google Scholar 搜尋，連結指向原論文、作者版本、模型卡或官方文件。預印本、軟體文件與產品範例的證據用途各不相同，其基準分數不等於 NewsAgg 實測分數。')}</p>
      <ol className="mt-5 space-y-5">{references.map(([id, title, url, en, zh]) => <li key={id} className="!m-0 border-t pt-4" style={{borderColor:'var(--ev-border)'}}>
        <div className="text-sm font-semibold">[{id}] {url ? <a href={url} target="_blank" rel="noreferrer">{title}</a> : title}</div><p>{tx(en, zh)}</p>
      </li>)}</ol>
    </div>
  </div>;
}
