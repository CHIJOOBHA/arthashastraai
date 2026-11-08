/**
 * Speak-your-question support using the browser's built-in speech recognition
 * (Chrome / Edge / Android Chrome / Safari). Nothing is sent to our server:
 * the browser turns speech into text, and the user still presses Send.
 * If the browser has no speech recognition, `supported` is false and the
 * microphone button is simply not shown.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** App language code → speech-recognition locale. */
const LOCALES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const getCtor = (): (new () => Recognition) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export function useVoiceInput(language: string, onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const supported = !!getCtor();

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    recRef.current?.abort();
    setError('');
    const rec = new Ctor();
    rec.lang = LOCALES[language] || 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTextRef.current((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      const code = String(e?.error || '');
      if (code === 'not-allowed' || code === 'service-not-allowed') setError('mic-blocked');
      else if (code !== 'aborted' && code !== 'no-speech') setError('failed');
    };
    rec.onend = () => {
      setListening(false);
      if (recRef.current === rec) recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('failed');
    }
  }, [language]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
