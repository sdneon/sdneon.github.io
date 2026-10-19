// Text -> IPA per language: dictionary lookups (dict/*.js) plus rule-based Spanish, Italian, Korean and kana.
(function (g) {
'use strict';

// ---------- dictionary loading (script tags, so file:// works) ----------
const DICTS = {}, pending = {}, MAXLEN = {};
g.PHON_DICT = function (name, data) {
  const map = new Map();
  let pw = '', pi = '', max = 0;
  for (const line of data.split('\n')) {
    const tab = line.indexOf('\t');
    const w = pw.slice(0, parseInt(line[0], 36)) + line.slice(1, tab);
    const ipa = pi.slice(0, parseInt(line[tab + 1], 36)) + line.slice(tab + 2);
    map.set(w, ipa);
    if (w.length > max) max = w.length;
    pw = w; pi = ipa;
  }
  DICTS[name] = map;
  MAXLEN[name] = Math.min(max, 12);
  if (pending[name]) pending[name].resolve(map);
};
function loadDict(name) {
  if (DICTS[name]) return Promise.resolve(DICTS[name]);
  if (!pending[name]) {
    const p = {};
    p.promise = new Promise((res, rej) => { p.resolve = res; p.reject = rej; });
    pending[name] = p;
    const s = document.createElement('script');
    s.src = 'dict/' + name + '.js';
    s.onerror = () => { delete pending[name]; p.reject(new Error('Could not load dict/' + name + '.js')); };
    document.head.appendChild(s);
  }
  return pending[name].promise;
}
const DICT_SIZE = { en_UK: 0.9, en_US: 1.8, fr_FR: 2.4, de: 8.5, ja: 9.8, ja_en: 10, ko: 1.2, zh: 3.5, it: 1.3 };
function dictsFor(lang, opt) {
  return { en: ['en_' + opt.accent, 'en_' + (opt.accent === 'UK' ? 'US' : 'UK')], fr: ['fr_FR'], de: ['de'],
    ja: opt.meanings ? ['ja', 'ja_en'] : ['ja'], ko: ['ko'], zh: ['zh'], it: ['it'] }[lang] || [];
}

function profile(lang, opt) {
  switch (lang) {
    case 'en': return { lang: 'en', short: new Set([...'ɪɛeæʌɒʊ']), trust: opt.accent === 'US' };
    case 'de': return { lang: 'de', short: new Set([...'ɪɛʊɔaʏœ']), trust: true };
    case 'fr': return { lang: 'fr', final: true };
    case 'es': return { lang: 'es', trust: true };
    case 'it': return { lang: 'it', trust: true };
    case 'ja': return { lang: 'ja', nostress: true };
    case 'ko': return { lang: 'ko', nostress: true };
    default: return { lang: 'en', trust: true };
  }
}

// ---------- English ----------
const VOICELESS = new Set(['p', 't', 'k', 'f', 'θ']);
const SIBIL = new Set(['s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ']);
function lastSound(ipa) { const m = /(tʃ|dʒ|[^ˈˌː])ː?$/.exec(ipa); return m ? m[1] : ''; }
function enSuffix(ipa, suf) {
  const l = lastSound(ipa);
  if (suf === 's') return ipa + (SIBIL.has(l) ? 'ɪz' : VOICELESS.has(l) ? 's' : 'z');
  if (suf === 'ed') return ipa + (l === 't' || l === 'd' ? 'ɪd' : VOICELESS.has(l) || SIBIL.has(l) && 'sʃtʃ'.includes(l) ? 't' : 'd');
  return ipa + suf;
}
const EN_RULES = [
  [/'s$/, '', 's'], [/s'$/, '', ''], [/ies$/, 'y', 's'], [/es$/, '', 's'], [/s$/, '', 's'],
  [/ied$/, 'y', 'ed'], [/ed$/, '', 'ed'], [/d$/, '', 'ed'], [/ing$/, '', 'ɪŋ'], [/ing$/, 'e', 'ɪŋ'],
  [/ly$/, '', 'li'], [/ness$/, '', 'nəs'], [/er$/, '', 'ə'], [/est$/, '', 'ɪst'],
];
const EN_WEAK = { a: 'ə', an: 'ən', the: 'ðə' };
function enWord(w, opt) {
  const key = w.toLowerCase().replace(/’/g, "'");
  if (EN_WEAK[key]) return { ipa: EN_WEAK[key], src: 'dict' };
  const main = DICTS['en_' + opt.accent], alt = DICTS['en_' + (opt.accent === 'UK' ? 'US' : 'UK')];
  if (main && main.has(key)) return { ipa: main.get(key), src: 'dict' };
  if (key.includes('-')) return joinParts(key.split('-').map(p => enWord(p, opt)));
  for (const [re, rep, suf] of EN_RULES) {
    if (!re.test(key)) continue;
    const stem = key.replace(re, rep);
    if (stem.length > 1 && main && main.has(stem)) return { ipa: enSuffix(main.get(stem), suf), src: 'guess', note: 'built from “' + stem + '”' };
  }
  if (alt && alt.has(key)) return { ipa: alt.get(key), src: 'guess', note: 'from the ' + (opt.accent === 'UK' ? 'US' : 'UK') + ' dictionary' };
  return { ipa: null, src: 'unknown' };
}
function joinParts(parts) {
  if (parts.some(p => !p.ipa)) return { ipa: null, src: 'unknown' };
  return { ipa: parts.map(p => p.ipa).join(' '), src: parts.every(p => p.src === 'dict') ? 'dict' : 'guess' };
}

// ---------- French ----------
const FR_ELISION = { l: 'l', d: 'd', j: 'ʒ', m: 'm', n: 'n', s: 's', t: 't', c: 's', qu: 'k', jusqu: 'ʒysk', lorsqu: 'lɔʁsk', puisqu: 'pɥisk' };
function frWord(w) {
  const d = DICTS.fr_FR, key = w.toLowerCase().replace(/’/g, "'");
  if (d.has(key)) return { ipa: d.get(key), src: 'dict' };
  const m = /^(l|d|j|m|n|s|t|c|qu|jusqu|lorsqu|puisqu)'(.+)$/.exec(key);
  if (m) { const r = frWord(m[2]); if (r.ipa) return { ipa: FR_ELISION[m[1]] + r.ipa, src: r.src }; }
  if (key.includes('-')) return joinParts(key.split('-').filter(Boolean).map(frWord));
  return { ipa: null, src: 'unknown' };
}

// ---------- German ----------
function deLook(w) {
  const d = DICTS.de;
  const cap = w[0].toUpperCase() + w.slice(1).toLowerCase();
  for (const k of [w, w.toLowerCase(), cap]) if (d.has(k)) return d.get(k);
  return null;
}
function deWord(w) {
  const hit = deLook(w);
  if (hit) return { ipa: hit, src: 'dict' };
  if (w.includes('-')) return joinParts(w.split('-').filter(Boolean).map(deWord));
  for (let i = w.length - 3; i >= 3; i--) {
    const a = deLook(w.slice(0, i));
    if (!a) continue;
    let rest = w.slice(i), b = deLook(rest);
    if (!b && rest[0] === 's' && rest.length > 3) { b = deLook(rest.slice(1)); if (b) b = 's' + b.replace(/^ˈ/, 'ˌ'); }
    else if (b) b = b.replace(/^ˈ/, 'ˌ');
    if (b) return { ipa: a + b, src: 'guess', note: 'compound: ' + w.slice(0, i) + ' + ' + rest };
  }
  return { ipa: null, src: 'unknown' };
}

// ---------- Spanish (rules) ----------
const ACC = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
function esWord(word, opt) {
  const w = word.toLowerCase(), spain = opt.es === 'spain';
  const ph = [];
  const front = c => !!c && 'eiéí'.includes(c);
  const isV = c => !!c && 'aeiouáéíóúü'.includes(c);
  const P = p => ph.push({ p });
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1] || '';
    if ('aeiou'.includes(c)) { ph.push({ p: c, v: true }); continue; }
    if (ACC[c]) { ph.push({ p: ACC[c], v: true, acc: true }); continue; }
    switch (c) {
      case 'ü': ph.push({ p: 'u', v: true }); break;
      case 'b': case 'v': P('b'); break;
      case 'c': if (n === 'h') { P('tʃ'); i++; } else if (front(n)) P(spain ? 'θ' : 's'); else P('k'); break;
      case 'q': P('k'); if (n === 'u') i++; break;
      case 'g': if (front(n)) P('x'); else { P('g'); if (n === 'u' && front(w[i + 2])) i++; } break;
      case 'j': P('x'); break;
      case 'h': break;
      case 'ñ': P('ɲ'); break;
      case 'z': P(spain ? 'θ' : 's'); break;
      case 'x': P('k'); P('s'); break;
      case 'l': if (n === 'l') { P('ʝ'); i++; } else P('l'); break;
      case 'r': if (n === 'r') { P('r'); i++; } else if (i === 0 || 'lns'.includes(w[i - 1])) P('r'); else P('ɾ'); break;
      case 'y': if (isV(n)) P('ʝ'); else ph.push({ p: 'i', v: true }); break;
      default: if (/[a-z]/.test(c)) P(c);
    }
  }
  for (let k = 0; k < ph.length; k++) {
    const t = ph[k];
    if (!t.v || t.acc || (t.p !== 'i' && t.p !== 'u')) continue;
    const prev = ph[k - 1], next = ph[k + 1];
    if ((next && next.v) || (prev && prev.v)) { t.p = t.p === 'i' ? 'j' : 'w'; t.v = false; t.glide = true; }
  }
  for (let k = 0; k + 1 < ph.length; k++) {
    if (ph[k].p !== 'n') continue;
    const nx = ph[k + 1].p;
    if (nx === 'k' || nx === 'g' || nx === 'x') ph[k].p = 'ŋ'; else if (nx === 'b' || nx === 'p' || nx === 'm') ph[k].p = 'm';
  }
  for (let k = 1; k < ph.length; k++) {
    const t = ph[k], pp = ph[k - 1].p;
    if (t.p !== 'b' && t.p !== 'd' && t.p !== 'g') continue;
    if (['m', 'n', 'ɲ', 'ŋ'].includes(pp) || (t.p === 'd' && pp === 'l')) continue;
    t.p = { b: 'β', d: 'ð', g: 'ɣ' }[t.p];
  }
  const nuc = [];
  ph.forEach((t, k) => { if (t.v) nuc.push(k); });
  let mark = -1;
  if (nuc.length > 1) {
    let si = nuc.findIndex(k => ph[k].acc);
    if (si < 0) si = 'aeiouns'.includes(w[w.length - 1]) ? nuc.length - 2 : nuc.length - 1;
    let start = nuc[si];
    if (start > 0 && ph[start - 1].glide) start--;
    if (si === 0) start = 0;
    else {
      let lo = nuc[si - 1] + 1;
      if (lo < start && ph[lo].glide) lo++;
      const cl = ph.slice(lo, start).map(t => t.p);
      const L2 = cl.length >= 2 && 'lɾ'.includes(cl[cl.length - 1]) && ['p', 'b', 'β', 'f', 'k', 'g', 'ɣ', 't', 'd', 'ð'].includes(cl[cl.length - 2]) &&
        !(cl[cl.length - 1] === 'l' && 'tdð'.includes(cl[cl.length - 2]));
      start -= L2 ? 2 : Math.min(1, cl.length);
    }
    mark = start;
  }
  return { ipa: ph.map((t, k) => (k === mark ? 'ˈ' : '') + t.p).join(''), src: 'rule' };
}

