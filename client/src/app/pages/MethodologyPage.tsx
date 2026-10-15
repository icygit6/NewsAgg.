import { Link } from 'react-router';
import { useApp } from '../contexts/AppContext';

interface Section {
  title: string;
  points: string[];
}

/*
 * Public disclosure of how NewsAgg collects and analyses news, condensed from
 * the project report (Chapters II–V and Appendix E). Keep the numbers in step
 * with ops/daily-config.json, scraper/core/config.py and the evaluation files.
 */
const CONTENT: Record<'en' | 'zhTW', { intro: string; sections: Section[]; back: string }> = {
  en: {
    intro:
      'NewsAgg gathers reporting from four publishers and adds automated analysis so stories can be compared in one place. It does not decide whether news is true. Every article links to its original source.',
    sections: [
      {
        title: 'Sources and coverage',
        points: [
          'Four publishers: BBC, CNN and Al Jazeera in English, and Yahoo News Taiwan in Traditional Chinese.',
          'Eight topics: Sport, Health, Business, World, Politics, Lifestyle, Science (including technology) and Climate. Not every publisher is collected for every topic: Al Jazeera has no Politics or Lifestyle feed here, and Yahoo Taiwan has no Health or Climate feed.',
          'Collection runs daily at 17:00 Taipei time, up to 20 articles per publisher and topic, from stories published in the previous 48 hours. The public feed keeps 30 days.',
          'Publisher shares change with eligible article supply. The dataset is not balanced by publisher; overall charts can be dominated by the largest source.',
          'An article is published only after checks: a readable date, at least 300 characters of body text (80 words for English), a confirmed topic, a summary drawn from the text, and no duplicate.',
        ],
      },
      {
        title: 'Language',
        points: [
          'Multi (the default) shows each story exactly as published, in its original language.',
          'Choosing EN or 繁中 translates headlines and articles on request with Google Gemini, with Lingva as a fallback for short text. Translated text is marked as auto-translated and can contain errors.',
        ],
      },
      {
        title: 'Topics',
        points: [
          'A multilingual zero-shot model (mDeBERTa NLI) checks each candidate against the eight topic descriptions. It must score at least 0.38 and lead the runner-up by 0.12.',
          'Unclear cases can get a second opinion from GPT-OSS-120B (hosted by Groq), capped at 96 calls per run. A story whose topic cannot be confirmed is not published.',
        ],
      },
      {
        title: 'Sentiment',
        points: [
          'XLM-RoBERTa (FinBERT for English business stories) scores up to three passages of each article: the start, middle and end.',
          'Polarity = positive − negative. The label is neutral when P(neutral) ≥ 0.52 and |polarity| ≤ 0.18; otherwise positive at polarity ≥ 0.10 and negative at ≤ −0.10; otherwise the most probable class. The label can therefore differ from the largest probability.',
          'Confidence is the probability of the chosen label, not measured accuracy.',
          'Sentiment describes the wording of a report. It is not a judgement of truth, of a publisher’s politics, or of public opinion.',
        ],
      },
      {
        title: 'How accurate is it?',
        points: [
          'Four team members and two AI references labelled the same 120 published articles (30 per publisher). The system agreed with individual human labels on 51–57% of sentiment labels and 66–84% of topics.',
          'The main known weakness: the sentiment model calls far fewer stories positive (6 of 120) than people did (25–33 of 120), and many more negative.',
          'The snapshot contains 93 unique articles with human disagreement across the two tasks. Final adjudication has not started in that snapshot; these figures are interim and describe this sample only, not the whole site.',
        ],
      },
      {
        title: 'Summaries',
        points: [
          'Summaries are extractive: up to four sentences copied from the article itself (about 600 characters in Chinese, 1,100 otherwise), chosen for relevance and variety with BGE-M3 embeddings.',
          'No sentence is invented, but a summary can leave out context. Read the full article before relying on it.',
        ],
      },
      {
        title: 'Reading metrics, entities and toxicity',
        points: [
          'Flesch reading ease, reading grade and SMOG are calculated for English text only; SMOG needs at least 30 sentences. They estimate difficulty, not comprehension or credibility.',
          'Reading time assumes 200 words per minute in English and 400 characters per minute in Chinese.',
          'People, organisations and places are extracted automatically and can be incomplete. The toxicity score covers English only; a missing value means “not measured”, not zero.',
        ],
      },
      {
        title: 'Insights and trending topics',
        points: [
          'Charts count the published dataset. Trending topics rank how often keywords appear, after removing newsroom boilerplate. They are not a forecast or a measure of global importance.',
        ],
      },
      {
        title: 'Ask GPT-OSS-120B',
        points: [
          'Answers come from GPT-OSS-120B hosted by Groq, using only up to four passages of the article you are reading, with [n] citations to those passages.',
          'Your question and those passages are sent to Groq. Signed-in readers can ask 20 questions per 15 minutes. Answers can still be wrong.',
        ],
      },
      {
        title: 'Corrections',
        points: [
          'Use “Report an issue” at the end of any article to flag a wrong label, summary, translation or extracted text. Reports enter the team review queue; submission does not change content automatically or guarantee a response time.',
        ],
      },
    ],
    back: 'Return to NewsAgg',
  },
  zhTW: {
    intro:
      'NewsAgg 匯集四家媒體的報導，並加上自動分析，方便在同一處比較新聞。NewsAgg 不判定新聞真偽，每篇文章都附原始來源連結。',
    sections: [
      {
        title: '來源與涵蓋範圍',
        points: [
          '四家媒體：英文的 BBC、CNN、Al Jazeera，以及繁體中文的 Yahoo 奇摩新聞臺灣。',
          '八個主題：運動、健康、商業、國際、政治、生活、科學（含科技）與氣候。並非每家媒體都擷取所有主題：本站未擷取 Al Jazeera 的政治與生活，也未擷取 Yahoo 臺灣的健康與氣候。',
          '每日臺北時間 17:00 擷取，每家媒體每個主題最多 20 篇，只收過去 48 小時內發布的新聞；公開列表保留 30 天。',
          '各媒體占比會隨合格文章供應而改變，資料集並非依媒體平衡抽樣；整體圖表可能由篇數最多的來源主導。',
          '文章須通過檢查才會公開：日期可解析、正文至少 300 字元（英文至少 80 字）、主題經確認、摘要取自原文，且不重複。',
        ],
      },
      {
        title: '語言',
        points: [
          '多語（預設）依新聞發布時的原文語言顯示，不做翻譯。',
          '選擇 EN 或 繁中 時，標題與內文會在需要時以 Google Gemini 翻譯，短文字以 Lingva 備援。譯文會標示為自動翻譯，可能有誤。',
        ],
      },
      {
        title: '主題',
        points: [
          '多語零樣本模型（mDeBERTa NLI）將候選文章與八個主題描述比對，最高分須至少 0.38，且領先第二名 0.12。',
          '不明確的文章可由 Groq 上的 GPT-OSS-120B 提供第二意見，每次擷取最多 96 次。無法確認主題的文章不會公開。',
        ],
      },
      {
        title: '情感',
        points: [
          'XLM-RoBERTa（英文商業新聞使用 FinBERT）為每篇文章最多三段內容評分：開頭、中段與結尾。',
          'polarity = 正面 − 負面。P(中性) ≥ 0.52 且 |polarity| ≤ 0.18 時判中性；否則 polarity ≥ 0.10 判正面、≤ −0.10 判負面；其餘取機率最高的類別。因此標籤可能與最大機率不同。',
          '信心值是所選標籤的機率，不是實測準確率。',
          '情感描述報導的用詞，不代表真偽、媒體政治立場或民意。',
        ],
      },
      {
        title: '準確度如何？',
        points: [
          '四位組員與兩個 AI 參考標註了同一批 120 篇已發布文章（每家媒體 30 篇）。系統與個別人工標籤的情感一致率為 51–57%，主題為 66–84%。',
          '目前已知的主要弱點：情感模型判為正面的文章遠少於人工（120 篇中 6 篇對 25–33 篇），判為負面的則多得多。',
          '兩項任務共有 93 篇不同文章存在人工分歧。此快照尚未開始最終裁決；以上為暫定數字，只描述這批樣本，不代表全站。',
        ],
      },
      {
        title: '摘要',
        points: [
          '摘要為擷取式：從原文直接選出最多四句（中文約 600 字元，其他語言約 1,100 字元），以 BGE-M3 向量兼顧相關性與多樣性。',
          '摘要不會杜撰句子，但可能遺漏脈絡；重要資訊請閱讀全文。',
        ],
      },
      {
        title: '閱讀指標、實體與毒性',
        points: [
          'Flesch 易讀度、閱讀年級與 SMOG 只計算英文內容，SMOG 需至少 30 句。這些是難度估計，不代表理解程度或可信度。',
          '閱讀時間以英文每分鐘 200 字、中文每分鐘 400 字元估算。',
          '人名、組織與地點為自動擷取，可能不完整。毒性分數只涵蓋英文；缺值代表「未量測」，不是零。',
        ],
      },
      {
        title: '洞察與熱門話題',
        points: [
          '圖表統計已發布的資料集。熱門話題依關鍵詞出現次數排序，並排除新聞稿常用字，不是預測，也不代表全球重要性。',
        ],
      },
      {
        title: 'Ask GPT-OSS-120B 問答',
        points: [
          '回答由 Groq 上的 GPT-OSS-120B 產生，只使用您正在閱讀文章中最多四段內容，並以 [n] 標示引用段落。',
          '您的問題與這些段落會傳送至 Groq。登入讀者每 15 分鐘可提問 20 次。回答仍可能有誤。',
        ],
      },
      {
        title: '更正',
        points: [
          '每篇文章結尾的「回報問題」可標記錯誤的標籤、摘要、翻譯或擷取內容。回報會進入團隊審查佇列，不會自動更改文章，也不保證處理時限。',
        ],
      },
    ],
    back: '返回 NewsAgg',
  },
};

export function MethodologyPage() {
  const { t, language, isDark } = useApp();
  const content = CONTENT[language === 'zhTW' || language === 'zhCN' ? 'zhTW' : 'en'];
  return (
    <article className={`mx-auto max-w-3xl px-5 py-10 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
      <h1 className={`mb-3 text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>{t.methodologyTitle}</h1>
      <p className="mb-8">{content.intro}</p>
      <p className="mb-8"><Link className="text-blue-600 underline" to="/insights?view=research">{language === 'zhTW' || language === 'zhCN' ? '查看完整評估、Macro F1、混淆矩陣與測試紀錄 →' : 'Explore full evaluation, macro F1, confusion matrices and test evidence →'}</Link></p>
      <div className="space-y-7">
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2 className={`mb-2 text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{section.title}</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              {section.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm"><Link className="text-blue-600 hover:underline" to="/">{content.back}</Link></p>
    </article>
  );
}
