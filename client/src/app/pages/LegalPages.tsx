import { useUiText } from '../i18n/uiText';
import type { ReactNode } from 'react';
import { useApp } from '../contexts/AppContext';
import { FileText, Newspaper, ShieldCheck, type LucideIcon } from 'lucide-react';
import { DocLayout, DocSection } from '../components/ui/DocLayout';

function LegalLayout({ title, icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  const ui = useUiText();
  return <DocLayout icon={icon} title={title} meta={ui("Effective October 15, 2026")} back={ui("Return to NewsAgg")}>{children}</DocLayout>;
}

function usePolicyText() {
  const { language } = useApp();
  return (en: string, zh: string) => language === 'zhTW' || language === 'zhCN' ? zh : en;
}

const Section = DocSection;

export function TermsPage() {
  const ui = useUiText();
  const tx = usePolicyText();
  return (
    <LegalLayout icon={FileText} title={ui("Terms of Service")}>
      <Section title={ui("Using NewsAgg")}><p>{ui("NewsAgg provides aggregated news, summaries, sentiment analysis, and optional community and AI features for informational purposes. You must use the service lawfully and may not disrupt it, automate abusive traffic, impersonate others, or post unlawful or harmful material.")}</p></Section>
      <Section title={ui("Accounts")}><p>{ui("You are responsible for activity under your account and for keeping your sign-in methods secure. We may restrict accounts that abuse the service or other users. You may delete your account from account settings.")}</p></Section>
      <Section title={ui("News and AI content")}><p>{ui("Original articles, images and trademarks belong to their publishers and creators. NewsAgg summaries are sentences extracted from the original article; sentiment, topics, translations and chat answers are automated. All of them can contain errors and none is financial, legal, medical or other professional advice. Follow the source link before relying on important information.")}</p></Section>
      <Section title={ui("Community content")}><p>{ui("You retain ownership of posts you submit and grant NewsAgg permission to display them as part of the service. Do not post content you lack permission to share.")}</p></Section>
      <Section title={tx('Source attribution and permitted use', '來源標示與合理使用')}><p>{tx('NewsAgg is an academic aggregation and NLP project, not the publisher of the linked reporting. Source names, dates and links remain attached to articles. Display on NewsAgg does not grant permission to republish publisher text or images. Follow the original publisher’s conditions and respect access restrictions; do not use this service to bypass them.', 'NewsAgg 是學術新聞彙整與 NLP 專案，並非連結報導的原始出版者。文章保留來源名稱、日期與連結。本站展示不代表授予轉載媒體原文或圖片的權利，請遵守原始媒體規範與存取限制，不得利用本站繞過限制。')}</p></Section>
      <Section title={tx('Interpreting analytical results', '解讀分析結果')}><p>{tx('Sentiment, model confidence, topic scores and keyword counts are analytical outputs. They do not certify truth, neutrality or completeness. The research dashboard reports agreement on a dated sample; it must not be quoted as final site-wide accuracy. Quotas are collection targets and do not guarantee equal coverage.', '情緒、模型信心、主題分數與關鍵詞次數都是分析輸出，不保證真實、中立或完整。研究頁面呈現特定日期樣本的一致程度，不可引用為全站最終準確率。擷取配額為目標，不保證各媒體報導量相等。')}</p></Section>
      <Section title={tx('Reporting problems', '回報問題')}><p>{tx('For an article error or rights concern, use Report an issue on the relevant article and select the closest reason, or Other. Include the source link and a concise description. Do not submit passwords, API keys or sensitive personal details. Reports enter a review queue; submission does not automatically remove or change content and no response time is guaranteed.', '文章錯誤或權利疑慮，請使用該文章的「回報問題」，選擇適合原因或「其他」，提供來源連結與簡要說明。請勿提交密碼、API 金鑰或敏感個資。回報進入審查佇列，不會自動刪除或更改內容，也不保證處理時限。')}</p></Section>
      <Section title={ui("Availability and liability")}><p>{ui("The service is provided on an “as available” basis without a guarantee of uninterrupted operation. To the extent allowed by law, NewsAgg is not liable for losses caused by reliance on aggregated, third-party, or AI-generated content.")}</p></Section>
      <Section title={ui("Changes")}><p>{ui("These terms may be updated as the service evolves. Continued use after an updated effective date means you accept the revised terms.")}</p></Section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  const ui = useUiText();
  const tx = usePolicyText();
  return (
    <LegalLayout icon={ShieldCheck} title={ui("Privacy Policy")}>
      <Section title={ui("Information we process")}><p>{ui("When you create an account, NewsAgg stores your email address, username, authentication details, profile settings, bookmarks, and posts. Passwords are stored only as cryptographic hashes. Google sign-in is used only to verify identity and link the account you approve.")}</p></Section>
      <Section title={ui("How information is used")}><p>{ui("We use this information to operate authentication, save your account settings and bookmarks, display posts, prevent abuse, troubleshoot failures, and improve service reliability.")}</p></Section>
      <Section title={ui("Cookies and local storage")}><p>{ui("An essential HttpOnly session cookie keeps you signed in. Active-session records include limited browser and IP information so you can recognize devices and revoke access. Theme, language, news-language mode, cached profile display and per-article chat history may be stored locally in your browser. NewsAgg does not use these features for advertising tracking.")}</p></Section>
      <Section title={ui("Service providers")}><p>{ui("NewsAgg uses these providers: a self-hosted PostgreSQL database; Cloudflare for the secure tunnel and Turnstile CAPTCHA; Google for sign-in and Gemini translation; Lingva as a short-text translation fallback; Groq for AI chat, which receives your question and up to four passages of the article you are reading; an SMTP provider for account and digest email; and error monitoring when it is enabled. Each provider processes data under its own terms.")}</p></Section>
      <Section title={tx('Translation, chat and external content', '翻譯、問答與外部內容')}><p>{tx('With Translate news off, news stays in its original language. Requesting a translation sends the required article text to a translation provider; successful results may be cached in the database. Article chat sends your question, selected article passages and relevant conversation turns to Groq. Chat history stored in this browser can remain after signing out. Source images and favicon fallbacks can contact publisher or Google servers, which receive normal network request information such as your IP address.', '「翻譯新聞」關閉時保留原文。要求翻譯時，必要文章文字會傳送給翻譯服務，成功結果可能快取於資料庫。文章問答將問題、選取的段落與相關對話傳送至 Groq。瀏覽器中的聊天紀錄可能在登出後仍保留。來源圖片與圖示備援會連線至媒體或 Google 伺服器，對方可接收 IP 等一般網路請求資訊。')}</p></Section>
      <Section title={tx('Reports and research data', '回報與研究資料')}><p>{tx('An article issue report stores the article reference, reason, message and review status; reporting requires an account, and the report is associated with it. Avoid putting private information in the free-text field. Public evaluation downloads contain aggregate counts and scores with pseudonymous human labels A–D, not student IDs, emails, annotation rationales or article bodies.', '文章問題回報會儲存文章識別、原因、訊息與審查狀態；回報需要登入，並會關聯您的帳號。請勿於自由輸入欄填寫私密資訊。公開評估下載僅包含彙總數量、分數與人工代稱 A–D，不含學號、電子郵件、標註理由或文章內文。')}</p></Section>
      <Section title={ui("Retention and control")}><p>{ui("Account information is retained while your account exists or as needed for security and legal obligations. You can update your profile or delete your account from account settings. Browser-stored preferences can be removed through your browser controls.")}</p></Section>
      <Section title={tx('Export, deletion and email preferences', '匯出、刪除與郵件偏好')}><p>{tx('Account settings provide a data export, email-update preferences, active-session controls and account deletion. The current export includes account fields, bookmarks and posts; it is not a complete export from every external provider. Account deletion requires a NewsAgg password (Google-only accounts must set one first). Deletion does not prove removal from external provider logs or backups. Clear browser site data to remove local preferences and chat history.', '帳號設定提供資料匯出、郵件更新偏好、工作階段控制與刪除帳號。目前匯出包含帳號欄位、書籤與貼文，並非所有外部服務的完整匯出。刪除須使用 NewsAgg 密碼（僅 Google 登入者須先設定密碼）。刪除不代表外部紀錄或備份已全部清除。欲移除本機偏好與聊天紀錄，請清除瀏覽器網站資料。')}</p></Section>
      <Section title={tx('Retention boundaries', '保留期限的範圍')}><p>{tx('The 30-day public news window applies to article visibility and pipeline retention, not a universal deletion deadline for account data, issue reports, browser storage, backups or external provider records. Provider processing may take place outside your location. This policy does not promise a specific storage country or automatic deletion period that the implementation does not enforce.', '新聞公開範圍的 30 天適用於文章顯示及流程保留政策，並非帳號資料、問題回報、瀏覽器儲存、備份或外部服務紀錄的統一刪除期限。外部處理可能位於您所在地之外；本政策不承諾實作未強制執行的特定儲存國家或自動刪除期限。')}</p></Section>
      <Section title={ui("Security")}><p>{ui("NewsAgg uses encrypted connections where available, access controls, rate limits, hashed passwords, and restricted session cookies. No internet service can guarantee absolute security.")}</p></Section>
    </LegalLayout>
  );
}

export function EditorialPolicyPage() {
  const tx = usePolicyText();
  return <LegalLayout icon={Newspaper} title={tx('Editorial & corrections policy', '編輯與更正政策')}>
    <Section title={tx('Purpose and source transparency', '目的與來源透明')}><p>{tx('NewsAgg brings BBC, CNN, Al Jazeera and Yahoo Taiwan into a comparable reading interface. The selection reflects available feeds, language coverage and project scope; it is not a ranking of truth or an endorsement of every article. The service aims to make evidence and source links easier to inspect. It cannot promise a fake-news-free feed.', 'NewsAgg 將 BBC、CNN、Al Jazeera 與 Yahoo 臺灣放入便於比較的閱讀介面。選擇依據為可用來源、語言涵蓋及專案範圍，並非真實性排名或對所有文章的背書。本站希望讓讀者更容易查看證據與來源，但無法保證完全沒有不實新聞。')}</p></Section>
    <Section title={tx('Publication and coverage', '發布與涵蓋範圍')}><p>{tx('Publication checks dates, article body quality, duplicates, topic eligibility and extractive summary evidence. Coverage is not identical across the four publishers; unsupported source/category pairs and unavailable qualifying stories cause gaps. Trending reflects this dataset, not all events in the world. Original reporting remains the primary reference.', '發布檢查日期、正文品質、重複、主題適格性與摘要原句證據。四家媒體涵蓋範圍並不相同，未支援的來源分類及缺少合格文章會造成缺口。熱門話題反映本站資料集，不代表全球所有事件。原始報導仍為主要參考。')}</p></Section>
    <Section title={tx('Corrections workflow', '更正流程')}><p>{tx('Open an article and choose Report an issue. Select sentiment, topic, summary, translation, content or other, and explain the problem. The report is stored for team review. It does not automatically rewrite the article. A source correction, model correction and translation correction are different issues; include enough context to distinguish them.', '開啟文章後選擇「回報問題」，選擇情緒、主題、摘要、翻譯、內容或其他並描述問題。回報會儲存供團隊審查，不會自動改寫文章。媒體原文、模型分析及翻譯更正是不同問題，請提供足夠背景以利辨別。')}</p></Section>
    <Section title={tx('Research integrity', '研究誠信')}><p>{tx('Evaluation snapshots retain their dates and denominators. Human and AI references remain distinguishable; unresolved labels are not silently converted into gold answers. High agreement does not establish independent authorship, and low agreement does not prove independence. Model confidence, software tests and empirical reference agreement measure different things.', '評估快照保留日期與分母；人工與 AI 參考明確區分，未解決的標註不會被默默當作標準答案。高一致度無法證明獨立作答，低一致度也不能證明獨立性。模型信心、軟體測試與實測參考一致程度衡量的是不同事物。')}</p></Section>
    <Section title={tx('Reading and accessibility', '閱讀與可及性')}><p>{tx('Use original-language mode to inspect publisher wording, and the source link to check context. The evaluation tables provide numeric alternatives to their charts and support keyboard focus and horizontal scrolling on small screens. Automatic translation is a reading aid and can alter meaning; compare it with the original for important details.', '使用原文模式查看媒體用詞，並透過來源連結核對脈絡。評估表格提供圖表的數值替代、支援鍵盤焦點及小螢幕水平捲動。自動翻譯為閱讀輔助，可能改變語意；重要細節請與原文對照。')}</p></Section>
  </LegalLayout>;
}
