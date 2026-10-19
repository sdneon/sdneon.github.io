// IPA -> segments -> syllables -> English-style respelling and pinyin approximation.
(function (g) {
'use strict';

const VOWELS = new Set([...'iyɨʉɯuɪʏʊeøɘɵɤoəɛœɜɞʌɔæɐaɶɑɒɝɚ']);
const MODLETTERS = new Set([...'ːˑʰʲʷˠᵝˀ˞']);
const SKIP = new Set([...'/[]()ʼ‿|‖,-↗↘0123456789\'']);
const EN_DIPH = new Set(['eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'əʊ', 'oʊ', 'ɪə', 'eə', 'ɛə', 'ʊə']);
const AFFRIC = new Set(['tʃ', 'dʒ', 'tɕ', 'dʑ']);
const isComb = ch => { const c = ch.codePointAt(0); return c >= 0x300 && c <= 0x36f; };

function tokenize(ipa, lang) {
  const s = ipa.normalize('NFC').replace(/[ãẽĩõũỹ]/g, c => c.normalize('NFD')).replace(/ɡ/g, 'g');
  const raw = [];
  let tie = false;
  for (const ch of s) {
    if (SKIP.has(ch)) continue;
    if (ch === 'ˈ' || ch === 'ˌ') { raw.push({ type: 'st', level: ch === 'ˈ' ? 1 : 2 }); continue; }
    if (ch === '.') { raw.push({ type: 'brk' }); continue; }
    if (/\s/.test(ch)) continue;
    const last = raw[raw.length - 1];
    const seg = last && last.base ? last : null;
    if (ch === '͡' || ch === '͜') { tie = true; continue; }
    if (isComb(ch) || MODLETTERS.has(ch)) { if (seg) seg.mods += ch; continue; }
    if (tie && seg) { seg.base += ch; tie = false; continue; }
    tie = false;
    raw.push({ base: ch, mods: '' });
  }
  const out = [];
  for (const t of raw) {
    const p = out[out.length - 1];
    if (t.base && p && p.base) {
      const pair = p.base + t.base;
      if (!p.mods && (AFFRIC.has(pair) || ((lang === 'ja' || lang === 'it' || lang === 'la') && (pair === 'ts' || pair === 'dz')))) {
        p.base = pair; p.mods = t.mods; continue;
      }
      if (VOWELS.has(p.base[0]) && VOWELS.has(t.base[0]) && p.base.length === 1 &&
          (t.mods.includes('̯') || (lang === 'en' && !p.mods && EN_DIPH.has(pair)))) {
        p.base = pair; p.mods += t.mods.replace('̯', ''); continue;
      }
    }
    out.push(t);
  }
  for (const t of out) if (t.base) {
    t.type = VOWELS.has(t.base[0]) ? 'v' : 'c';
    t.syl = t.type === 'c' && /[̩̍]/.test(t.mods);
    t.long = t.mods.includes('ː');
    t.nasal = t.mods.includes('̃');
  }
  return out;
}

const OBS = new Set(['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ʃ', 'ç', 'x', 'β', 'ɣ', 'ð', 'ʒ']);
const LIQ = new Set(['l', 'ɹ', 'r', 'ʁ', 'ɾ', 'ɫ', 'ʀ']);
const GLIDES = new Set(['j', 'w', 'ɥ', 'ɰ']);

function legalOnset(a, lang) {
  const b = a.map(t => t.base);
  if (!b.length) return true;
  if (b.length === 1) return (b[0] !== 'ŋ' || lang === 'ms') && b[0] !== 'ɴ';   // Malay: ng starts syllables (ma-ngan)
  if (b.length === 2) {
    const [x, y] = b;
    if (OBS.has(x) && LIQ.has(y)) return !('tdθð'.includes(x) && (y === 'l' || y === 'ɫ'));
    if (x === 's' && y.length === 1 && 'ptkmnlwfj'.includes(y)) return true;
    if (x === 'ʃ' && ['p', 't', 'm', 'n', 'l', 'v', 'w', 'ɹ', 'ʁ', 'r'].includes(y)) return true;
    if (GLIDES.has(y)) return !['ŋ', 'ɴ', 'ʔ'].includes(x) && !GLIDES.has(x);
    return false;
  }
  if (b.length === 3) return (b[0] === 's' || b[0] === 'ʃ') && 'ptk'.includes(b[1]) && legalOnset(a.slice(1));
  return false;
}

function syllabify(toks, prof) {
  const segs = [];
  let pend = 0, brk = false;
  for (const t of toks) {
    if (t.type === 'st') { pend = t.level; if (prof.trust) brk = true; continue; }
    if (t.type === 'brk') { brk = true; continue; }
    const s = Object.assign({}, t, { brk });
    if (s.type === 'v' || s.syl) { s.stress = pend; pend = 0; }
    brk = false;
    segs.push(s);
  }
  const nuc = [];
  segs.forEach((s, i) => { if (s.type === 'v' || s.syl) nuc.push(i); });
  if (!nuc.length) return segs.length ? [{ on: segs, nu: null, co: [], stress: 0 }] : [];
  const sy = nuc.map(i => ({ nu: segs[i], on: [], co: [], stress: segs[i].stress || 0 }));
  sy[0].on = segs.slice(0, nuc[0]);
  sy[sy.length - 1].co = segs.slice(nuc[nuc.length - 1] + 1);
  for (let k = 0; k + 1 < nuc.length; k++) {
    const cl = segs.slice(nuc[k] + 1, nuc[k + 1]);
    let split = -1;
    cl.forEach((c, j) => { if (c.brk) split = j; });
    if (split < 0 && segs[nuc[k + 1]].brk) split = cl.length;
    if (split < 0) {
      split = cl.length;
      for (let j = 0; j <= cl.length; j++) if (legalOnset(cl.slice(j), prof.lang)) { split = j; break; }
      const A = sy[k], B = sy[k + 1];
      if (prof.short && split === 0 && cl.length && prof.short.has(A.nu.base) && !A.nu.long &&
          !(B.stress === 1 && A.stress !== 1)) split = 1;
    }
    sy[k].co = cl.slice(0, split);
    sy[k + 1].on = cl.slice(split);
  }
  if (prof.nostress) sy.forEach(s => { s.stress = 0; });
  else if (prof.final && sy.length > 1 && !sy.some(s => s.stress)) sy[sy.length - 1].stress = 1;
  return sy;
}

function parse(ipa, prof) {
  return ipa.split(/\s+/).filter(Boolean).map(ch => syllabify(tokenize(ch, prof.lang), prof)).filter(w => w.length);
}

// Rewrites IPA with stress marks at syllable starts; none on one-syllable words.
function restress(ipa, prof) {
  const mark = { 1: 'ˈ', 2: 'ˌ' };
  return parse(ipa, prof).map(sy => sy.map(s => (sy.length > 1 && s.stress ? mark[s.stress] : '') +
    [...s.on, s.nu, ...s.co].filter(Boolean).map(t => t.base + t.mods).join('')).join('')).join(' ');
}

// ---------- respelling ----------
const C_MAP = { p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g', f: 'f', v: 'v', s: 's', z: 'z', h: 'h', m: 'm', n: 'n', l: 'l',
  w: 'w', j: 'y', ɹ: 'r', r: 'rr', ɾ: 'r', ʁ: 'r', ʀ: 'r', ɫ: 'l', ɭ: 'l', ʎ: 'ly', ɲ: 'ny', ŋ: 'ng', θ: 'th', ð: 'dh',
  ʃ: 'sh', ʒ: 'zh', tʃ: 'ch', dʒ: 'j', x: 'kh', χ: 'kh', ç: 'hy', ɕ: 'sh', ʑ: 'zh', tɕ: 'ch', dʑ: 'j', ts: 'ts', dz: 'dz',
  pf: 'pf', β: 'b', ɣ: 'g', ʝ: 'y', ɥ: 'w', ɸ: 'f', ɰ: 'w', ɦ: 'h', ʔ: '', ɴ: 'n', ʋ: 'v', ɱ: 'm', c: 'ky', ɟ: 'gy',
  ʂ: 'sh', ʐ: 'zh', ɬ: 'hl', ħ: 'h', ʕ: '', ʈ: 't', ɖ: 'd', ɳ: 'n', ɻ: 'r', ɓ: 'b' };
const KO_LENIS = { p: 'b', t: 'd', k: 'g', tɕ: 'j' };
const KO_TENSE = { p: 'pp', t: 'tt', k: 'kk', s: 'ss', tɕ: 'jj' };

// User's own sound-alikes from the Legend: symbol -> spelling.
let OVR = {};
function setOverrides(o) { OVR = o || {}; }
const ovr = (...keys) => { for (const k of keys) if (k && OVR[k] !== undefined) return OVR[k]; return undefined; };

function consSpell(t, pos, prof) {
  const base = t.base;
  const o = ovr(base);
  if (o !== undefined) return o;
  if (prof.lang === 'ko') {
    if (t.mods.includes('͈') && KO_TENSE[base]) return KO_TENSE[base];
    if (pos === 'on' && !t.mods.includes('ʰ') && KO_LENIS[base]) return KO_LENIS[base];
  }
  if (base === 'ç' && pos === 'co') return 'kh';
  if (prof.lang === 'ms' && base === 'ʔ' && pos === 'co') return 'k';   // Malay final k: a cut-off k
  if (prof.lang === 'it' || prof.lang === 'la' || prof.lang === 'ms') {
    if (base === 'r') return 'r';   // rr is written as two r
    if (pos === 'co' && (base === 'ʎ' || base === 'ɲ')) return base === 'ʎ' ? 'l' : 'n';   // famiglia: MEEL-lyah
  }
  let r = C_MAP[base];
  if (r === undefined) r = [...base].map(c => (C_MAP[c] !== undefined ? C_MAP[c] : c)).join('');
  if (t.mods.includes('ʲ')) r += 'y';
  if (t.mods.includes('ʷ')) r += 'w';   // Latin kʷ (qu) = kw
  return r;
}

const V_EN = { i: 'ee', ɪ: ['i', 'ih'], e: ['e', 'eh'], ɛ: ['e', 'eh'], æ: 'a', a: 'a', ɑ: 'ah', ɒ: 'o', ɔ: 'aw', o: 'oh',
  ʊ: 'uu', u: 'oo', ʌ: ['u', 'uh'], ə: 'uh', ɐ: 'uh', ɜ: 'ur', ɝ: 'ur', ɚ: 'er', ɞ: 'ur', y: 'ew', ø: 'ur', œ: 'ur',
  ɯ: 'oo', ɨ: 'i', ʏ: 'ew', ɘ: 'uh', ɤ: 'uh', ʉ: 'ew', ɵ: 'ur' };
const V_X = Object.assign({}, V_EN, { e: 'ay', a: 'ah', ɔ: ['o', 'aw'] });
const V_LANG = { es: { e: 'eh' }, it: { e: 'eh' }, la: { e: 'eh', ʊ: 'oo' }, ms: { e: ['e', 'eh'] }, ja: { e: 'eh' }, ko: { e: 'eh', ɛ: 'eh', ʌ: 'aw', ɯ: 'eu' } };
const DIPH = { eɪ: 'ay', ɔɪ: 'oy', ɔʏ: 'oy', aʊ: 'ow', əʊ: 'oh', oʊ: 'oh', ɪə: 'eer', eə: 'air', ɛə: 'air', ʊə: 'oor' };
const NAS = { ɑ: 'ahn', a: 'ahn', ɔ: 'awn', o: 'ohn', ɛ: 'an', e: 'an', œ: 'un', ə: 'un', ø: 'un' };
// Classical Latin final -m (a nasal vowel): spelled with the m it is written with
const NAS_LA = { a: 'ahm', e: 'ehm', ɛ: 'ehm', i: 'eem', ɪ: 'eem', o: 'ohm', ɔ: 'ohm', u: 'oom', ʊ: 'oom' };
const R_COMBO = { ɑ: 'ar', a: 'ar', ɔ: 'or', o: 'or', ɛ: 'air', e: 'air', æ: 'air', ɪ: 'eer', i: 'eer', ʊ: 'oor', u: 'oor',
  y: 'ewr', ʏ: 'ewr', ø: 'ur', œ: 'ur', ə: 'er', ʌ: 'ur' };
const GLIDE_V = { j: { e: 'ay', ɛ: 'ay', o: 'oy', ɔ: 'oy', u: 'ooy', ʊ: 'ooy', ə: 'ay', i: 'ee', ɪ: 'ee' },
  w: { a: 'ow', ɑ: 'ow', e: 'ehw', ɛ: 'ehw', o: 'oh', ɔ: 'oh', i: 'ew', ə: 'oh', u: 'oo' } };

function respellSyl(sy, prof) {
  const co = sy.co.slice();
  const on = sy.on.map(t => consSpell(t, 'on', prof)).join('');
  const nu = sy.nu;
  if (!nu) return on + co.map(t => consSpell(t, 'co', prof)).join('');
  let v, eye = false;
  if (nu.syl) v = 'uh' + consSpell(nu, 'co', prof);
  else {
    const key = nu.base;
    const g0 = co.length ? co[0].base : '';
    const o = ovr(nu.nasal ? key + '̃' : '', nu.long ? key + 'ː' : '', key === 'eə' ? 'ɛə' : key === 'ɔʏ' ? 'ɔɪ' : '', key);
    if (o !== undefined) v = o;
    else if (key === 'aɪ' || key === 'ai' || ((g0 === 'j') && (key === 'a' || key === 'ɑ'))) {
      eye = true; if (key.length === 1) co.shift();
    } else if (key.length === 2 && key[1] === 'ɐ' && R_COMBO[key[0]]) v = R_COMBO[key[0]];
    else if ((g0 === 'j' || g0 === 'w') && key.length === 1 && GLIDE_V[g0][key]) { v = GLIDE_V[g0][key]; co.shift(); }
    else if (g0 === 'ɹ' && prof.lang === 'en' && R_COMBO[key] && key !== 'ə') { v = R_COMBO[key]; co.shift(); }
    else if (nu.nasal && prof.lang === 'la' && NAS_LA[key[0]]) v = NAS_LA[key[0]];
    else if (nu.nasal && NAS[key[0]]) v = NAS[key[0]];
    else if (DIPH[key]) v = DIPH[key];
    else {
      const tbl = prof.lang === 'en' ? V_EN : V_X;
      const ov = V_LANG[prof.lang] || {};
      let val = ov[key] !== undefined ? ov[key] : tbl[key];
      if (val === undefined) val = key.length > 1 ? [...key].map(c => tbl[c] || c).join('') : key;
      v = Array.isArray(val) ? val[co.length ? 0 : 1] : val;
    }
  }
  const coda = co.map(t => consSpell(t, 'co', prof)).join('');
  if (eye) {
    if (!on) return !coda ? 'eye' : co.length === 1 ? 'i' + coda + 'e' : 'eye' + coda;
    if (!coda) return on + 'y';
    return on + 'y' + coda + (co.length === 1 ? 'e' : '');
  }
  return on + v + coda;
}

function respell(ipa, prof) {
  return parse(ipa, prof).map(sy => {
    const multi = sy.length > 1;
    return sy.map(s => { const r = respellSyl(s, prof); return multi && s.stress === 1 ? r.toUpperCase() : r; })
      .filter(Boolean).join('-');
  }).join(' ');
}

// ---------- pinyin ----------
const PY_INI = { p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g', f: 'f', v: 'w', s: 's', z: 'z', h: 'h', x: 'h', χ: 'h',
  ʁ: 'h', ʀ: 'h', ɹ: 'r', r: 'l', ɾ: 'l', l: 'l', ɫ: 'l', ɭ: 'l', m: 'm', n: 'n', w: 'w', j: 'y', ʃ: 'sh', ʒ: 'r',
  tʃ: 'ch', dʒ: 'zh', θ: 's', ð: 'd', ç: 'x', ɕ: 'x', ʑ: 'j', tɕ: 'q', dʑ: 'j', ts: 'c', dz: 'z', pf: 'f', ɲ: 'n',
  ʎ: 'l', β: 'b', ɣ: 'g', ʝ: 'y', ɥ: 'y', ɸ: 'f', ɰ: 'w', ɦ: 'h', ʔ: '', ŋ: '', ɴ: 'n', ʋ: 'w' };
const PY_UNASP = { p: 'b', t: 'd', k: 'g', tɕ: 'j', ts: 'z', tʃ: 'zh' };
const PY_CODA = { p: 'pu', b: 'bu', t: 'te', d: 'de', k: 'ke', g: 'ge', f: 'fu', v: 'fu', s: 'si', z: 'zi', θ: 'si', ð: 'de',
  ʃ: 'shi', ʒ: 'ri', tʃ: 'qi', dʒ: 'ji', l: 'er', ɫ: 'er', ɭ: 'er', ɹ: 'er', r: 'er', ɾ: 'er', ʁ: 'er', x: 'he', χ: 'he',
  ç: 'xi', ɕ: 'xi', m: 'mu', n: 'en', ŋ: 'eng', ɴ: 'en', ts: 'ci', dz: 'zi', j: 'yi', w: 'wu', ɲ: 'ni', ʎ: 'li', pf: 'fu',
  β: 'bu', ɣ: 'ge', ʝ: 'yi', ɸ: 'fu', tɕ: 'qi', dʑ: 'ji', ʑ: 'ji', ɥ: 'yu', ʋ: 'fu' };
const PY_FIN = { i: 'i', ɪ: 'i', y: 'ü', ʏ: 'ü', e: 'ei', ɛ: 'ai', æ: 'ai', a: 'a', ɑ: 'a', ɐ: 'a', ʌ: 'a', ɒ: 'o', ɔ: 'o',
  o: 'o', u: 'u', ʊ: 'u', ɯ: 'u', ʉ: 'u', ə: 'e', ɘ: 'e', ɤ: 'e', ɨ: 'e', ɜ: 'er', ɝ: 'er', ɚ: 'er', ø: 'e', œ: 'e',
  ɞ: 'e', ɵ: 'e', eɪ: 'ei', aɪ: 'ai', ɔɪ: 'ao|yi', ɔʏ: 'ao|yi', aʊ: 'ao', əʊ: 'ou', oʊ: 'ou', ɪə: 'ie', eə: 'ai',
  ɛə: 'ai', ʊə: 'u|e' };
const PY_NAS = { ɑ: 'ang', a: 'ang', ɔ: 'ong', o: 'ong', ɛ: 'an', e: 'an', œ: 'en', ø: 'en', ə: 'en' };
const MERGE = {
  n: { i: 'in', a: 'an', e: 'en', ei: 'en', ai: 'an', u: 'un', ü: 'ün', o: 'ong', ou: 'ong', ao: 'ang', er: 'en', ie: 'ian' },
  ŋ: { i: 'ing', a: 'ang', e: 'eng', ei: 'eng', ai: 'ang', u: 'ong', ü: 'iong', o: 'ong', ou: 'ong', ao: 'ang', er: 'eng', ie: 'ing' },
  j: { a: 'ai', e: 'ei', o: 'ao|yi', u: 'ui', ei: 'ei', i: 'i', er: 'ei' },
  w: { a: 'ao', e: 'ou', o: 'ou', i: 'iu', u: 'u', ou: 'ou' },
};
const MED_I = { a: 'ia', o: 'iao', e: 'ie', ai: 'ie', ei: 'ie', ao: 'iao', ou: 'iu', an: 'ian', ang: 'iang', en: 'in',
  eng: 'ing', ong: 'iong', u: 'iu', er: 'ie', un: 'ün' };
const MED_U = { a: 'ua', o: 'uo', e: 'uo', ai: 'uai', ei: 'ui', i: 'ui', an: 'uan', ang: 'uang', en: 'un', eng: 'ong',
  ao: 'uo', ou: 'uo', er: 'uo', in: 'un', ing: 'ong' };
const ZERO = { i: 'yi', in: 'yin', ing: 'ying', iu: 'you', u: 'wu', ui: 'wei', un: 'wen', ü: 'yu', ün: 'yun' };

function pySpell(ini, med, fin) {
  if (ini === 'y') { if (fin === 'u') return 'you'; if (fin[0] !== 'i' && fin[0] !== 'ü') fin = MED_I[fin] || 'i' + fin; ini = ''; }
  else if (ini === 'w') { if (fin === 'i') return 'wei'; if (fin[0] !== 'u') fin = MED_U[fin] || 'u' + fin; ini = ''; }
  else if (med === 'i' && fin[0] !== 'i' && fin[0] !== 'ü') fin = MED_I[fin] || 'i' + fin;
  else if (med === 'u' && fin[0] !== 'u') fin = MED_U[fin] || 'u' + fin;
  if (fin[0] === 'i' || fin[0] === 'ü') {
    if (ini === 'sh' || ini === 's') ini = 'x';
    else if (ini === 'ch' || ini === 'c') ini = 'q';
    else if (ini === 'zh' || ini === 'z') ini = 'j';
  }
  if (!ini) {
    if (ZERO[fin]) return ZERO[fin];
    if (fin[0] === 'i') return 'y' + fin.slice(1);
    if (fin[0] === 'u') return 'w' + fin.slice(1);
    if (fin[0] === 'ü') return 'yu' + fin.slice(1);
    return fin;
  }
  if (ini === 'j' || ini === 'q' || ini === 'x') {
    if (fin[0] === 'ü') fin = 'u' + fin.slice(1);
    else if (fin[0] !== 'i') fin = MED_I[fin] || 'i' + fin;
  }
  return ini + fin;
}

function pyIni(t, prof) {
  if (['es', 'it', 'la', 'ms', 'fr', 'ko'].includes(prof.lang) && !t.mods.includes('ʰ') && PY_UNASP[t.base]) return PY_UNASP[t.base];
  return PY_INI[t.base] !== undefined ? PY_INI[t.base] : t.base;
}

function pinyin(ipa, prof) {
  const out = [];
  const pushC = t => { const p = PY_CODA[t.base]; if (p) out.push({ s: p }); };
  for (const sy of parse(ipa, prof)) {
    if (out.length) out.push({ s: ' ' });
    sy.forEach((s, idx) => {
      const on = s.on.slice(), co = s.co.slice();
      if (!s.nu) { on.concat(co).forEach(pushC); return; }
      let ini = '', med = '';
      if (on.length) {
        let t = on.pop();
        if ((t.base === 'j' || t.base === 'w' || t.base === 'ɥ') && on.length) { med = t.base === 'w' ? 'u' : 'i'; t = on.pop(); }
        on.forEach(pushC);
        ini = pyIni(t, prof);
        if (t.base === 'ɲ' || t.base === 'ʎ') med = 'i';
      }
      const nu = s.nu;
      let fin;
      if (nu.syl) fin = nu.base === 'l' ? 'er' : 'en';
      else if (nu.nasal) fin = PY_NAS[nu.base[0]] || 'en';
      else if (PY_FIN[nu.base]) fin = PY_FIN[nu.base];
      else if (nu.base.length === 2) fin = (PY_FIN[nu.base[0]] || 'e') + (nu.base[1] === 'ɐ' ? '|er' : '|' + (PY_FIN[nu.base[1]] || 'e'));
      else fin = 'e';
      if (!fin.includes('|') && co.length) {
        let c = co[0].base;
        if (c === 'ɴ') c = 'n';
        if (c === 'm' && (idx < sy.length - 1 || co.length > 1)) c = 'n';
        if (MERGE[c] && MERGE[c][fin]) { fin = MERGE[c][fin]; co.shift(); }
      }
      const parts = fin.split('|');
      out.push({ s: pySpell(ini, med, parts[0]), st: s.stress === 1 && sy.length > 1 });
      parts.slice(1).forEach(f => out.push({ s: pySpell('', '', f) }));
      co.forEach(pushC);
    });
  }
  return out;
}

// ---------- hover hints ----------
function hints(ipa, lang) {
  const L = g.LEGEND.map, res = [];
  for (const t of tokenize(ipa, lang === 'en' ? 'en' : lang)) {
    if (!t.base) continue;
    const keys = [t.base + (t.nasal ? '̃' : ''), t.base + (t.long ? 'ː' : ''), t.base, t.base[0]];
    const e = keys.map(k => L.get(k)).find(Boolean);
    const sym = t.base + t.mods;
    if (!res.some(r => r.sym === sym)) res.push({ sym, e });
  }
  return res;
}

g.IPA = { tokenize, syllabify, parse, respell, pinyin, hints, setOverrides, restress };
})(window);