// ---------- Italian (dictionary, else rules) ----------
const IT_V = { a: ['a'], e: ['e'], i: ['i'], o: ['o'], u: ['u'], à: ['a', 1], è: ['ɛ', 1], é: ['e', 1], ì: ['i', 1], í: ['i', 1],
  ò: ['ɔ', 1], ó: ['o', 1], ù: ['u', 1], ú: ['u', 1] };
const IT_AFF = { tʃ: 't', dʒ: 'd', ts: 't', dz: 'd' };
// Spelling -> IPA. o.nostress: no stress mark (an elided prefix like dell').
function itRules(word, o = {}) {
  const w = word.toLowerCase().replace(/[’']/g, '');
  const isV = c => !!c && IT_V[c] !== undefined;
  const front = c => !!c && 'eièéìí'.includes(c);
  const ph = [];
  let gem = false;
  // a consonant; doubled when written double, or for gn/gl/sc/z between vowels (always long there)
  const C = (p, long) => {
    if (gem || (long && ph.length && ph[ph.length - 1].v)) ph.push({ p: IT_AFF[p] || p });
    ph.push({ p }); gem = false;
  };
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1] || '';
    if (isV(c)) { const [p, acc] = IT_V[c]; ph.push({ p, v: true, acc: !!acc, ch: c }); continue; }
    if (c === n && c !== 'h' && isV(w[i - 1])) { gem = true; continue; }   // tt, cc, zz…
    switch (c) {
      case 'c':
        if (n === 'h') { C('k'); i++; }
        else if (n === 'q') C('k');
        else if (front(n)) { C('tʃ'); if (n === 'i' && isV(w[i + 2])) i++; }
        else C('k');
        break;
      case 'g':
        if (n === 'h') { C('g'); i++; }
        else if (n === 'n') { C('ɲ', true); i++; }
        else if (n === 'l' && w[i + 2] === 'i') { C('ʎ', true); i += isV(w[i + 3]) ? 2 : 1; }
        else if (front(n)) { C('dʒ'); if (n === 'i' && isV(w[i + 2])) i++; }
        else C('g');
        break;
      case 's':
        if (n === 'c' && front(w[i + 2])) { C('ʃ', true); i++; if (w[i + 1] === 'i' && isV(w[i + 2])) i++; }
        else if (n && 'bdglmnrv'.includes(n) || (isV(w[i - 1]) && isV(n) && !gem)) C('z');
        else C('s');
        break;
      case 'z': C(i === 0 && isV(n) ? 'dz' : 'ts', isV(n)); break;
      case 'q': C('k'); if (n === 'u') { ph.push({ p: 'w' }); i++; } break;
      case 'h': break;
      case 'x': C('k'); C('s'); break;
      case 'y': ph.push({ p: 'i', v: true, ch: 'i' }); break;
      default: if (/[a-z]/.test(c)) C(c);
    }
  }
  // unstressed i/u next to a vowel are glides (piano, buono, poi), unless that leaves one syllable (mio, via)
  const nucN = () => ph.filter(t => t.v).length;
  for (let k = 0; k < ph.length; k++) {
    const t = ph[k];
    if (!t.v || t.acc || (t.p !== 'i' && t.p !== 'u')) continue;
    const prev = ph[k - 1], next = ph[k + 1];
    const before = next && next.v && !(next.p === t.p), after = prev && prev.v && !(next && next.v);
    if (!before && !after) continue;
    if (nucN() <= 2 && before && k + 2 === ph.length) continue;
    t.p = t.p === 'i' ? 'j' : 'w'; t.v = false;
  }
  const nuc = [];
  ph.forEach((t, k) => { if (t.v) nuc.push(k); });
  let mark = -1;
  if (!o.nostress && nuc.length > 1) {
    const a = nuc.filter(k => ph[k].acc);
    // a final vowel + i glide is stressed (vorrei, andai)
    mark = a.length ? a[a.length - 1] : ph[ph.length - 1].p === 'j' && nuc[nuc.length - 1] === ph.length - 2 ? nuc[nuc.length - 1] : nuc[nuc.length - 2];
  }
  const ipa = ph.map((t, k) => (k === mark ? 'ˈ' : '') + t.p).join('');
  return mark < 0 ? ipa : g.IPA.restress(ipa, { lang: 'it' });
}
// Wiktionary IPA -> display form: no syllable dots, raddoppiamento marks or tie bars; stress at syllable start.
function itNorm(ipa) {
  return g.IPA.restress(ipa.replace(/[.*‿()]|⁽ˈ⁾/g, '').replace(/ɡ/g, 'g'), { lang: 'it' });
}
function itWord(word) {
  const d = DICTS.it, key = word.toLowerCase().replace(/’/g, "'");
  if (d && d.has(key)) return { ipa: itNorm(d.get(key)), src: 'dict' };
  // l'amico, dell'acqua, c'è: the part after the apostrophe from the dictionary, the prefix by rules
  const m = /^([a-z]+)'(.+)$/.exec(key);
  if (m && d && d.has(m[2])) {
    const pre = m[1] === 'c' && /^[eèéiì]/.test(m[2]) ? 'tʃ' : itRules(m[1], { nostress: true });
    return { ipa: g.IPA.restress(pre + itNorm(d.get(m[2])), { lang: 'it' }), src: 'dict' };
  }
  return { ipa: itRules(key), src: 'rule' };
}

