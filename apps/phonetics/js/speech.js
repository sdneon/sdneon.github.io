// Reading aloud (Web Speech API), preferring offline voices. Shared by both pages.
(function (g) {
'use strict';
const has = 'speechSynthesis' in g;

// Best voice: exact language offline, then same language offline, then the same online.
function pickVoice(code) {
  if (!has || !code) return null;
  const vs = speechSynthesis.getVoices().map(v => ({ v, l: v.lang.replace('_', '-') }));
  const two = code.slice(0, 2);
  const tests = [x => x.v.localService && x.l === code, x => x.v.localService && x.l.startsWith(two),
    x => x.l === code, x => x.l.startsWith(two)];
  for (const t of tests) { const f = vs.find(t); if (f) return f.v; }
  return null;
}

function note(v, langName) {
  if (!v) return 'No ' + langName + ' voice on this computer (see docs/notes.md)';
  return 'Voice: ' + v.name + (v.localService ? ' (offline)' : ' (needs internet)');
}

// Speaks [text, code, langName] items one after another; shows the voice used in every .voice element.
function speak(items, rate) {
  if (!has) return;
  stopTrack();
  speechSynthesis.cancel();
  for (const [text, code, langName] of items) {
    if (!text || !code) continue;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = code;
    const v = pickVoice(code);
    if (v) u.voice = v;
    u.rate = rate;
    const show = () => document.querySelectorAll('.voice').forEach(e => { e.textContent = note(v, langName); });
    u.onstart = show;
    if (!v) show();
    speechSynthesis.speak(u);
  }
}

// ---------- reading a line with the current word highlighted ----------
// Voices that report word boundaries (Windows voices) move the highlight exactly; others (Google voices) get a
// timed estimate from each word's weight (morae / syllables), started when speech starts.
let track = null;
// Seconds per mora (ja) or syllable at speed 1, tuned by ear against Google voices; others (en, de) use 0.22.
const UNIT = { ja: 0.14, ko: 0.21, fr: 0.19, es: 0.18, it: 0.18, ms: 0.18, id: 0.18 };
function stopTrack() {
  if (!track) return;
  track.timers.forEach(clearTimeout);
  if (track.cur) track.cur.classList.remove('reading');
  track = null;
}

// words: [{ text, el, weight }] in reading order; text must appear in line in that order.
function speakLine(line, code, langName, rate, words) {
  if (!has || !line || !code) return;
  stopTrack();
  speechSynthesis.cancel();
  const args = { line, code, langName, rate, words };
  const spans = [];
  let pos = 0;
  for (const w of words) {
    const at = line.indexOf(w.text, pos);
    if (at < 0) continue;
    spans.push({ start: at, end: at + w.text.length, el: w.el, weight: w.weight || 1, pause: /[、。,.!?;:！？；：]/.test(line.slice(pos, at)) });
    pos = at + w.text.length;
  }
  const t = track = { timers: [], cur: null, exact: false, args, spans };
  const mark = el => { if (t !== track) return; if (t.cur) t.cur.classList.remove('reading'); t.cur = el; if (el) el.classList.add('reading'); };
  const u = new SpeechSynthesisUtterance(line);
  u.lang = code;
  const v = pickVoice(code);
  if (v) u.voice = v;
  u.rate = rate;
  const unit = (UNIT[code.slice(0, 2)] || 0.22) / rate;   // seconds per mora / syllable at this speed
  u.onstart = () => {
    document.querySelectorAll('.voice').forEach(e => { e.textContent = note(v, langName); });
    if (spans[0]) mark(spans[0].el);
    let at = 0;
    spans.forEach((s, i) => {
      if (i) t.timers.push(setTimeout(() => { if (!t.exact) mark(s.el); }, at * 1000));
      at += s.weight * unit + (spans[i + 1] && spans[i + 1].pause ? 0.35 / rate : 0);
    });
  };
  u.onboundary = e => {
    if (e.name && e.name !== 'word') return;
    t.exact = true;
    const s = spans.filter(x => x.start <= e.charIndex).pop();
    if (s) mark(s.el);
  };
  u.onend = u.onerror = () => { if (t === track) stopTrack(); };
  if (!v) document.querySelectorAll('.voice').forEach(e => { e.textContent = note(v, langName); });
  speechSynthesis.speak(u);
}

// While a line is being read, a click on one of its words restarts the reading from that word.
// Returns false (caller handles the click) when no line is being read or el isn't one of its words.
function restartFrom(el) {
  if (!track) return false;
  const { args, spans } = track;
  const i = spans.findIndex(s => s.el === el || s.el.contains(el));
  if (i < 0) return false;
  const w = args.words.findIndex(x => x.el === spans[i].el);
  speakLine(args.line.slice(spans[i].start), args.code, args.langName, args.rate, args.words.slice(w));
  return true;
}

// Rough syllable count for the timed highlight.
const syllables = (text, lang) => lang === 'ko' ? (text.match(/[가-힣]/g) || []).length || 1 :
  (text.match(/[aeiouyàâäæéèêëïîíìôöóòœùûüúáñ]+/gi) || []).length || 1;

if (has) speechSynthesis.getVoices();
g.Speech = { has, pickVoice, speak, speakLine, restartFrom, syllables };
})(window);
