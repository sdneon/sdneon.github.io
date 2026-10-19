// Builds dict/*.js from ipa-dict text files (word<TAB>/ipa/, /ipa2/ ...).
// Usage: node tools/build-dicts.js [raw-dir]   (default: tools/raw-dicts, the downloaded sources)
// Output format: PHON_DICT(name, "front-coded lines"), see docs/design.md.
'use strict';
const fs = require('fs');
const path = require('path');

const rawDir = process.argv[2] || path.join(__dirname, 'raw-dicts');
const outDir = path.join(__dirname, '..', 'dict');
fs.mkdirSync(outDir, { recursive: true });

const SETS = {
  en_UK: { lower: true },
  en_US: { lower: true },
  fr_FR: { lower: true },
  de:    { lower: false, skip: /[\s\d]/ },
  ko:    { lower: false },
  it:    { lower: true },   // from Wiktionary via tools/kaikki-to-ipadict.js
  la_cl: { lower: true },   // Latin, classical (same, tag Classical-Latin)
  la_ec: { lower: true },   // Latin, ecclesiastical (same, untagged)
};

function commonPrefix(a, b) {
  const n = Math.min(a.length, b.length, 35);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

for (const [name, opt] of Object.entries(SETS)) {
  const src = path.join(rawDir, name + '.txt');
  const map = new Map();
  for (const line of fs.readFileSync(src, 'utf8').split(/\r?\n/)) {
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    let word = line.slice(0, tab).normalize('NFC');
    if (opt.skip && opt.skip.test(word)) continue;
    if (opt.lower) word = word.toLowerCase();
    const m = /\/([^/]+)\//.exec(line.slice(tab + 1));
    if (!m || map.has(word)) continue;
    map.set(word, m[1].split(',')[0].trim().normalize('NFC'));
  }
  write(name, map);
}

// Japanese: word -> most common kana reading [+ '|' verb/adjective class [+ ',' its reading if different]]
// and a short meaning.
function writeJa(best, verbs = new Map()) {
  write('ja', new Map([...best].map(([k, v]) => {
    const vb = verbs.get(k);
    return [k, v.r + (vb ? '|' + vb.cls + (vb.r !== v.r ? ',' + vb.r : '') : '')];
  })));
  // a verb's own meaning when the spelling has none (いる: kana-only, so not a headword);
  // "key|v" = the verb's meaning when the spelling's main meaning is another word's (いる: 要る need / 居る be)
  const en = new Map([...best].map(([k, v]) => [k, v.gloss && v.head ? v.gloss : (verbs.get(k) || {}).gloss]).filter(([, g]) => g));
  for (const [k, vb] of verbs) if (vb.gloss && en.get(k) !== vb.gloss) en.set(k + '|v', vb.gloss);
  write('ja_en', en);
}
const shortGloss = list => {
  const s = list.slice(0, 2).join('; ');
  return s.length > 40 ? s.slice(0, 38).replace(/\s+\S*$/, '') + '…' : s;
};

// Preferred source: JMdict, which ranks every spelling and reading by frequency.
const jmdict = path.join(rawDir, 'JMdict_e.gz');
const edict = path.join(rawDir, 'edict2.gz');
if (fs.existsSync(jmdict)) {
  const xml = require('zlib').gunzipSync(fs.readFileSync(jmdict)).toString('utf8');
  const best = new Map();
  const debug = new Set((process.env.DEBUG_JA || '').split(',').filter(Boolean));
  const offer = (k, v) => {
    if (debug.has(k)) console.log('DEBUG', k, v.r, v.score, v.ent, JSON.stringify(v.why || ''));
    const b = best.get(k); if (!b || v.score > b.score || (v.score === b.score && v.ent < b.ent)) best.set(k, v); };
  // Best verb/adjective reading per spelling, kept apart so a noun can't hide a verb (行き vs 行く).
  const verbs = new Map();
  const offerVerb = (k, v) => {
    const b = verbs.get(k); if (!b || v.score > b.score || (v.score === b.score && v.ent < b.ent)) verbs.set(k, v); };
  const VCLASS = { '&v1;': '1', '&v1-s;': '1', '&vk;': 'k', '&vs-i;': 's', '&vs-s;': 's', '&adj-i;': 'a', '&adj-ix;': 'a' };
  for (const c of ['b', 'g', 'k', 'k-s', 'm', 'n', 'r', 'r-i', 's', 't', 'u', 'u-s', 'aru']) VCLASS['&v5' + c + ';'] = '5' + c;
  const all = (s, tag) => [...s.matchAll(new RegExp('<' + tag + '>([^<]*)</' + tag + '>', 'g'))].map(m => m[1]);
  const unxml = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // news1/ichi1/spec1/gai1 = top lists, *2 = second tier, nf01..nf48 = frequency band (01 most common)
  const pri = tags => tags.reduce((s, t) => s + (/^(news1|ichi1|spec1|gai1)$/.test(t) ? 8 :
    /^(news2|ichi2|spec2|gai2)$/.test(t) ? 3 : /^nf\d+$/.test(t) ? (48 - +t.slice(2)) / 4 : 0), 0);
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const ent = +all(e, 'ent_seq')[0];
    const s0 = (/<sense>([\s\S]*?)<\/sense>/.exec(e) || ['', ''])[1];
    const gloss = shortGloss(all(s0, 'gloss').map(g => unxml(g).replace(/\s*\([a-z]{3}:[^)]*\)/g, '').trim()));
    const pos0 = all(s0, 'pos'), misc0 = all(s0, 'misc');
    const uk = misc0.includes('&uk;');
    const vpos = all(e, 'pos').map(p => VCLASS[p]).find(Boolean);
    const wa = /pronounced as わ/.test(e);
    const fix = r => wa ? r.replace(/は$/, 'わ') : r;
    let pen = 0;
    if (misc0.some(x => /^&(arch|obs|dated);$/.test(x))) pen -= 4;
    if (pos0.length && pos0.every(p => /^&(suf|pref|ctr);$/.test(p))) pen -= 6;
    const kebs = [...e.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)]
      .map(x => ({ k: all(x[1], 'keb')[0], inf: all(x[1], 'ke_inf'), pri: pri(all(x[1], 'ke_pri')) }))
      .filter(k => !k.inf.some(i => /^&(iK|oK|sK);$/.test(i)));
    const rebs = [...e.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)]
      .map(x => ({ r: all(x[1], 'reb')[0], restr: all(x[1], 're_restr'), nok: x[1].includes('<re_nokanji/>'),
        inf: all(x[1], 're_inf'), pri: pri(all(x[1], 're_pri')) }))
      .filter(r => !r.inf.some(i => /^&(ik|ok|sk);$/.test(i)));
    // A reading's rank counts only as far as this spelling is common too; main spelling +2; everyday special
    // readings (gikun: 昨日 きのう, 今日 きょう) +30; general words with many senses get up to +4.
    const senses = (e.match(/<sense>/g) || []).length;
    kebs.forEach((k, i) => { k.first = i === 0; });
    for (const k of kebs) for (const r of rebs) {
      if (r.nok || (r.restr.length && !r.restr.includes(k.k))) continue;
      const score = k.pri + Math.min(r.pri, k.pri) + (k.first ? 2 : 0) + (r.inf.includes('&gikun;') && r.pri > 0 ? 30 : 0) +
        0.5 * Math.min(senses, 8) + pen - (k.inf.includes('&rK;') ? 10 : 0);
      offer(k.k, { r: fix(r.r), score, ent, gloss, head: true,
        why: debug.size ? [k.pri, r.pri, pen, k.inf, (/<k_ele>[\s\S]*?<\/r_ele>/.exec(e) || [''])[0].replace(/\s+/g, ' ').slice(0, 300)] : '' });
      if (vpos) offerVerb(k.k, { r: r.r, cls: vpos, score, ent, gloss });
    }
    const kanaWord = uk || !kebs.length;
    for (const r of rebs) {
      const score = r.pri + pen + (kanaWord ? 4 : -3);
      offer(r.r, { r: fix(r.r), score, ent, gloss, head: kanaWord || r.pri > 0 });
      if (vpos) offerVerb(r.r, { r: r.r, cls: vpos, score, ent, gloss });
    }
  }
  verbs.set('いる', { r: 'いる', cls: '1', gloss: 'to be; to exist (people, animals)' });   // 居る (be), not 要る (need): ています → いる
  writeJa(best, verbs);
} else if (fs.existsSync(edict)) {
  // Fallback: EDICT2 (only a yes/no "common" mark).
  const text = new TextDecoder('euc-jp').decode(require('zlib').gunzipSync(fs.readFileSync(edict)));
  const best = new Map();   // key -> { r, score, ent }
  const clean = s => s.replace(/\([^)]*\)/g, '').trim();
  let gloss = '';
  const offer = (k, r, score, ent, head = true) => {
    const b = best.get(k);
    if (!b || score > b.score || (score === b.score && ent < b.ent)) best.set(k, { r, score, ent, gloss, head });
  };
  // First sense, up to 2 glosses, without (tags): "(pn) (slightly formal) I/me/(P)/..." -> "I; me".
  const firstGloss = body => {
    const out = [];
    for (const item of body.split('/')) {
      if (!item || /^\(P\)$/.test(item) || /^EntL/.test(item)) continue;
      if (out.length && /\(2\)/.test(item)) break;
      const g = item.replace(/^(\s*\([^)]*\)\s*)+/, '').replace(/\s*\([a-z]{3}:[^)]*\)/g, '').trim();
      if (g) out.push(g);
      if (out.length === 2) break;
    }
    const s = out.join('; ');
    return s.length > 40 ? s.slice(0, 38).replace(/\s+\S*$/, '') + '…' : s;
  };
  for (const line of text.split('\n').slice(1)) {
    const m = /^(\S+)(?: \[([^\]]+)\])? \/(.*)$/.exec(line);
    if (!m) continue;
    const ent = +((/EntL(\d+)/.exec(m[3]) || [])[1] || 9e9);
    const body = m[3];
    gloss = firstGloss(body);
    const uk = /\(uk\)/.test(body);   // usually written in kana: the reading is the normal spelling
    let base = (/\/\(P\)\//.test('/' + body) ? 2 : 0) - (/\((arch|obs|dated)\)/.test(body) ? 2 : 0) -
      (/^\((suf|pref|ctr)[,)]/.test(body) ? 5 : 0);
    const verbU = /\bv5u(-s)?\b/.test(body) ? '|5u' : '';
    const wa = /は is pronounced as わ/.test(body);
    const fix = r => (wa ? r.replace(/は$/, 'わ') : r) + verbU;
    const heads = m[1].split(';').filter(h => !/\((sK|iK|oK|ik|ok|sk)\)/.test(h));
    const reads = (m[2] ? m[2].split(';') : []).filter(x => !/\((sk|ik|ok)\)/.test(x));
    for (const hRaw of heads) {
      const h = clean(hRaw);
      if (!h) continue;
      const hs = base + (/\(P\)/.test(hRaw) ? 2 : 0) - (/\(rK\)/.test(hRaw) ? 5 : 0);
      if (!reads.length) { offer(h, fix(h), hs, ent); continue; }
      // a reading may be restricted to some headwords: よみ(漢字1,漢字2)
      for (const x of reads) {
        const only = [...x.matchAll(/\(([^)]*)\)/g)].map(k => k[1]).find(k => /[^\x00-\x7f]/.test(k));
        if (only && !only.split(',').includes(h)) continue;
        offer(h, fix(clean(x)), hs + (/\(P\)/.test(x) ? 4 : 0), ent);
      }
    }
    for (const x of reads) { const r = clean(x); offer(r, fix(r), base - 3 + (/\(P\)/.test(x) ? 4 : 0) + (uk ? 3 : 0), ent, uk); }
  }
  for (const v of best.values()) v.head = v.head || v.score >= 1;
  writeJa(best);
}