// ---------- Korean (dictionary, else Hangul rules) ----------
const KO_L = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const KO_V = ['a', 'ɛ', 'ja', 'jɛ', 'ʌ', 'e', 'jʌ', 'je', 'o', 'wa', 'wɛ', 'we', 'jo', 'u', 'wʌ', 'we', 'wi', 'ju', 'ɯ', 'ɰi', 'i'];
const KO_T = [[], ['g'], ['kk'], ['g', 's'], ['n'], ['n', 'j'], ['n', 'h'], ['d'], ['r'], ['r', 'g'], ['r', 'm'], ['r', 'b'],
  ['r', 's'], ['r', 't'], ['r', 'p'], ['r', 'h'], ['m'], ['b'], ['b', 's'], ['s'], ['ss'], ['ng'], ['j'], ['ch'], ['k'], ['t'], ['p'], ['h']];
const KO_DBL = { 'g,s': 'g', 'n,j': 'n', 'n,h': 'n', 'r,g': 'g', 'r,m': 'm', 'r,b': 'r', 'r,s': 'r', 'r,t': 'r', 'r,p': 'b', 'r,h': 'r', 'b,s': 'b' };
const KO_NEU = { g: 'k', kk: 'k', k: 'k', d: 't', t: 't', s: 't', ss: 't', j: 't', ch: 't', h: 't', b: 'p', p: 'p', n: 'n', r: 'l', m: 'm', ng: 'ŋ' };
const KO_TENSE = { g: 'kk', d: 'tt', b: 'pp', s: 'ss', j: 'jj' };
const KO_ON = { g: 'k', kk: 'k͈', n: 'n', d: 't', tt: 't͈', r: 'ɾ', l: 'l', m: 'm', b: 'p', pp: 'p͈', s: 's', ss: 's͈', '': '',
  j: 't͡ɕ', jj: 't͡ɕ͈', ch: 't͡ɕʰ', k: 'kʰ', t: 'tʰ', p: 'pʰ', h: 'h' };
