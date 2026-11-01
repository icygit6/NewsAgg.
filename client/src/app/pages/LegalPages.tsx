import { useUiText } from '../i18n/uiText';
import type { ReactNode } from 'react';
import { FileText, Newspaper, ShieldCheck, type LucideIcon } from 'lucide-react';
import { DocLayout, DocSection } from '../components/ui/DocLayout';

function LegalLayout({ title, icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  const ui = useUiText();
  return <DocLayout icon={icon} title={title} meta={ui("Effective October 15, 2026")} back={ui("Return to NewsAgg")}>{children}</DocLayout>;
}

const Section = DocSection;

export function TermsPage() {
  const ui = useUiText();
  return (
    <LegalLayout icon={FileText} title={ui("Terms of Service")}>
      <Section title={ui("Using NewsAgg")}><p>{ui("NewsAgg provides aggregated news, summaries, sentiment analysis, and optional community and AI features for informational purposes. You must use the service lawfully and may not disrupt it, automate abusive traffic, impersonate others, or post unlawful or harmful material.")}</p></Section>
      <Section title={ui("Accounts")}><p>{ui("You are responsible for activity under your account and for keeping your sign-in methods secure. We may restrict accounts that abuse the service or other users. You may delete your account from account settings.")}</p></Section>
      <Section title={ui("News and AI content")}><p>{ui("Original articles, images and trademarks belong to their publishers and creators. NewsAgg summaries are sentences extracted from the original article; sentiment, topics, translations and chat answers are automated. All of them can contain errors and none is financial, legal, medical or other professional advice. Follow the source link before relying on important information.")}</p></Section>
      <Section title={ui("Community content")}><p>{ui("You retain ownership of posts you submit and grant NewsAgg permission to display them as part of the service. Do not post content you lack permission to share.")}</p></Section>
      <Section title={ui('Source attribution and permitted use')}><p>{ui('NewsAgg is an academic aggregation and NLP project, not the publisher of the linked reporting. Source names, dates and links remain attached to articles. Display on NewsAgg does not grant permission to republish publisher text or images. Follow the original publisher’s conditions and respect access restrictions; do not use this service to bypass them.')}</p></Section>
      <Section title={ui('Interpreting analytical results')}><p>{ui('Sentiment, model confidence, topic scores and keyword counts are analytical outputs. They do not certify truth, neutrality or completeness. The research dashboard reports agreement on a dated sample; it must not be quoted as final site-wide accuracy. Quotas are collection targets and do not guarantee equal coverage.')}</p></Section>
      <Section title={ui('Reporting problems')}><p>{ui('For an article error or rights concern, use Report an issue on the relevant article and select the closest reason, or Other. Include the source link and a concise description. Do not submit passwords, API keys or sensitive personal details. Reports enter a review queue; submission does not automatically remove or change content and no response time is guaranteed.')}</p></Section>
      <Section title={ui("Availability and liability")}><p>{ui("The service is provided on an “as available” basis without a guarantee of uninterrupted operation. To the extent allowed by law, NewsAgg is not liable for losses caused by reliance on aggregated, third-party, or AI-generated content.")}</p></Section>
      <Section title={ui("Changes")}><p>{ui("These terms may be updated as the service evolves. Continued use after an updated effective date means you accept the revised terms.")}</p></Section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  const ui = useUiText();
  return (
    <LegalLayout icon={ShieldCheck} title={ui("Privacy Policy")}>
      <Section title={ui("Information we process")}><p>{ui("When you create an account, NewsAgg stores your email address, username, authentication details, profile settings, bookmarks, and posts. Passwords are stored only as cryptographic hashes. Google sign-in is used only to verify identity and link the account you approve.")}</p></Section>
      <Section title={ui("How information is used")}><p>{ui("We use this information to operate authentication, save your account settings and bookmarks, display posts, prevent abuse, troubleshoot failures, and improve service reliability.")}</p></Section>
      <Section title={ui("Cookies and local storage")}><p>{ui("An essential HttpOnly session cookie keeps you signed in. Active-session records include limited browser and IP information so you can recognize devices and revoke access. Theme, language, news-language mode, cached profile display and per-article chat history may be stored locally in your browser. NewsAgg does not use these features for advertising tracking.")}</p></Section>
      <Section title={ui("Service providers")}><p>{ui("NewsAgg uses these providers: a self-hosted PostgreSQL database; Cloudflare for the secure tunnel and Turnstile CAPTCHA; Google for sign-in and Gemini translation; Lingva as a short-text translation fallback; Groq for AI chat, which receives your question and up to four passages of the article you are reading; an SMTP provider for account and digest email; and error monitoring when it is enabled. Each provider processes data under its own terms.")}</p></Section>
      <Section title={ui('Translation, chat and external content')}><p>{ui('With Translate news off, news stays in its original language. Requesting a translation sends the required article text to a translation provider; successful results may be cached in the database. Article chat sends your question, selected article passages and relevant conversation turns to Groq. Chat history stored in this browser can remain after signing out. Source images and favicon fallbacks can contact publisher or Google servers, which receive normal network request information such as your IP address.')}</p></Section>
      <Section title={ui('Reports and research data')}><p>{ui('An article issue report stores the article reference, reason, message and review status; reporting requires an account, and the report is associated with it. Avoid putting private information in the free-text field. Public evaluation downloads contain aggregate counts and scores with pseudonymous human labels A–D, not student IDs, emails, annotation rationales or article bodies.')}</p></Section>
      <Section title={ui("Retention and control")}><p>{ui("Account information is retained while your account exists or as needed for security and legal obligations. You can update your profile or delete your account from account settings. Browser-stored preferences can be removed through your browser controls.")}</p></Section>
      <Section title={ui('Export, deletion and email preferences')}><p>{ui('Account settings provide a data export, email-update preferences, active-session controls and account deletion. The current export includes account fields, bookmarks and posts; it is not a complete export from every external provider. Account deletion requires a NewsAgg password (Google-only accounts must set one first). Deletion does not prove removal from external provider logs or backups. Clear browser site data to remove local preferences and chat history.')}</p></Section>
      <Section title={ui('Retention boundaries')}><p>{ui('The 30-day public news window applies to article visibility and pipeline retention, not a universal deletion deadline for account data, issue reports, browser storage, backups or external provider records. Provider processing may take place outside your location. This policy does not promise a specific storage country or automatic deletion period that the implementation does not enforce.')}</p></Section>
      <Section title={ui("Security")}><p>{ui("NewsAgg uses encrypted connections where available, access controls, rate limits, hashed passwords, and restricted session cookies. No internet service can guarantee absolute security.")}</p></Section>
    </LegalLayout>
  );
}

export function EditorialPolicyPage() {
  const ui = useUiText();
  return <LegalLayout icon={Newspaper} title={ui('Editorial & corrections policy')}>
    <Section title={ui('Purpose and source transparency')}><p>{ui('NewsAgg brings BBC, CNN, Al Jazeera and Yahoo Taiwan into a comparable reading interface. The selection reflects available feeds, language coverage and project scope; it is not a ranking of truth or an endorsement of every article. The service aims to make evidence and source links easier to inspect. It cannot promise a fake-news-free feed.')}</p></Section>
    <Section title={ui('Publication and coverage')}><p>{ui('Publication checks dates, article body quality, duplicates, topic eligibility and extractive summary evidence. Coverage is not identical across the four publishers; unsupported source/category pairs and unavailable qualifying stories cause gaps. Trending reflects this dataset, not all events in the world. Original reporting remains the primary reference.')}</p></Section>
    <Section title={ui('Corrections workflow')}><p>{ui('Open an article and choose Report an issue. Select sentiment, topic, summary, translation, content or other, and explain the problem. The report is stored for team review. It does not automatically rewrite the article. A source correction, model correction and translation correction are different issues; include enough context to distinguish them.')}</p></Section>
    <Section title={ui('Research integrity')}><p>{ui('Evaluation snapshots retain their dates and denominators. Human and AI references remain distinguishable; unresolved labels are not silently converted into gold answers. High agreement does not establish independent authorship, and low agreement does not prove independence. Model confidence, software tests and empirical reference agreement measure different things.')}</p></Section>
    <Section title={ui('Reading and accessibility')}><p>{ui('Use original-language mode to inspect publisher wording, and the source link to check context. The evaluation tables provide numeric alternatives to their charts and support keyboard focus and horizontal scrolling on small screens. Automatic translation is a reading aid and can alter meaning; compare it with the original for important details.')}</p></Section>
  </LegalLayout>;
}
