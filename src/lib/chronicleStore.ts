import { db } from './firebase';
import { collection, query, orderBy, limit, doc, getDoc, getDocs } from 'firebase/firestore';
import { chronicleToday, Source } from './api';

export interface ChronicleStory {
  title: string;
  whatHappened: string;
  /** How ordinary people are affected (older editions stored this as whoPays). */
  effectOnPeople: string;
  region: string;
  verdict?: 'confirmed' | 'corrected';
  verificationNote?: string;
  sources: Source[];
}

export interface Chronicle {
  id: string; // YYYY-MM-DD
  date: string;
  status: 'ready' | 'generating' | 'failed';
  headline: string;
  summary: string;
  stories: ChronicleStory[];
  sources: Source[];
  createdAt?: unknown;
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

const cleanSources = (v: unknown): Source[] =>
  (Array.isArray(v) ? v : [])
    .filter((s: any) => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url))
    .map((s: any) => ({ title: str(s.title, s.url) || s.url, url: s.url }));

/** Turns any stored/returned document into a safe Chronicle (missing fields never crash the UI). */
export function normalizeChronicle(raw: any, fallbackId = ''): Chronicle {
  const r = raw && typeof raw === 'object' ? raw : {};
  const date = str(r.date, str(r.id, fallbackId));
  const status = r.status === 'generating' || r.status === 'failed' ? r.status : r.status === 'ready' ? 'ready' : 'failed';
  return {
    id: str(r.id, date),
    date,
    status,
    headline: str(r.headline),
    summary: str(r.summary),
    stories: (Array.isArray(r.stories) ? r.stories : [])
      .filter((s: any) => s && typeof s === 'object')
      .map((s: any) => ({
        title: str(s.title),
        whatHappened: str(s.whatHappened),
        effectOnPeople: str(s.effectOnPeople, str(s.whoPays)),
        region: str(s.region, 'Global') || 'Global',
        verdict: s.verdict === 'confirmed' || s.verdict === 'corrected' ? s.verdict : undefined,
        verificationNote: str(s.verificationNote) || undefined,
        sources: cleanSources(s.sources),
      })),
    sources: cleanSources(r.sources),
    createdAt: r.createdAt,
  };
}

/** Reads one day's edition. Public: works for logged-out visitors (share links). */
export async function getChronicle(dateId: string): Promise<Chronicle | null> {
  const snap = await getDoc(doc(db, 'chronicles', dateId));
  if (!snap.exists()) return null;
  return normalizeChronicle({ id: snap.id, ...snap.data() }, snap.id);
}

/** The last 30 days of editions, newest first (only finished ones). */
export async function getRecentChronicles(): Promise<Chronicle[]> {
  try {
    const snap = await getDocs(query(collection(db, 'chronicles'), orderBy('date', 'desc'), limit(30)));
    return snap.docs
      .map((d) => normalizeChronicle({ id: d.id, ...d.data() }, d.id))
      .filter((c) => c.status === 'ready');
  } catch (error) {
    console.error('[ChronicleStore] Could not load recent editions:', error);
    return [];
  }
}

/** Asks the server for today's edition (it generates it once per day for everyone). */
export async function requestTodayChronicle(): Promise<Chronicle> {
  const raw = await chronicleToday();
  return normalizeChronicle(raw, raw?.date || '');
}
