import React, { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ArthashastraSymbol } from './ArthashastraSymbol';
import { SITE } from '../lib/siteConfig';

/*
 * OWNER: every value shown in [square brackets] comes from src/lib/siteConfig.ts and must be
 * filled in (Vercel env: VITE_LEGAL_ENTITY, VITE_LEGAL_ADDRESS, VITE_CONTACT_EMAIL,
 * VITE_GRIEVANCE_OFFICER, VITE_GRIEVANCE_EMAIL) before launch. Have a lawyer review this text.
 */

const LAST_UPDATED = '27 October 2026';

const hasPlaceholders = () =>
  [SITE.operator, SITE.address, SITE.contactEmail, SITE.grievanceOfficer, SITE.grievanceEmail].some((v) => v.startsWith('['));

interface SectionProps {
  id?: string;
  title: string;
  children: React.ReactNode;
}

const LegalSection: React.FC<SectionProps> = ({ id, title, children }) => (
  <section id={id} className="mb-34 border-l border-neon-cyan/21 pl-21 scroll-mt-21">
    <h2 className="text-13 caps-modern text-neon-cyan mb-13 tracking-widest uppercase">{title}</h2>
    <div className="text-13 text-parchment/89 leading-relaxed font-sans space-y-13">{children}</div>
  </section>
);

const List: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="list-disc pl-21 space-y-8 text-parchment/89">{children}</ul>
);

const Mail: React.FC<{ to: string }> = ({ to }) =>
  to.startsWith('[') ? <span className="text-neon-magenta">{to}</span> : <a href={`mailto:${to}`} className="text-neon-cyan underline">{to}</a>;

const PlaceholderNotice: React.FC = () =>
  hasPlaceholders() ? (
    <div className="mb-34 p-13 border border-neon-magenta/55 bg-neon-magenta/5 rounded-8 text-13 text-neon-magenta">
      Owner notice: the details in [square brackets] are placeholders and must be filled in by the operator before this
      service is offered to the public.
    </div>
  ) : null;

interface ShellProps {
  title: string;
  subtitle: string;
  accent: 'cyan' | 'magenta';
  children: React.ReactNode;
}