const KO_VOICED = { g: 'ɡ', d: 'd', b: 'b', j: 'd͡ʑ' };

function koRules(run) {
  const S = [...run].map(ch => {
    const c = ch.charCodeAt(0) - 0xac00;
    return { on: KO_L[Math.floor(c / 588)], v: KO_V[Math.floor((c % 588) / 28)], co: KO_T[c % 28].slice(), cod: '' };
  });
  for (let i = 0; i + 1 < S.length; i++) {
    const s = S[i], n = S[i + 1];
    if (s.co.length && n.on === '') {
      if (s.co[s.co.length - 1] === 'h') s.co.pop();
      const last = s.co[s.co.length - 1];
      if (last && last !== 'ng') {
        s.co.pop();
        n.on = (last === 'd' || last === 't') && n.v === 'i' ? (last === 'd' ? 'j' : 'ch') : last;
      }
    }
    if (s.co.length && n.on === 'h') {
      const A = { g: 'k', d: 't', b: 'p', j: 'ch' }, last = s.co[s.co.length - 1];
      if (A[last]) { s.co.pop(); n.on = A[last]; }
    }
    if (s.co[s.co.length - 1] === 'h') {
      const A = { g: 'k', d: 't', j: 'ch', s: 'ss' };
      if (A[n.on]) { s.co.pop(); n.on = A[n.on]; }
    }
  }
  S.forEach(s => { s.cod = s.co.length ? KO_NEU[s.co.length > 1 ? KO_DBL[s.co.join(',')] : s.co[0]] || '' : ''; });
  for (let i = 0; i + 1 < S.length; i++) {
    const s = S[i], n = S[i + 1], c = s.cod, o = n.on;
    if (!c) continue;
    const NAS = { k: 'ŋ', t: 'n', p: 'm' };
    if ((o === 'n' || o === 'm') && NAS[c]) s.cod = NAS[c];
    else if (o === 'r') {
      if (c === 'n' || c === 'l') { s.cod = 'l'; n.on = 'l'; } else { n.on = 'n'; if (NAS[c]) s.cod = NAS[c]; }
    } else if (o === 'n' && c === 'l') n.on = 'l';
    else if (NAS[c] && KO_TENSE[o]) n.on = KO_TENSE[o];
  }
  return S.map((s, i) => {
    const prev = S[i - 1];
    const voiced = prev && ['', 'n', 'm', 'ŋ', 'l'].includes(prev.cod);
    let on = KO_ON[s.on];
    if (voiced && KO_VOICED[s.on]) on = KO_VOICED[s.on];
    if (voiced && s.on === 'h') on = 'ɦ';
    if (s.on === 's' && /^[ijw]i?/.test(s.v) && (s.v[0] === 'i' || s.v[0] === 'j' || s.v === 'wi')) on = 'ɕ';
    const v = s.v === 'ɰi' && s.on !== '' ? 'i' : s.v;
    return on + v + s.cod;
  }).join('');
}
function koNorm(ipa) {
  return ipa.replace(/[̠̹̞̝̚ˈː]/g, '').replace(/ɭ/g, 'l')
    .replace(/ɲ(?=j)/g, 'n').replace(/sʰ/g, 's').replace(/ʎ/g, 'l');
}
function koWord(run) {
  const d = DICTS.ko;
  if (d && d.has(run)) return { ipa: koNorm(d.get(run)), src: 'dict' };
  return { ipa: koRules(run), src: 'rule' };
}

// ---------- Japanese (dictionary segmentation + kana rules) ----------
const KANA = {};
('あa いi うɯ えe おo かka きki くkɯ けke こko がga ぎgi ぐgɯ げge ごgo さsa しɕi すsɯ せse そso ざza じʑi ずzɯ ぜze ぞzo ' +
 'たta ちtɕi つtsɯ てte とto だda ぢʑi づzɯ でde どdo なna にni ぬnɯ ねne のno はha ひçi ふɸɯ へhe ほho ばba びbi ぶbɯ べbe ぼbo ' +
 'ぱpa ぴpi ぷpɯ ぺpe ぽpo まma みmi むmɯ めme もmo やja ゆjɯ よjo らɾa りɾi るɾɯ れɾe ろɾo わɰa ゐi ゑe をo んɴ ゔvɯ ' +
 'ぁa ぃi ぅɯ ぇe ぉo ゃja ゅjɯ ょjo ゎɰa').split(' ').forEach(p => { KANA[p[0]] = p.slice(1); });
const hira = c => { const k = c.charCodeAt(0); return k >= 0x30a1 && k <= 0x30f6 ? String.fromCharCode(k - 0x60) : c; };
const isKana = c => /[ぁ-ゖァ-ヺー]/.test(c);
const isJa = c => /[ぁ-ゖァ-ヺー々一-鿿㐀-䶿]/.test(c);

