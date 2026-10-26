/**
 * Browser client for the Arthashastra server API.
 * Every call sends the signed-in user's Firebase ID token.
 * No prompts, models or keys live in the browser.
 */
import { authHeaders } from './firebase';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** User-friendly fallback messages per error code. */
const FRIENDLY: Record<string, string> = {
  AUTH_REQUIRED: 'Please sign in first.',
  DAILY_LIMIT: 'You have reached today\'s limit.',
  RATE_LIMITED: 'Too many requests. Please wait a minute.',
  RESOURCE_EXHAUSTED: 'The AI is busy right now. Please try again later.',
  AI_UNAVAILABLE: 'The AI could not answer right now. Please try again in a minute.',
  CONFIGURATION_REQUIRED: 'The server is not fully configured yet.',
  DATABASE_UNAVAILABLE: 'The database is not configured yet.',
  PAYWALL: 'You have used your free explanations. Subscribe to read more.',
  NETWORK: 'Network problem. Check your connection and try again.',
};

async function toApiError(res: Response): Promise<ApiError> {
  let code = `HTTP_${res.status}`;
  let message = '';
  try {
    const body = await res.json();
    code = body.code || code;
    message = body.error || '';
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, code, message || FRIENDLY[code] || 'Something went wrong. Please try again.');
}

async function request<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.auth !== false) Object.assign(headers, await authHeaders());
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method || (init.body ? 'POST' : 'GET'),
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', FRIENDLY.NETWORK);
  }
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export type ChatTurn = { role: 'user' | 'model'; parts: { text: string }[] };

/**
 * Streams a chat answer. The final chunk contains a "Sources" block with the
 * real web links the answer was based on.
 */
export async function* streamChat(history: ChatTurn[], message: string, language: string): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ history, message, language }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', FRIENDLY.NETWORK);
  }
  if (!res.ok) throw await toApiError(res);
  const reader = res.body?.getReader();
  if (!reader) throw new ApiError(0, 'NETWORK', FRIENDLY.NETWORK);
  // stream:true keeps multi-byte characters (Telugu, Hindi, Chinese...) intact across chunks.
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) yield text;
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

export interface Me {
  uid: string;
  isAdmin: boolean;
  isAnonymous: boolean;
  isSubscribed: boolean;
  subscriptionExpiresAt: string | null;
  explanationViewCount: number;
  freeExplanations: number;
  usedToday: number;
}
export const getMe = () => request<Me>('/api/me');

export interface Health {
  status: 'active' | 'warn' | 'unconfigured';
  geminiConfigured: boolean;
  firestoreReady: boolean;
  databaseId: string;
  paymentsConfigured: boolean;
  missingKeys: string[];
}
export const getHealth = () => request<Health>('/api/health', { auth: false });

export interface Source { title: string; url: string }

export const arenaReply = (debateId: string, language: string) =>
  request<{ id: string; text: string; kind: 'verdict' | 'reply' }>('/api/arena/reply', { body: { debateId, language } });

export const riskRadar = (language: string, focus?: string) =>
  request<{ id: string; content: string; sources: Source[] }>('/api/risk-radar', { body: { language, focus } });

export interface Chronicle {
  id: string;
  date: string;
  status: 'ready' | 'generating' | 'failed';
  headline?: string;
  summary?: string;
  stories?: { title: string; whatHappened: string; whoPays: string; region: string }[];
  sources?: Source[];
  createdAt?: unknown;
}
/** Returns today's Gazette, generating it on the server if needed (status "generating" means retry shortly). */
export const chronicleToday = () => request<Chronicle>('/api/chronicle/today', { body: {} });

export interface ExplanationResponse {
  explanation: { id: string; content: string; sources?: Source[]; timestamp?: string };
  isSubscribed: boolean;
  remainingFree: number | null;
}
export const getExplanation = (id: string) => request<ExplanationResponse>(`/api/explanations/${encodeURIComponent(id)}`);

export const shareConversation = (conversationId: string) =>
  request<{ id: string; url: string }>('/api/share', { body: { conversationId } });

export const createOrder = () =>
  request<{ id: string; amount: number; currency: string; keyId: string }>('/api/payments/create-order', { body: {} });

export const verifyPayment = (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
  request<{ status: 'active'; expiresAt: string }>('/api/payments/verify', { body: r });

/** Admin only: runs one agent cycle now. */
export const runAgentCycle = () =>
  request<{ status: string; ran: string[]; published: number; skipped?: string }>('/api/admin/run-cycle', { body: {} });