const LegalShell: React.FC<ShellProps> = ({ title, subtitle, accent, children }) => {
  // Scroll to #section anchors (e.g. /terms#refunds) after the page renders.
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (hash) document.getElementById(hash)?.scrollIntoView();
  }, []);

  return (
    <div className="min-h-screen bg-void text-parchment p-21 md:p-89 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className={`mb-55 flex flex-col md:flex-row md:items-end justify-between gap-34 border-b pb-34 ${accent === 'cyan' ? 'border-neon-cyan/13' : 'border-neon-magenta/13'}`}>
          <div>
            <div className="mb-21">
              <ArthashastraSymbol size={55} />
            </div>
            <h1 className={`text-34 md:text-55 caps-modern font-bold leading-none tracking-tighter mb-8 ${accent === 'cyan' ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{title}</h1>
            <p className={`text-[11px] font-mono uppercase tracking-[0.2em] ${accent === 'cyan' ? 'text-neon-cyan/55' : 'text-neon-magenta/55'}`}>
              {subtitle} · Last updated {LAST_UPDATED}
            </p>
          </div>
          <nav className="flex flex-col items-start md:items-end gap-8 text-[11px] caps-modern">
            <a href="/" className="flex items-center gap-8 text-parchment/55 hover:text-neon-cyan transition-colors group">
              <ChevronLeft className="w-13 h-13 group-hover:-translate-x-[5px] transition-transform" />
              Back to the app
            </a>
            <span className="flex gap-13 text-parchment/55">
              <a href="/terms" className="hover:text-neon-cyan">Terms</a>
              <a href="/privacy" className="hover:text-neon-cyan">Privacy</a>
              <a href="/terms#refunds" className="hover:text-neon-cyan">Refunds</a>
            </span>
          </nav>
        </header>

        <PlaceholderNotice />

        <main className={`glass-panel p-21 md:p-34 border ${accent === 'cyan' ? 'border-neon-cyan/8 bg-neon-cyan/[0.02]' : 'border-neon-magenta/8 bg-neon-magenta/[0.02]'}`}>{children}</main>

        <footer className={`mt-55 pt-34 border-t text-[11px] font-mono text-parchment/55 flex flex-col md:flex-row gap-8 justify-between ${accent === 'cyan' ? 'border-neon-cyan/13' : 'border-neon-magenta/13'}`}>
          <span>&copy; {new Date().getFullYear()} {SITE.operator}</span>
          <span>
            Contact: <Mail to={SITE.contactEmail} />
          </span>
        </footer>
      </div>
    </div>
  );
};

/** Refund & cancellation policy (shared by the Terms page and the standalone Refund page). */
const RefundSection: React.FC = () => (
  <LegalSection id="refunds" title="Payments, Refunds & Cancellation">
    <p>
      <strong>Price.</strong> The Supporter plan costs <strong>{SITE.priceLabel}</strong>, charged in Indian Rupees (INR). Your bank may
      add currency-conversion or foreign-transaction charges if you pay from outside India; we do not control or receive these.
    </p>
    <p>
      <strong>One-time payment, no auto-renewal.</strong> Each payment gives 30 days of the paid features from the moment the payment is
      confirmed. It is not a subscription that renews: we never charge you again unless you choose to pay again. There is nothing
      to cancel to stop future charges.
    </p>
    <p>
      <strong>Payment processor.</strong> Payments are processed by Razorpay Software Private Limited. Your card, UPI or bank details are
      entered on Razorpay's checkout and are handled by Razorpay; we do not receive or store them. We only keep the order and payment
      reference numbers, the amount, the status and the date.
    </p>
    <p>
      <strong>Refunds.</strong> If you were charged but could not use the paid features (for example the plan was not activated, the
      service was unavailable for most of your 30 days, or you were charged twice), email <Mail to={SITE.contactEmail} /> within
      <strong> 7 days</strong> of the payment with your registered email address and the Razorpay payment ID. If the request is valid we
      will approve a full refund. Approved refunds are sent to the original payment method within <strong>5–7 working days</strong>
      (your bank may take a little longer to show it).
    </p>
    <p>
      Apart from the cases above, a 30-day plan that has been activated and used is not refundable, because the AI costs are incurred
      as you use it. Nothing in this policy limits any refund right you have under applicable consumer-protection law.
    </p>
    <p>
      <strong>Cancellation.</strong> You may stop using the service or delete your account at any time. Because plans do not renew,
      no cancellation step is needed to avoid future charges. Unused days are not refunded except as described above.
    </p>
  </LegalSection>
);

const GrievanceSection: React.FC<{ id?: string }> = ({ id }) => (
  <LegalSection id={id} title="Grievance Officer & Contact">
    <p>
      In line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital
      Personal Data Protection Act, 2023, you can raise any complaint about the service, its content or your personal data with our
      Grievance Officer:
    </p>
    <List>
      <li>Name: {SITE.grievanceOfficer}</li>
      <li>
        Email: <Mail to={SITE.grievanceEmail} />
      </li>
      <li>Address: {SITE.address}</li>
    </List>
    <p>
      We acknowledge complaints within <strong>24 hours</strong> and aim to resolve them within <strong>15 days</strong> of receipt.
      Requests to remove content that is clearly unlawful or that exposes someone's private information are acted on as quickly as
      possible, and in any case within the time limits set by those Rules. If you are in India and are not satisfied with our response
      on a personal-data matter, you may complain to the Data Protection Board of India.
    </p>
    <p>
      General questions: <Mail to={SITE.contactEmail} />. Operator: {SITE.operator}, {SITE.address}.
    </p>
  </LegalSection>
);

export const TermsPage: React.FC = () => (
  <LegalShell title="Terms of Use" subtitle={SITE.name} accent="cyan">
    <LegalSection title="1. Who we are and what this is">
      <p>
        {SITE.name} (“the service”, “we”, “us”) is operated by {SITE.operator}, {SITE.address}. It is a website that uses artificial
        intelligence to explain economic and money matters that affect ordinary people — prices, fees, loans, taxes, scams and
        similar topics — anywhere in the world. Features include an AI chat, a public discussion forum (“the Arena”), a daily
        AI-written news summary (“the Gazette”), an “Economic Risk Radar” and short intelligence reports.
      </p>
      <p>By using the service you agree to these Terms and to our <a href="/privacy" className="text-neon-cyan underline">Privacy Policy</a>. If you do not agree, please do not use it.</p>
    </LegalSection>

    <LegalSection title="2. AI-generated content — please read">
      <List>
        <li>Answers, verdicts, reports and news summaries on this service are written by an AI model (Google Gemini) and are labelled AI-generated.</li>
        <li>AI can be wrong, incomplete, out of date or biased, and can misread its sources. We do not guarantee the accuracy, completeness or timeliness of any content.</li>
        <li>Where the AI used web sources, links are listed under “Sources”. Always check the sources yourself before relying on or sharing anything.</li>
        <li>
          <strong>Nothing on this service is financial, investment, tax, legal or other professional advice</strong>, and nothing is a
          recommendation to buy, sell or hold any security or financial product. We are not registered with SEBI or any other regulator
          as an investment adviser or research analyst. Talk to a qualified professional before making decisions.
        </li>
        <li>Content about governments, companies or people reflects AI analysis of public reports, not established fact or our accusation.</li>
      </List>
    </LegalSection>

    <LegalSection title="3. Accounts and eligibility">
      <p>
        You may browse some parts as a guest. Posting in the Arena, saving chats and paying require signing in with a Google account.
        You are responsible for activity on your account. The service is meant for people aged 18 or over; if you are under 18 you may
        use it only with the consent and supervision of a parent or legal guardian.
      </p>
    </LegalSection>

    <LegalSection title="4. Acceptable use">
      <p>You agree not to:</p>
      <List>
        <li>harass, threaten, abuse or defame anyone, or post hateful content;</li>
        <li>post anything illegal, including content that infringes others' rights or exposes someone's private information;</li>
        <li>impersonate others, spread content you know to be false, or post spam or advertising;</li>
        <li>try to break, overload, scrape or get around the limits or security of the service, or misuse the AI to produce harmful content.</li>
      </List>
      <p>
        <strong>Arena posts are public.</strong> Your argument, replies and display name (your Google name, or a “Citizen-…” pseudonym)
        can be read by other signed-in users. Do not post personal details. You keep ownership of what you post, but you allow us to
        display it within the service. You can delete your own debates. We may remove content or suspend accounts that break these
        Terms or the law.
      </p>
    </LegalSection>

    <RefundSection />

    <LegalSection title="6. Free limits and availability">
      <p>
        Free use has daily limits, and paid plans have higher limits. We may change features and limits, and the service may sometimes
        be unavailable (for example if the AI provider is busy). We do not promise uninterrupted service.
      </p>
    </LegalSection>

    <LegalSection title="7. Limitation of liability">
      <p>
        The service is provided “as is”. To the extent the law allows, we are not liable for any loss arising from your use of, or
        reliance on, the service or its AI-generated content, including financial or investment losses. Where liability cannot be
        excluded, our total liability is limited to the amount you paid us in the 3 months before the claim. Nothing here limits
        rights you have that cannot be limited by law.
      </p>
    </LegalSection>

    <LegalSection title="8. Your data">
      <p>
        How we handle personal data is explained in the <a href="/privacy" className="text-neon-cyan underline">Privacy Policy</a>. You
        can export or delete your saved chats from inside the app at any time.
      </p>
    </LegalSection>

    <GrievanceSection />

    <LegalSection title="10. Changes, governing law and disputes">
      <p>
        We may update these Terms; the date at the top shows the latest version, and important changes will be announced in the app.
        Continuing to use the service after a change means you accept it.
      </p>
      <p>
        These Terms are governed by {SITE.governingLaw}. Subject to any mandatory consumer-protection rights you have where you live,
        disputes will be subject to the jurisdiction of the courts at the place of the operator's registered address in India. Please
        contact us first — most problems can be solved quickly by email.
      </p>
    </LegalSection>
  </LegalShell>
);

/** Standalone refund & cancellation page (e.g. for /refunds). The same text is on /terms#refunds. */
export const RefundPage: React.FC = () => (
  <LegalShell title="Refund & Cancellation Policy" subtitle={SITE.name} accent="cyan">
    <RefundSection />
    <LegalSection title="Contact">
      <p>
        Refund questions: <Mail to={SITE.contactEmail} />. Complaints: Grievance Officer {SITE.grievanceOfficer}, <Mail to={SITE.grievanceEmail} />. Operator: {SITE.operator}, {SITE.address}.
      </p>
    </LegalSection>
  </LegalShell>
);

export const PrivacyPage: React.FC = () => (
  <LegalShell title="Privacy Policy" subtitle={SITE.name} accent="magenta">
    <LegalSection title="1. Who is responsible">
      <p>
        {SITE.operator}, {SITE.address}, is the “Data Fiduciary” (data controller) for personal data processed by {SITE.name}. This
        policy is written to meet India's Digital Personal Data Protection Act, 2023 (DPDP Act) and also applies to users elsewhere in
        the world. Contact: <Mail to={SITE.contactEmail} />.
      </p>
    </LegalSection>

    <LegalSection title="2. What we collect">
      <List>
        <li><strong>Account data:</strong> when you sign in with Google — your Google user ID, name, email address and profile photo link. Guests get an anonymous ID only.</li>
        <li><strong>Your chats:</strong> the questions you ask and the AI's answers, if you are signed in (stored so you can see your history).</li>
        <li><strong>Arena content:</strong> your arguments, replies, likes and the display name shown with them. These are public to other signed-in users.</li>
        <li><strong>Risk Radar reports</strong> you generate, saved to your account.</li>
        <li><strong>Payment records:</strong> Razorpay order and payment IDs, amount, currency, status and dates, and your plan's end date. Card, UPI and bank details are collected and handled by Razorpay, not stored by us.</li>
        <li><strong>Usage data:</strong> daily counts of AI requests and explanation views (to apply free limits), and basic technical logs (such as IP address and browser type) kept by our hosting providers for security.</li>
      </List>
      <p>We do not sell your data and we do not show ads.</p>
    </LegalSection>

    <LegalSection title="3. Why we use it">
      <List>
        <li>to sign you in and keep your chats, debates and reports;</li>
        <li>to generate AI answers to your questions;</li>
        <li>to process payments and activate your plan;</li>
        <li>to apply fair-use limits, prevent abuse and keep the service secure;</li>
        <li>to answer your requests and complaints, and to meet legal obligations.</li>
      </List>
      <p>
        We process your data on the basis of your consent (given when you sign in and use the features) and, for payments, security
        and legal compliance, for those legitimate and legally required purposes.
      </p>
    </LegalSection>

    <LegalSection title="4. Who processes it for us">
      <List>
        <li><strong>Google Firebase / Google Cloud</strong> — sign-in, database and hosting of your data.</li>
        <li>
          <strong>Google Gemini API</strong> — to produce answers, your question (and recent messages in that chat or debate) is sent to
          Google to generate the reply. Do not include sensitive personal information in questions.
        </li>
        <li><strong>Razorpay</strong> — payment processing.</li>
        <li><strong>Our web hosting provider</strong> (e.g. Vercel) — serving the website and API.</li>
        <li><strong>Google Fonts</strong> — the site loads fonts from Google's servers, which receive your IP address.</li>
      </List>
      <p>These providers process data on our instructions and under their own security and privacy commitments.</p>
    </LegalSection>

    <LegalSection title="5. Cross-border processing">
      <p>
        Our providers may store and process data on servers outside India (for example in the United States or the European Union),
        and users outside India will have their data processed in India and other countries. We transfer data only as permitted under
        the DPDP Act and any restrictions notified by the Government of India.
      </p>
    </LegalSection>

    <LegalSection title="6. How long we keep it">
      <List>
        <li>Chats, debates and reports: until you delete them or your account.</li>
        <li>Public share links: until you (or we, on request) remove them.</li>
        <li>Payment records: as long as required by tax and accounting law (generally up to 8 years in India).</li>
        <li>Usage counts and security logs: for a limited period, normally no more than 1 year.</li>
      </List>
      <p>When data is no longer needed for its purpose, we delete it, unless the law requires us to keep it.</p>
    </LegalSection>

    <LegalSection title="7. Your rights">
      <List>
        <li><strong>Access and export:</strong> use the in-app data export tool to download your chats, or ask us for a summary of your data.</li>
        <li><strong>Correction:</strong> ask us to correct inaccurate data. Your name comes from your Google account.</li>
        <li><strong>Erasure:</strong> delete chats and your own debates in the app, or ask us to delete your account and data.</li>
        <li><strong>Withdraw consent:</strong> stop using the service and ask us to delete your data. Withdrawal does not affect processing already done.</li>
        <li><strong>Grievance redressal</strong> and, in India, the right to nominate someone to act for you in case of death or incapacity.</li>
      </List>
      <p>
        Send requests to <Mail to={SITE.grievanceEmail} /> from your registered email. We respond within 15 days. People in other
        countries may have additional rights under their local law (for example the GDPR); we will honour them on request.
      </p>
    </LegalSection>

    <LegalSection title="8. Children">
      <p>
        The service is not meant for children under 18. If you are under 18, you may use it only with verifiable consent from a parent
        or legal guardian. We do not knowingly track children or target them with advertising. If you believe a child has given us data
        without consent, contact us and we will delete it.
      </p>
    </LegalSection>

    <LegalSection title="9. Security">
      <p>
        Data is sent over encrypted connections (HTTPS), and database access is restricted by security rules so each user can read only
        their own private data. No system is perfectly secure; if a personal-data breach affects you, we will notify you and the Data
        Protection Board of India as the law requires.
      </p>
    </LegalSection>

    <GrievanceSection />

    <LegalSection title="11. Changes and governing law">
      <p>
        We may update this policy; the date at the top shows the latest version, and important changes will be announced in the app.
        This policy is governed by {SITE.governingLaw}.
      </p>
    </LegalSection>
  </LegalShell>
);