// Kana -> IPA. o.verb (godan-u verb): a final う stays its own vowel. o.noLong: no long vowels from spelling.
// o.stem: from this index on (a verb ending or grammar word) only o+う is long (行こう, でしょう).
const LONG = { う: /[oɯ]$/, お: /o$/, い: /[ei]$/, あ: /a$/, え: /e$/ };
function kanaToIpa(str, o = {}) {
  const chars = [...str];
  const stem = o.stem === undefined ? Infinity : o.stem;
  const out = [];
  let gem = false;
  for (let i = 0; i < chars.length; i++) {
    const c = hira(chars[i]);
    if (c === 'っ') { gem = true; continue; }
    if (c === 'ー') { if (out.length) out[out.length - 1] += 'ː'; continue; }
    const p0 = out[out.length - 1];
    if (!o.noLong && LONG[c] && p0 && LONG[c].test(p0) && !p0.endsWith('ː') && chars[i] === c &&
        (i < stem || (c === 'う' && /o$/.test(p0))) &&
        !(o.verb && c === 'う' && i === chars.length - 1)) { out[out.length - 1] += 'ː'; continue; }
    const m = KANA[c];
    if (m === undefined) { out.push(''); continue; }
    if ('ゃゅょぁぃぅぇぉゎ'.includes(c) && out.length) {
      let p = out[out.length - 1];
      const vowel = m.slice(-1);
      if ('ゃゅょ'.includes(c)) p = /(ɕ|tɕ|ʑ)i$/.test(p) ? p.slice(0, -1) + vowel : p.endsWith('i') ? p.slice(0, -1) + 'j' + vowel : p + m;
      else p = p === 'ɯ' ? 'w' + vowel : p.replace(/[aiɯeo]$/, '') + vowel;
      out[out.length - 1] = p;
      continue;
    }
    if (gem) { const cm = /^(tɕ|ts|[^aiɯeo])/.exec(m); out.push((cm ? (cm[1].length > 1 ? 't' : cm[1]) : '') + m); gem = false; }
    else out.push(m);
  }
  if (gem) out.push('ʔ');
  return out.join('');
}

const JA_PARTICLE = { は: '(topic marker)', が: '(subject marker)', を: '(object marker)', に: 'to; at; in',
  で: 'at; by; with', の: "'s; of", へ: 'to (direction)', と: 'and; with', も: 'also; too', か: '(question)',
  ね: '(…right?)', よ: '(emphasis)', や: 'and (etc.)', から: 'from; because', まで: 'until; to' };
// Grammar endings matched before the dictionary when they follow a word.
const JA_GRAMMAR = { しています: 'is doing (polite)', していました: 'was doing (polite)', している: 'is doing',
  ています: 'is …ing (polite)', ていました: 'was …ing (polite)', ている: 'is …ing', ません: '(polite not)',
  ました: '(polite past)', ます: '(polite verb ending)', でした: 'was (polite)', ですか: 'is it? (polite)',
  です: 'is; am; are (polite)', でしょう: 'probably; …right?', ください: 'please',
  して: 'doing; and', した: 'did', て: '(te-form: and…; please…)', たい: 'want to', ない: 'not', さん: 'Mr.; Ms. (polite)', ちゃん: '(cute name suffix)',
  くん: '(name suffix, boys)', さま: 'Mr.; Ms. (very polite)' };
const JA_GRAMMAR_KEYS = Object.keys(JA_GRAMMAR).sort((a, b) => b.length - a.length);

// Dictionary value: "reading|class,verbReading" (class and verb reading optional).
function jaEntry(w) {
  const v = DICTS.ja.get(w);
  if (v === undefined) return null;
  const [r, vi] = v.split('|');
  const [cls, vr] = (vi || '').split(',');
  return { r, cls: cls || '', vr: vr || r };
}

// ---------- conjugated verbs and adjectives: 行きました -> 行く ----------
// Word types: what a form conjugates like. FIN = the word as found in the text.
const V1 = 1, V5 = 2, VK = 4, VS = 8, ADJ = 16, TE = 32, FIN = 64;
const CLS_TYPE = c => c === '1' ? V1 : c[0] === '5' ? V5 : c === 'k' ? VK : c === 's' ? VS : c === 'a' ? ADJ : 0;
// Rules [from, to, applies to (type of the from-form), gives (type of the to-form), label, needed class]
const JA_RULES = (() => {
  const R = [];
  const GODAN = { う: 'わいえお', く: 'かきけこ', ぐ: 'がぎげご', す: 'さしせそ', つ: 'たちてと', ぬ: 'なにねの', ぶ: 'ばびべぼ', む: 'まみめも', る: 'らりれろ' };
  const TE5 = { う: 'って', つ: 'って', る: 'って', ぬ: 'んで', ぶ: 'んで', む: 'んで', く: 'いて', ぐ: 'いで', す: 'して' };
  // stems per class: [masu (i), negative (a), volitional, conditional]
  const add = (endings, stems, inT) => {
    for (const [end, label, extraIn] of endings) {
      const at = inT | (extraIn || 0);
      R.push([stems.k + end, 'くる', at, VK, label]);
      R.push([end, 'る', at, V1 | VK, label]);
      R.push([stems.s + end, 'する', at, VS, label]);
      for (const [d, row] of Object.entries(GODAN)) R.push([row[stems.g] + end, d, at, V5, label]);
    }
  };
  const MASU = [['ます', 'polite'], ['ました', 'polite past'], ['ません', 'polite, not'], ['ませんでした', 'polite past, not'],
    ['ましょう', "polite, let's"], ['まして', 'polite, and…'], ['たい', 'want to', ADJ], ['ながら', 'while …ing'], ['なさい', 'do it!']];
  add(MASU, { k: 'き', s: 'し', g: 1 }, FIN);
  add([['ない', 'not', ADJ], ['ず', 'without'], ['ないで', "without; don't"]], { k: 'こ', s: 'し', g: 0 }, FIN);
  add([['れる', 'is done / can', V1], ['せる', 'make / let', V1]], { k: 'こら', s: 'さ', g: 0 }, FIN);
  for (const [d, row] of Object.entries(GODAN)) {
    R.push([row[3] + 'う', d, FIN, V5, "let's"]);
    R.push([row[2] + 'ば', d, FIN, V5, 'if']);
    R.push([row[2] + 'る', d, FIN | V1, V5, 'can']);
    const te = TE5[d], ta = te.replace('て', 'た').replace('で', 'だ');
    R.push([te, d, FIN | TE, V5, 'te-form: and…'], [ta, d, FIN, V5, 'past'], [ta + 'ら', d, FIN, V5, 'if / when'], [ta + 'り', d, FIN, V5, 'doing things like']);
  }
  R.push(['って', 'く', FIN | TE, V5, 'te-form: and…', '5k-s'], ['った', 'く', FIN, V5, 'past', '5k-s'], ['ったら', 'く', FIN, V5, 'if / when', '5k-s']);
  R.push(['います', 'る', FIN, V5, 'polite', '5aru'], ['いました', 'る', FIN, V5, 'polite past', '5aru'], ['いません', 'る', FIN, V5, 'polite, not', '5aru']);
  for (const [s, base, t] of [['き', 'くる', VK], ['', 'る', V1 | VK], ['し', 'する', VS]]) {
    R.push([s + 'て', base, FIN | TE, t, 'te-form: and…'], [s + 'た', base, FIN, t, 'past'], [s + 'たら', base, FIN, t, 'if / when'], [s + 'たり', base, FIN, t, 'doing things like']);
  }
  R.push(['こよう', 'くる', FIN, VK, "let's"], ['よう', 'る', FIN, V1 | VK, "let's"], ['しよう', 'する', FIN, VS, "let's"]);
  R.push(['くれば', 'くる', FIN, VK, 'if'], ['れば', 'る', FIN, V1 | VK, 'if'], ['すれば', 'する', FIN, VS, 'if']);
  R.push(['られる', 'る', FIN | V1, V1 | VK, 'is done / can'], ['させる', 'る', FIN | V1, V1 | VK, 'make / let']);
  R.push(['ている', 'て', FIN | V1, TE, 'is …ing'], ['でいる', 'で', FIN | V1, TE, 'is …ing'], ['てる', 'て', FIN | V1, TE, 'is …ing'],
    ['でる', 'で', FIN | V1, TE, 'is …ing'], ['てしまう', 'て', FIN | V5, TE, 'completely'], ['ちゃう', 'て', FIN | V5, TE, 'completely'],
    ['ておく', 'て', FIN | V5, TE, 'in advance']);
  R.push(['かった', 'い', FIN, ADJ, 'past'], ['くない', 'い', FIN | ADJ, ADJ, 'not'], ['くて', 'い', FIN | TE, ADJ, 'and…'],
    ['ければ', 'い', FIN, ADJ, 'if'], ['く', 'い', FIN, ADJ, 'adverb']);
  return R;
})();

