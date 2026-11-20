// Spoken Hebrew.
//
// At three, hearing the word is half the game: "אדום", "שלוש", "ארנב". The words
// on screen are for the grown-up; the voice is for her.
//
// Two engines, whichever exists:
//   * Inside the Android app, the native text-to-speech plugin. Android's
//     WebView has no speechSynthesis at all, so without this the app is mute.
//   * In a browser, the Web Speech API - but only with a real Hebrew voice. An
//     English voice reading Hebrew letters is gibberish, so with no Hebrew voice
//     it simply stays quiet and the game carries on with music and effects.

import { state } from '../core/state.js';

let heVoice = null;
let lastText = '';
let lastAt = 0;

function findVoice() {
  const ss = globalThis.speechSynthesis;
  if (!ss) return;
  const all = ss.getVoices?.() || [];
  heVoice = all.find((v) => /^(he|iw)([-_]|$)/i.test(v.lang)) || null;
}

if (globalThis.speechSynthesis) {
  findVoice();
  globalThis.speechSynthesis.addEventListener?.('voiceschanged', findVoice);
}

const nativeTts = () => globalThis.Capacitor?.Plugins?.TextToSpeech || null;

export const canSpeak = () => !!nativeTts() || !!heVoice;

// Says `text` now, cutting off whatever was being said - a three year old taps
// faster than anyone talks, and the newest word is the one she is looking at.
export function speak(text, { rate = 0.92, pitch = 1.12, music = null } = {}) {
  if (!text || state.muted) return;
  const now = performance.now();
  // The same word twice inside half a second is a double tap, not a request.
  if (text === lastText && now - lastAt < 500) return;
  lastText = text;
  lastAt = now;
  // Pull the soundtrack down so the word is heard over it.
  music?.duck(0.45, 1.1);

  const tts = nativeTts();
  if (tts) {
    Promise.resolve(tts.stop?.()).catch(() => {}).then(() =>
      tts.speak({ text, lang: 'he-IL', rate, pitch, volume: 1, category: 'playback' })
    ).catch(() => {});
    return;
  }
  const ss = globalThis.speechSynthesis;
  if (!ss || !heVoice) return;
  try {
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = heVoice;
    u.lang = heVoice.lang;
    u.rate = rate;
    u.pitch = pitch;
    ss.speak(u);
  } catch { /* speech is a bonus, never a requirement */ }
}

// Counting in the feminine form, which is how numbers are said aloud when
// counting in Hebrew ("אחת, שתיים, שלוש").
export const NUMBERS = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