// Chinese: CC-CEDICT "Trad Simp [pin1 yin1] /gloss/…/" -> dict/zh.js: word (both scripts) -> pinyin with tone
// numbers, one syllable per space. CEDICT has no frequencies, so for words with several readings: common words
// beat surnames, variants and proper nouns; more senses win; a few very common characters are fixed by hand.
const cedict = path.join(rawDir, 'cedict.txt.gz');
if (fs.existsSync(cedict)) {
  const ZH_FIX = { 了: 'le5', 的: 'de5', 得: 'de5', 着: 'zhe5', 著: 'zhe5', 过: 'guo4', 過: 'guo4', 么: 'me5', 麼: 'me5',
    们: 'men5', 們: 'men5', 个: 'ge4', 個: 'ge4', 还: 'hai2', 還: 'hai2', 行: 'xing2', 长: 'chang2', 長: 'chang2',
    都: 'dou1', 和: 'he2', 为: 'wei4', 為: 'wei4', 觉: 'jue2', 覺: 'jue2', 只: 'zhi3', 那: 'na4', 哪: 'na3', 吗: 'ma5',
    嗎: 'ma5', 呢: 'ne5', 吧: 'ba5', 啊: 'a5', 要: 'yao4', 会: 'hui4', 會: 'hui4', 说: 'shuo1', 說: 'shuo1',
    没: 'mei2', 沒: 'mei2', 好: 'hao3', 中: 'zhong1', 重: 'zhong4', 发: 'fa1', 差: 'cha4', 少: 'shao3', 乐: 'le4',
    樂: 'le4', 几: 'ji3', 幾: 'ji3', 教: 'jiao1', 处: 'chu4', 處: 'chu4', 种: 'zhong3', 種: 'zhong3', 更: 'geng4',
    难: 'nan2', 難: 'nan2', 相: 'xiang1', 应: 'ying1', 應: 'ying1', 当: 'dang1', 當: 'dang1', 分: 'fen1', 数: 'shu4',
    數: 'shu4', 地: 'di4', 大: 'da4', 看: 'kan4', 这: 'zhe4', 這: 'zhe4', 一: 'yi1', 不: 'bu4', 子: 'zi5', 便: 'bian4',
    将: 'jiang1', 將: 'jiang1', 干: 'gan4', 幹: 'gan4', 乾: 'gan1', 系: 'xi4', 係: 'xi4', 传: 'chuan2', 傳: 'chuan2',
    转: 'zhuan3', 轉: 'zhuan3', 调: 'diao4', 調: 'diao4', 空: 'kong1', 朝: 'chao2', 假: 'jia3', 倒: 'dao4', 背: 'bei4' };
  const best = new Map();
  let n = 0;
  for (const line of require('zlib').gunzipSync(fs.readFileSync(cedict)).toString('utf8').split('\n')) {
    const m = /^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/.exec(line);
    if (!m) continue;
    n++;
    const [, trad, simp, py, body] = m;
    const glosses = body.split('/');
    let score = Math.min(glosses.length, 6) * 0.5;
    if (/^[A-Z]/.test(py)) score -= 5;
    if (/^surname /.test(glosses[0])) score -= 3;
    if (glosses.every(g => /^(old |archaic |)variant of|^see |^used in /.test(g))) score -= 4;
    if (/\((archaic|old|dialect|literary)\)/.test(glosses[0])) score -= 2;
    const pin = py.replace(/u:/g, 'v');   // ü written v
    for (const k of new Set([simp, trad])) {
      const b = best.get(k);
      if (!b || score > b.score) best.set(k, { score, pin, simp });
    }
  }
  for (const [k, p] of Object.entries(ZH_FIX)) Object.assign(best.get(k) || best.set(k, { simp: k }).get(k), { score: 99, pin: p });
  console.log('cedict', n, 'entries');
  // Word cost for splitting text (jieba word counts, simplified; Traditional words use their simplified form):
  // round(-ln(count / total)), one base36 digit; words jieba lacks get z (35).
  const freq = new Map();
  let total = 0;
  const jieba = path.join(rawDir, 'jieba-dict.txt');
  if (fs.existsSync(jieba)) for (const l of fs.readFileSync(jieba, 'utf8').split('\n')) {
    const [w, c] = l.split(' ');
    if (w && +c) { freq.set(w, (freq.get(w) || 0) + +c); total += +c; }
  }
  const cost = v => { const c = freq.get(v.simp); return c ? Math.min(34, Math.round(-Math.log(c / total))).toString(36) : 'z'; };
  write('zh', new Map([...best].map(([k, v]) => [k, v.pin + '|' + cost(v)])));
}