// Returns the dictionary form found for w, or null.
function deinflect(w) {
  let queue = [{ w, type: FIN, labels: [] }];
  for (let depth = 0; depth < 4 && queue.length; depth++) {
    const next = [];
    for (const q of queue) for (const [from, to, inT, outT, label, need] of JA_RULES) {
      if (!(q.type & inT) || !q.w.endsWith(from)) continue;
      const base = q.w.slice(0, q.w.length - from.length) + to;
      if (base.length < 2) continue;
      const labels = q.type === TE ? q.labels : q.labels.concat(label);   // 読んでいる: "is …ing", not also "te-form"
      const e = jaEntry(base);
      if (e && e.cls && (CLS_TYPE(e.cls) & outT) && (!need || e.cls === need)) return { base, e, labels };
      next.push({ w: base, type: outT, labels });
    }
    queue = next;
  }
  return null;
}

// Token for a conjugated word: reading = the dictionary reading with its ending swapped for the one in the text.
function conjToken(w, { base, e, labels }) {
  let p = 0;
  while (p < w.length && p < base.length && w[p] === base[p]) p++;
  const tail = [...w.slice(p)].map(hira).join('');
  let stemKana;
  if (e.cls === 'k' && base === '来る') stemKana = /^[なよさら]/.test(tail) ? 'こ' : /^[るれ]/.test(tail) ? 'く' : 'き';
  else {
    const drop = [...base.slice(p)].map(hira).join('');
    if (!e.vr.endsWith(drop)) return null;
    stemKana = e.vr.slice(0, e.vr.length - drop.length);
  }
  const kana = stemKana + tail, stem = stemKana.length;
  const g0 = DICTS.ja_en && (DICTS.ja_en.get(base + '|v') || DICTS.ja_en.get(base) || '').split(';')[0].replace(/\s*\([^)]*\)/g, '');
  return { text: w, kana, stem, ipa: kanaToIpa(kana, { stem }), src: 'dict', base,
    gloss: g0 ? g0 + ' (' + labels.reverse().join(', ') + ')' : '' };
}

// Common surnames (not in JMdict). A name wins over a shorter dictionary word, or a same-length one before さん etc.
const JA_NAMES = {};
('佐藤さとう 鈴木すずき 高橋たかはし 田中たなか 伊藤いとう 渡辺わたなべ 山本やまもと 中村なかむら 小林こばやし 加藤かとう ' +
 '吉田よしだ 山田やまだ 佐々木ささき 山口やまぐち 松本まつもと 井上いのうえ 木村きむら 斎藤さいとう 斉藤さいとう 清水しみず ' +
 '山崎やまざき 池田いけだ 橋本はしもと 阿部あべ 石川いしかわ 山下やました 中島なかじま 石井いしい 小川おがわ 前田まえだ ' +
 '岡田おかだ 長谷川はせがわ 藤田ふじた 後藤ごとう 近藤こんどう 村上むらかみ 遠藤えんどう 青木あおき 坂本さかもと 福田ふくだ ' +
 '太田おおた 西村にしむら 藤井ふじい 金子かねこ 岡本おかもと 藤原ふじわら 中野なかの 三浦みうら 原田はらだ 中川なかがわ ' +
 '松田まつだ 竹内たけうち 小野おの 田村たむら 中山なかやま 和田わだ 石田いしだ 森田もりた 上田うえだ 内田うちだ ' +
 '柴田しばた 酒井さかい 宮崎みやざき 横山よこやま 高木たかぎ 安藤あんどう 宮本みやもと 大野おおの 小島こじま 谷口たにぐち ' +
 '今井いまい 工藤くどう 高田たかだ 増田ますだ 丸山まるやま 杉山すぎやま 村田むらた 大塚おおつか 新井あらい 小山こやま ' +
 '平野ひらの 藤本ふじもと 河野こうの 上野うえの 野口のぐち 武田たけだ 松井まつい 千葉ちば 岩崎いわさき 菅原すがわら ' +
 '木下きのした 久保くぼ 佐野さの 野村のむら 松尾まつお 市川いちかわ 菊地きくち 杉本すぎもと 古川ふるかわ 大西おおにし ' +
 '島田しまだ 水野みずの 桜井さくらい 高野たかの 渡部わたなべ 吉川よしかわ 山内やまうち 西田にしだ 飯田いいだ 菊池きくち ' +
 '西川にしかわ 小松こまつ 北村きたむら 安田やすだ 五十嵐いがらし 川口かわぐち 平田ひらた 中田なかた 久保田くぼた 服部はっとり ' +
 '岩田いわた 土屋つちや 川崎かわさき 福島ふくしま 本田ほんだ 樋口ひぐち 秋山あきやま 田口たぐち 永井ながい 山中やまなか ' +
 '中西なかにし 吉村よしむら 川上かわかみ 石原いしはら 大橋おおはし 松岡まつおか 馬場ばば 浅野あさの 荒木あらき 大久保おおくぼ ' +
 '野田のだ 小沢おざわ 田辺たなべ 川村かわむら 星野ほしの 黒田くろだ 尾崎おざき 望月もちづき 永田ながた 熊谷くまがい ' +
 '内藤ないとう 松村まつむら 西山にしやま 大谷おおたに 平井ひらい 大島おおしま 岩本いわもと 片山かたやま 本間ほんま 早川はやかわ ' +
 '横田よこた 岡崎おかざき 荒井あらい 大石おおいし 鎌田かまた 成田なりた 宮田みやた 小田おだ 石橋いしばし 篠原しのはら ' +
 '須藤すどう 河合かわい 大川おおかわ 宮下みやした 小池こいけ 高山たかやま 中尾なかお 吉岡よしおか 宮川みやがわ 小西こにし ' +
 '松下まつした 桑原くわばら').split(' ').forEach(p => { const m = /^([^ぁ-ゖ]+)(.+)$/.exec(p); JA_NAMES[m[1]] = m[2]; });
