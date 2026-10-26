/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top-level router. Public pages (legal, Gazette, shared transcripts) render
 * without the main app; everything else renders <MainApp/>. Keeping the route
 * switch here means MainApp's hooks always run in the same order.
 */

import { TermsPage, PrivacyPage, RefundPage } from './components/LegalPages';
import { ArthashastraGazette } from './components/ArthashastraGazette';
import { SharedTranscript } from './components/SharedTranscript';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainApp } from './components/MainApp';
import { useAuthUser } from './lib/firebase';
import { navigate, usePathname } from './hooks/useRoute';

function PublicGazette({ date }: { date?: string }) {
  const user = useAuthUser();
  return <ArthashastraGazette initialDate={date} user={user} />;
}

export default function App() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/terms') return <TermsPage />;
  if (pathname === '/refunds') return <RefundPage />;
  if (segments[0] === 'gazette') {
    return (
      <ErrorBoundary>
        <PublicGazette date={segments[1] ? decodeURIComponent(segments[1]) : undefined} />
      </ErrorBoundary>
    );
  }
  if (segments[0] === 'share' && segments[1]) {
    return (
      <ErrorBoundary>
        <SharedTranscript sharedId={decodeURIComponent(segments[1])} />
      </ErrorBoundary>
    );
  }

  const explanationId =
    segments[0] === 'explanation' && segments[1] && /^[A-Za-z0-9_-]{1,128}$/.test(segments[1]) ? segments[1] : undefined;

  return (
    <MainApp
      explanationId={explanationId}
      onExplanationRouteHandled={() => navigate('/', { replace: true })}
    />
  );
}