// Common English words (top 6000 of google-10000-english that are in en_UK or en_US) -> js/common-en.js.
const common = path.join(rawDir, 'google-10000.txt');
if (fs.existsSync(common)) {
  const known = new Set();
  for (const n of ['en_UK', 'en_US']) for (const l of fs.readFileSync(path.join(rawDir, n + '.txt'), 'utf8').split('\n')) known.add(l.split('\t')[0].toLowerCase());
  const words = fs.readFileSync(common, 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase())
    .filter(w => /^[a-z]+$/.test(w) && (w.length > 1 || w === 'a' || w === 'i') && known.has(w)).slice(0, 6000);
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'common-en.js'),
    '// Most common English words (generated by tools/build-dicts.js from google-10000-english).\nwindow.EN_COMMON = new Set(' +
    JSON.stringify(words.join(' ')) + '.split(\' \'));\n');
  console.log('common-en', words.length, 'words');
}

function write(name, map) {
  const keys = [...map.keys()].sort();
  let pw = '', pi = '';
  const lines = keys.map(w => {
    const ipa = map.get(w);
    const a = commonPrefix(pw, w), b = commonPrefix(pi, ipa);
    pw = w; pi = ipa;
    return a.toString(36) + w.slice(a) + '\t' + b.toString(36) + ipa.slice(b);
  });
  const js = 'PHON_DICT(' + JSON.stringify(name) + ',' + JSON.stringify(lines.join('\n')) + ');\n';
  fs.writeFileSync(path.join(outDir, name + '.js'), js);
  console.log(name, keys.length, 'entries', (js.length / 1e6).toFixed(1) + 'M chars');
}