const JA_NAME_NOLONG = new Set(['井上']);   // い-の-う-え, not a long o
const JA_HONORIFIC = /^(さん|様|さま|くん|君|ちゃん|先生|氏)/;

// Length of the longest dictionary word or conjugated form at pos.
function jaLenAt(text, pos) {
  for (let L = Math.min(12, text.length - pos); L >= 2; L--) {
    const w = text.substr(pos, L);
    if (![...w].every(isJa)) continue;
    if ((L <= (MAXLEN.ja || 8) && DICTS.ja.has(w)) || (isKana(w[L - 1]) && deinflect(w))) return L;
  }
  return 1;
}

function jaLine(text) {
  const d = DICTS.ja, max = MAXLEN.ja || 8, toks = [];
  let i = 0;
  while (i < text.length) {
    if (!isJa(text[i])) {
      let j = i; while (j < text.length && !isJa(text[j])) j++;
      const chunk = text.slice(i, j);
      chunk.split(/(\s+)/).filter(s => s.trim()).forEach(s => toks.push({ text: s, kind: 'punct' }));
      i = j; continue;
    }
    let found = null;
    const last = toks[toks.length - 1];
    if (last && last.kind === 'word') {
      const gk = JA_GRAMMAR_KEYS.find(k => text.startsWith(k, i));
      if (gk) found = { text: gk, kana: gk, ipa: kanaToIpa(gk, { stem: 0 }), src: 'rule', gloss: JA_GRAMMAR[gk], stem: 0 };
    }
    // longest conjugated form starting here (行きました, 来た)
    let conj = null;
    for (let L = Math.min(12, text.length - i); L >= 2 && !conj; L--) {
      const w = text.substr(i, L);
      if (![...w].every(isJa) || !isKana(w[L - 1])) continue;
      const di = deinflect(w);
      if (di) conj = conjToken(w, di);
    }
    // は|います, not はう (crawl): a kana-only form starting with a particle splits when the rest is a word
    if (conj && last && last.kind === 'word' && JA_PARTICLE[text[i]] && ![...conj.text].some(c => !isKana(c))) {
      const rest = conj.text.slice(1);
      if (d.has(rest) || deinflect(rest)) conj = null;
    }
    for (let L = Math.min(max, text.length - i); L >= 1 && !found; L--) {
      const w = text.substr(i, L);
      if (![...w].every(isJa)) continue;
      // 何で|すか -> 何|ですか: a shorter word wins when the longer one swallows the start of a grammar ending
      if (d.has(w) && L > 1) {
        let L2 = L - 1;
        while (L2 >= 1 && !(d.has(text.substr(i, L2)) &&
          JA_GRAMMAR_KEYS.some(k => k.length > 1 && i + L2 + k.length > i + L && text.startsWith(k, i + L2)))) L2--;
        if (L2 >= 1) continue;
      }
      if (d.has(w)) {
        const e = jaEntry(w), verb = e.cls === '5u' && e.vr === e.r;
        found = { text: w, kana: e.r, verb, ipa: kanaToIpa(e.r, { verb }), src: 'dict' };
        // こんにちわ: shown as written (は), said "wa"
        if (w.endsWith('は') && found.kana.endsWith('わ')) {
          // 今日は雨 (more text follows) is 今日 + は, not the greeting
          if (isJa(text[i + L] || '') && d.has(w.slice(0, -1))) { found = null; continue; }
          found.kana = found.kana.slice(0, -1) + 'は'; found.waEnd = true;
        }
        // これは -> これ + particle は
        else if (L > 1 && w.endsWith('は') && d.has(w.slice(0, -1))) { found = null; continue; }
        // 何 before です/だ/の/で is なん
        if (w === '何' && /^(です|だ|の|で)/.test(text.slice(i + 1))) Object.assign(found, { kana: 'なん', ipa: 'naɴ' });
        break;
      }
    }
    // A conjugated form wins when longer, or as long and written with kanji (来た "came", not the interjection)
    // or when the dictionary word has no meaning of its own (います).
    const fl = found ? found.text.length : 0;
    if (conj && (conj.text.length > fl || (conj.text.length === fl && found.src !== 'rule' &&
        (/[一-鿿々]/.test(conj.text) || (DICTS.ja_en && !DICTS.ja_en.get(found.text)))))) found = conj;
    // は|ここ, not はこ (box): after a word, a particle splits off when the word after it reaches further
    if (found && found.text.length > 1 && last && last.kind === 'word' && JA_PARTICLE[text[i]] && found.src !== 'rule' &&
        1 + jaLenAt(text, i + 1) > found.text.length) found = null;
    const name = Object.keys(JA_NAMES).filter(n => text.startsWith(n, i)).sort((a, b) => b.length - a.length)[0];
    const nl = found ? found.text.length : 0;
    if (name && (name.length > nl || (name.length === nl && JA_HONORIFIC.test(text.slice(i + nl))))) {
      const noLong = JA_NAME_NOLONG.has(name);
      found = { text: name, kana: JA_NAMES[name], noLong, ipa: kanaToIpa(JA_NAMES[name], { noLong }), src: 'name', gloss: '(surname)' };
    }
    if (!found) {
      let j = i + 1;
      if (isKana(text[i])) while (j < text.length && /[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮーっッ]/.test(text[j])) j++;
      if (/[っッ]/.test(text[i]) && j < text.length) j++;
      const w = text.slice(i, j);
      found = isKana(w[0]) ? { text: w, kana: w, ipa: kanaToIpa(w), src: 'rule' } : { text: w, ipa: null, src: 'unknown' };
    }
    const prev = toks[toks.length - 1];
    const particle = prev && prev.kind === 'word' && JA_PARTICLE[found.text];
    if (particle) {
      found.particle = true;
      if (found.text === 'は') found.ipa = 'ɰa';
      else if (found.text === 'へ') found.ipa = 'e';
      else if (found.text === 'を') found.ipa = 'o';
    }
    if (DICTS.ja_en && !found.gloss) found.gloss = particle || DICTS.ja_en.get(found.text) || '';
    found.kind = 'word';
    toks.push(found);
    i += found.text.length;
  }
  return toks;
}

