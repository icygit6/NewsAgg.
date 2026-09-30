import { useUiText } from '../i18n/uiText';
import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { useApp } from '../contexts/AppContext';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const ui = useUiText();
  const { isDark } = useApp();
  return (
    <article className={`mx-auto max-w-3xl px-5 py-10 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
      <h1 className={`mb-2 text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>{title}</h1>
      <p className="mb-8 text-sm text-slate-500">{ui("Effective September 17, 2026")}</p>
      <div className="space-y-7">{children}</div>
      <p className="mt-10 text-sm"><Link className="text-blue-600 hover:underline" to="/">{ui("Return to NewsAgg")}</Link></p>
    </article>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="mb-2 text-xl font-semibold">{title}</h2>
    <div className="space-y-2">{children}</div>
  </section>
);

export function TermsPage() {
  const ui = useUiText();
  return (
    <LegalLayout title={ui("Terms of Service")}>
      <Section title={ui("Using NewsAgg")}><p>{ui("NewsAgg provides aggregated news, summaries, sentiment analysis, and optional community and AI features for informational purposes. You must use the service lawfully and may not disrupt it, automate abusive traffic, impersonate others, or post unlawful or harmful material.")}</p></Section>
      <Section title={ui("Accounts")}><p>{ui("You are responsible for activity under your account and for keeping your sign-in methods secure. We may restrict accounts that abuse the service or other users. You may delete your account from account settings.")}</p></Section>
      <Section title={ui("News and AI content")}><p>{ui("Original articles, images, and trademarks belong to their respective publishers and creators. NewsAgg analysis and AI-generated summaries may contain errors and are not financial, legal, medical, or other professional advice. Follow the source link before relying on important information.")}</p></Section>
      <Section title={ui("Community content")}><p>{ui("You retain ownership of posts you submit and grant NewsAgg permission to display them as part of the service. Do not post content you lack permission to share.")}</p></Section>
      <Section title={ui("Availability and liability")}><p>{ui("The service is provided on an “as available” basis without a guarantee of uninterrupted operation. To the extent allowed by law, NewsAgg is not liable for losses caused by reliance on aggregated, third-party, or AI-generated content.")}</p></Section>
      <Section title={ui("Changes")}><p>{ui("These terms may be updated as the service evolves. Continued use after an updated effective date means you accept the revised terms.")}</p></Section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  const ui = useUiText();
  return (
    <LegalLayout title={ui("Privacy Policy")}>
      <Section title={ui("Information we process")}><p>{ui("When you create an account, NewsAgg stores your email address, username, authentication details, profile settings, bookmarks, and posts. Passwords are stored only as cryptographic hashes. Google sign-in is used only to verify identity and link the account you approve.")}</p></Section>
      <Section title={ui("How information is used")}><p>{ui("We use this information to operate authentication, personalize your account, save bookmarks, display posts, prevent abuse, troubleshoot failures, and improve service reliability.")}</p></Section>
      <Section title={ui("Cookies and local storage")}><p>{ui("An essential HttpOnly session cookie keeps you signed in. Active-session records include limited browser and IP information so you can recognize devices and revoke access. Theme, language, cached profile display, and per-article chat history may be stored locally in your browser. NewsAgg does not use these features for advertising tracking.")}</p></Section>
      <Section title={ui("Service providers")}><p>{ui("NewsAgg may process limited data through infrastructure and feature providers used for database hosting, email delivery, CAPTCHA, Google sign-in, translation, AI chat, error monitoring, and secure tunneling. Each provider processes data under its own terms.")}</p></Section>
      <Section title={ui("Retention and control")}><p>{ui("Account information is retained while your account exists or as needed for security and legal obligations. You can update your profile or delete your account from account settings. Browser-stored preferences can be removed through your browser controls.")}</p></Section>
      <Section title={ui("Security")}><p>{ui("NewsAgg uses encrypted connections where available, access controls, rate limits, hashed passwords, and restricted session cookies. No internet service can guarantee absolute security.")}</p></Section>
    </LegalLayout>
  );
}