// ---------- Chinese (dictionary segmentation -> Hanyu Pinyin) ----------
const isHan = c => /[㐀-䶿一-鿿豈-﫿]/.test(c);
const TONE = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', v: 'ǖǘǚǜ' };
// "hao3" -> "hǎo": the mark goes on a or e, else on the o of ou, else on the last vowel; tone 5 = no mark.
function toneMark(syl) {
  const m = /^([a-zA-Z]+?)([1-5])?$/.exec(syl);
  if (!m) return syl;
  let [, s, t] = m;
  if (t && t !== '5') {
    const low = s.toLowerCase();
    const i = /[ae]/.test(low) ? low.search(/[ae]/) : low.includes('ou') ? low.indexOf('o') : low.search(/[aeiouv][^aeiouv]*$/);
    if (i >= 0) {
      const mk = TONE[low[i]][+t - 1];
      s = s.slice(0, i) + (s[i] === s[i].toUpperCase() ? mk.toUpperCase() : mk) + s.slice(i + 1);
    }
  }
  return s.replace(/v/g, 'ü').replace(/V/g, 'Ü');
}
// "xi1 an1" -> "xī'ān": syllables of a word are joined; ' before a syllable starting with a, o or e.
const zhPinyin = py => py.split(' ').map((s, i) => (i && /^[aoeAOE]/.test(s) ? "'" : '') + toneMark(s)).join('');

// Each run of Han characters is split into the words with the lowest total cost (dictionary value
// "pinyin|cost", cost = how rare the word is), so 说中文 is 说 + 中文, not 说中 (hit the mark) + 文.
function zhSplit(run) {
  const d = DICTS.zh, max = MAXLEN.zh || 8, n = run.length;
  const best = [{ cost: 0 }];
  for (let j = 1; j <= n; j++) {
    best[j] = { cost: Infinity };
    for (let L = 1; L <= Math.min(max, j); L++) {
      const w = run.slice(j - L, j), v = d.get(w);
      if (v === undefined && L > 1) continue;
      const c = best[j - L].cost + (v === undefined ? 40 : parseInt(v.split('|')[1] || 'z', 36));
      if (c < best[j].cost) best[j] = { cost: c, L, v };
    }
  }
  const out = [];
  for (let j = n; j > 0; j -= best[j].L) {
    const { L, v } = best[j], w = run.slice(j - L, j);
    out.unshift(v === undefined ? { text: w, pinyin: null, src: 'unknown' } : { text: w, pinyin: zhPinyin(v.split('|')[0]), src: 'dict' });
  }
  return out;
}

function zhLine(text) {
  const toks = [];
  let i = 0;
  while (i < text.length) {
    let j = i;
    if (!isHan(text[i])) {
      while (j < text.length && !isHan(text[j])) j++;
      text.slice(i, j).split(/(\s+)/).filter(s => s.trim()).forEach(s => toks.push({ text: s, kind: 'punct' }));
    } else {
      while (j < text.length && isHan(text[j])) j++;
      zhSplit(text.slice(i, j)).forEach(t => toks.push(Object.assign(t, { kind: 'word' })));
    }
    i = j;
  }
  return toks;
}

// ---------- line conversion ----------
const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}'’\-]*[\p{L}\p{M}]|[\p{L}\p{M}]|\S/gu;
function convertLine(line, lang, opt) {
  if (lang === 'ja') return jaLine(line);
  if (lang === 'zh') return zhLine(line);
  const toks = [];
  for (const m of line.matchAll(WORD_RE)) {
    const w = m[0];
    if (!/\p{L}/u.test(w)) {
      const prev = toks[toks.length - 1];
      if (prev && prev.kind === 'punct') prev.text += w; else toks.push({ text: w, kind: 'punct' });
      continue;
    }
    let r;
    if (lang === 'ko') {
      r = /^[가-힣]+$/.test(w) ? koWord(w) : { ipa: null, src: 'unknown' };
    } else if (lang === 'en') {
      r = enWord(w, opt);
      if (r.ipa) r.ipa = g.IPA.restress(r.ipa, profile('en', opt));
    }
    else if (lang === 'fr') r = frWord(w);
    else if (lang === 'de') r = deWord(w);
    else if (lang === 'es') r = esWord(w, opt);
    else if (lang === 'it') r = itWord(w);
    else r = { ipa: null, src: 'unknown' };
    toks.push(Object.assign({ text: w, kind: 'word' }, r));
  }
  return toks;
}

g.G2P = { loadDict, dictsFor, DICT_SIZE, profile, convertLine, kanaToIpa, koRules, esWord, itRules, hira, zhPinyin };
})(window);
