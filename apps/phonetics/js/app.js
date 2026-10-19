// UI: input box, per-word output columns, legend dialog, speech.
(function () {
'use strict';
const $ = s => document.querySelector(s);
const NAMES = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', la: 'Latin', ms: 'Malay', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ipa: 'IPA' };
const DICT_NAMES = { en_UK: 'British English', en_US: 'American English', fr_FR: 'French', de: 'German', it: 'Italian',
  la_cl: 'Latin (Classical)', la_ec: 'Latin (Church)', ms_my: 'Malay (everyday)', ms_bk: 'Malay (formal)', ja: 'Japanese', ja_en: 'Japanese meanings', ko: 'Korean', zh: 'Chinese' };
const EXAMPLES = {
  en: 'The quick brown fox jumps over the lazy dog.\nI would like a cup of tea, please.',
  es: 'Buenos días, ¿cómo estás?\nMe llamo Carlos y vivo en Madrid.',
  fr: "Bonjour mon ami, comment allez-vous ?\nJe voudrais un café, s'il vous plaît.",
  de: 'Guten Morgen! Wie geht es dir?\nIch möchte ein Stück Kuchen, bitte.',
  it: 'Buongiorno, come stai?\nVorrei un caffè e una pizza, per favore.',
  la: 'Gallia est omnis divisa in partes tres.\nVeni, vidi, vici. Cogito, ergo sum.',
  ms: 'Selamat pagi, apa khabar?\nSaya mahu makan nasi lemak dan minum teh tarik.',
  ja: 'こんにちは、私は学生です。\n東京は大きい都市です。',
  ko: '안녕하세요, 저는 학생입니다.\n한국어를 배우고 있어요.',
  zh: '你好，我是学生。我们一起去北京吧！\n你好，我是學生。我們一起去北京吧！',
  ipa: '/ˈhɛləʊ wɜːld/\n/bɔ̃ʒuʁ mɔ̃n‿ami/',
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('phon.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('phon.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const opt = Object.assign({ lang: 'auto', accent: 'UK', es: 'latam', la: 'classical', ms: 'everyday', pinyin: false, rate: 0.7, plainEn: true, translate: true, meanings: true }, store.get('settings', {}));
let overrides = store.get('overrides', {});
IPA.setOverrides(overrides);
const likeOf = e => (overrides[e.sym] !== undefined ? overrides[e.sym] : e.like);
const input = $('#input'), output = $('#output'), status = $('#status');

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- speech ----------
const speechCode = lang => ({ en: opt.accent === 'US' ? 'en-US' : 'en-GB', es: opt.es === 'spain' ? 'es-ES' : 'es-MX',
  fr: 'fr-FR', de: 'de-DE', it: 'it-IT', la: 'it-IT', ms: Speech.pickVoice('ms-MY') ? 'ms-MY' : 'id-ID', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN' }[lang]);

function voiceSummary() {
  if (!Speech.has) return 'This browser cannot read aloud.';
  const groups = { off: [], on: [], none: [] };
  for (const L of ['en', 'es', 'fr', 'de', 'it', 'ms', 'ja', 'ko', 'zh']) {
    const v = Speech.pickVoice(speechCode(L));
    groups[!v ? 'none' : v.localService ? 'off' : 'on'].push(NAMES[L] + (v && (L === 'en' || L === 'ms') ? ' (' + v.lang + ')' : ''));
  }
  return [groups.off.length && 'Voices that work offline: ' + groups.off.join(', ') + '.',
    groups.on.length && 'Need internet: ' + groups.on.join(', ') + '.',
    groups.none.length && 'No voice: ' + groups.none.join(', ') + '.'].filter(Boolean).join(' ');
}

// Speaks a list of [text, lang] one after another at the chosen speed.
function speakList(items) {
  Speech.speak(items.map(([text, lang]) => [text, speechCode(lang), NAMES[lang]]), opt.rate);
}
const speak = (text, lang) => speakList([[text, lang]]);

// Example words of a legend row: "s<b>ee</b> · es <i>s<b>í</b></i>" -> [["see","en"],["sí","es"]].
function legendExamples(html) {
  const out = [];
  for (const part of html.split('·')) {
    const m = /^\s*(es|fr|de|it|la|ms|ja|ko|Spain)\s+(?:<i>(.*?)<\/i>|([^\s<(]+))/.exec(part);
    const text = (m ? m[2] || m[3] : part).replace(/<[^>]+>/g, '').split(/[(:,;]/)[0]
      .replace(/^\s*(in UK English|US|UK)\s*:?\s*/i, '').trim();
    const lang = m ? (m[1] === 'Spain' ? 'es' : m[1]) : 'en';
    if (text && text.split(' ').length <= 3) out.push([text, lang]);
  }
  return out;
}

// ---------- rendering ----------
function hintText(ipa, lang) {
  return IPA.hints(ipa, lang).map(h => h.e ? h.sym + '   ' + likeOf(h.e) + '   — ' + h.e.ex.replace(/<[^>]+>/g, '') : h.sym + '   (not in legend)').join('\n');
}

// A common English word of 1-2 syllables, which an English reader can say already.
function plainEnglish(word, ipa, prof) {
  const k = word.toLowerCase().replace(/’/g, "'");
  const forms = [k, k.replace(/'s$/, ''), k.replace(/s$/, ''), k.replace(/es$/, ''), k.replace(/ies$/, 'y'),
    k.replace(/ed$/, ''), k.replace(/d$/, ''), k.replace(/ing$/, ''), k.replace(/ing$/, 'e'), k.replace(/ly$/, ''), k.replace(/er$/, '')];
  if (!forms.some(f => window.EN_COMMON.has(f))) return false;
  return IPA.parse(ipa, prof).reduce((n, w) => n + w.length, 0) <= 2;
}

function wordCol(text, ipa, prof, lang, cls, gloss) {
  const w = el('div', 'w' + (cls ? ' ' + cls : ''));
  const t = el('div', 't', text);
  // while its line is being read, a click restarts the reading from this word
  if (lang !== 'ipa') t.addEventListener('click', () => { if (!Speech.restartFrom(w)) speak(text, lang); });
  w.appendChild(t);
  if (lang !== 'ipa') {
    const i = el('div', 'i', ipa === null ? '?' : ipa);
    if (ipa) i.title = hintText(ipa, prof.lang);
    w.appendChild(i);
  } else if (ipa) t.title = hintText(ipa, 'en');
  if (ipa && lang === 'en' && opt.plainEn && plainEnglish(text, ipa, prof)) w.appendChild(el('div', 's plain', text));
  else w.appendChild(el('div', 's', ipa ? IPA.respell(ipa, prof) : '?'));
  const p = el('div', 'p');
  if (ipa) IPA.pinyin(ipa, prof).forEach((s, k, a) => {
    if (s.st) p.appendChild(el('b', '', s.s)); else p.appendChild(document.createTextNode(s.s));
    if (k + 1 < a.length && s.s !== ' ' && a[k + 1].s !== ' ') p.appendChild(document.createTextNode(' '));
  });
  else p.textContent = '?';
  w.appendChild(p);
  if (lang === 'ja' && opt.meanings) {
    const m = el('div', 'm', gloss || '');
    if (gloss) m.title = gloss;
    w.appendChild(m);
  }
  return w;
}

function zhCol(tok) {
  const w = el('div', 'w' + (tok.src === 'unknown' ? ' unknown' : ''));
  const t = el('div', 't', tok.text);
  t.addEventListener('click', () => { if (!Speech.restartFrom(w)) speak(tok.text, 'zh'); });
  w.append(t, el('div', 'p zh', tok.pinyin || '?'));
  return w;
}

function renderLine(line, lang) {
  const div = el('div', 'line');
  if (!line.trim()) { div.classList.add('blank'); return div; }
  const head = el('div', 'lhead');
  head.appendChild(el('span', 'tag', lang.toUpperCase()));
  const spoken = [];   // words in order, for the highlight while reading
  if (lang !== 'ipa' && Speech.has) {
    const b = el('button', 'speak', '🔊');
    b.type = 'button'; b.title = 'Read this line aloud';
    b.addEventListener('click', () => Speech.speakLine(line, speechCode(lang), NAMES[lang], opt.rate, spoken));
    head.appendChild(b);
  }
  div.appendChild(head);
  const words = el('div', 'words');
  const prof = G2P.profile(lang, opt);
  if (lang === 'ipa') {
    for (const chunk of line.trim().split(/\s+/)) {
      const ipa = chunk.replace(/[/[\]]/g, '');
      words.appendChild(ipa ? wordCol(chunk, ipa, prof, 'ipa') : wordCol(chunk, null, prof, 'ipa', 'punct'));
    }
  } else {
    for (const tok of G2P.convertLine(line, lang, opt)) {
      if (tok.kind === 'punct') { const w = el('div', 'w punct'); w.appendChild(el('div', 't', tok.text)); words.appendChild(w); continue; }
      if (lang === 'zh') {   // Chinese: the word and its pinyin only
        const col = zhCol(tok);
        words.appendChild(col);
        spoken.push({ text: tok.text, el: col, weight: [...tok.text].length });
        continue;
      }
      const col = wordCol(tok.text, tok.ipa, prof, lang, tok.src === 'guess' ? 'guess' : tok.src === 'unknown' ? 'unknown' : '', tok.gloss);
      if (tok.note) col.querySelector('.i').title += '\n\n(' + tok.note + ')';
      if (tok.src === 'unknown') col.querySelector('.i').title = 'Not in the dictionary';
      words.appendChild(col);
      const weight = lang === 'ja' ? (tok.kana ? [...tok.kana].filter(c => !/[ゃゅょぁぃぅぇぉャュョァィゥェォ]/.test(c)).length : [...tok.text].length * 2)
        : tok.ipa ? IPA.parse(tok.ipa, prof).reduce((n, w) => n + w.length, 0) : Speech.syllables(tok.text, lang);
      spoken.push({ text: tok.text, el: col, weight });
    }
  }
  const body = el('div', 'lbody');
  body.appendChild(words);
  // Chrome has no Malay translator; Indonesian is close enough
  if (opt.translate && lang !== 'en' && lang !== 'ipa') body.appendChild(lang === 'ms' ?
    Translate.row(line, 'id', 'Malay (via Indonesian)', run) : Translate.row(line, lang, NAMES[lang], run));
  div.appendChild(body);
  return div;
}

let runId = 0;
async function run() {
  const id = ++runId;
  const text = input.value;
  store.set('text', text);
  const lines = text.split(/\r?\n/);
  let block = opt.lang;
  if (block === 'auto') {
    const r = Detect.score(text);
    block = r ? r.lang : 'en';
    $('#detected').textContent = r ? 'Detected: ' + NAMES[block] : '';
  } else $('#detected').textContent = '';
  const plan = lines.map(l => ({ line: l, lang: opt.lang === 'auto' ? Detect.lineLang(l, block) : opt.lang }));
  if (opt.lang === 'auto') {
    const used = [...new Set(plan.filter(p => p.line.trim()).map(p => NAMES[p.lang]))];
    if (used.length > 1) $('#detected').textContent = 'Detected: ' + used.join(', ');
  }
  document.body.classList.toggle('has-zh', plan.some(p => p.lang === 'zh' && p.line.trim()));   // shows "pinyin" in the key
  const need = [...new Set(plan.flatMap(p => G2P.dictsFor(p.lang, opt)))];
  if (need.length) {
    status.textContent = 'Loading ' + need.map(n => DICT_NAMES[n] + ' (' + G2P.DICT_SIZE[n] + ' MB)').join(', ') + '…';
    try { await Promise.all(need.map(G2P.loadDict)); } catch (e) { status.textContent = e.message; return; }
  }
  if (id !== runId) return;
  status.textContent = '';
  const frag = document.createDocumentFragment();
  plan.forEach(p => frag.appendChild(renderLine(p.line, p.lang)));
  output.replaceChildren(frag);
}

let timer = 0;
const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 250); };

// ---------- legend ----------
let legendLang = 'all';
const EDITABLE = r => !/^[◌./[]/.test(r[0]) && !['ˈ', 'ˌ', 'ː', 'ʰ', 'ʷ', '‿'].includes(r[0]);

function saveOverrides() {
  store.set('overrides', overrides);
  IPA.setOverrides(overrides);
  $('#resetAll').hidden = !Object.keys(overrides).length;
  schedule();
}

// Sounds-like cell: an input for symbols, showing the user's override if any.
function likeCell(r) {
  const td = el('td', 'like');
  if (!EDITABLE(r)) { td.textContent = r[1]; return td; }
  const inp = el('input');
  inp.value = overrides[r[0]] !== undefined ? overrides[r[0]] : r[1];
  inp.title = 'Type your own sound-alike for ' + r[0] + ' (used in the output). Default: ' + r[1];
  const reset = el('button', 'reset', '↺');
  reset.type = 'button'; reset.title = 'Back to default: ' + r[1];
  const mark = () => { const on = overrides[r[0]] !== undefined; td.classList.toggle('custom', on); reset.hidden = !on; };
  inp.addEventListener('change', () => {
    const v = inp.value.trim();
    if (!v || v === r[1]) { delete overrides[r[0]]; inp.value = r[1]; } else overrides[r[0]] = v;
    mark(); saveOverrides();
  });
  reset.addEventListener('click', () => { delete overrides[r[0]]; inp.value = r[1]; mark(); saveOverrides(); });
  td.append(inp, reset);
  mark();
  return td;
}

function buildLegend() {
  const mine = Object.keys(overrides).length;
  $('#resetAll').hidden = !mine;
  const chips = $('#legendFilter');
  chips.replaceChildren();
  const filters = [['all', 'All'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['la', 'Latin'], ['ms', 'Malay'], ['ja', 'Japanese'], ['ko', 'Korean']];
  if (mine || legendLang === 'mine') filters.push(['mine', 'My edits (' + mine + ')']);   // only rows with the user's own sound-alike
  filters.forEach(([k, n]) => {
    const b = el('button', (k === legendLang ? 'on' : '') + (k === 'mine' ? ' mine' : ''), n);
    b.type = 'button';
    b.addEventListener('click', () => { legendLang = k; buildLegend(); });
    chips.appendChild(b);
  });
  const body = $('#legendBody');
  body.replaceChildren();
  if (legendLang === 'mine' && !mine) body.appendChild(el('p', 'dlg-note', 'No edits yet. Type your own sound-alike in any "Sounds like" box.'));
  for (const sec of LEGEND.sections) {
    const rows = sec.rows.filter(r => legendLang === 'mine' ? overrides[r[0]] !== undefined :
      legendLang === 'all' || !r[4] || r[4].split(' ').includes(legendLang));
    if (!rows.length) continue;
    body.appendChild(el('h3', '', sec.title + ' (' + rows.length + ')'));
    const tbl = el('table');
    const hr = el('tr');
    ['Symbol', 'Sounds like', 'Example', 'Pinyin', 'Used in'].forEach(h => hr.appendChild(el('th', '', h)));
    tbl.appendChild(hr);
    for (const r of rows) {
      const tr = el('tr', 'row');
      const sym = el('td', 'sym');
      const exs = sec.title === 'Marks' ? [] : legendExamples(r[2]);
      sym.append(r[0]);
      if (exs.length) {
        const b = el('button', 'speak', '🔊');
        b.type = 'button';
        b.title = 'Hear: ' + exs.map(e => e[0] + (e[1] !== 'en' ? ' (' + NAMES[e[1]] + ')' : '')).join(', ');
        b.addEventListener('click', () => speakList(exs));
        sym.append(' ', b);
      }
      tr.appendChild(sym);
      tr.appendChild(likeCell(r));
      const ex = el('td', 'ex'); ex.innerHTML = r[2]; tr.appendChild(ex);
      tr.appendChild(el('td', 'py', r[3]));
      tr.appendChild(el('td', 'lg', r[4]));
      tbl.appendChild(tr);
    }
    body.appendChild(tbl);
  }
}

// ---------- wiring ----------
function applyOpt() {
  $('#lang').value = opt.lang; $('#accent').value = opt.accent; $('#es').value = opt.es; $('#la').value = opt.la; $('#ms').value = opt.ms; $('#pinyin').checked = opt.pinyin;
  $('#plainEn').checked = opt.plainEn;
  $('#translate').checked = opt.translate; $('#meanings').checked = opt.meanings;
  document.body.classList.toggle('show-meanings', opt.meanings);
  document.body.classList.toggle('show-translate', opt.translate);
  $('#rate').value = opt.rate; $('#rateVal').textContent = Number(opt.rate).toFixed(2) + '×';  document.body.classList.toggle('show-pinyin', opt.pinyin);
}
function bind(id, key, prop) {
  $(id).addEventListener('change', e => { opt[key] = e.target[prop]; store.set('settings', opt); applyOpt(); run(); });
}
bind('#lang', 'lang', 'value'); bind('#accent', 'accent', 'value'); bind('#es', 'es', 'value'); bind('#la', 'la', 'value'); bind('#ms', 'ms', 'value'); bind('#pinyin', 'pinyin', 'checked'); bind('#plainEn', 'plainEn', 'checked');
bind('#translate', 'translate', 'checked'); bind('#meanings', 'meanings', 'checked');
input.addEventListener('input', schedule);
$('#rate').addEventListener('input', e => {
  opt.rate = Number(e.target.value); store.set('settings', opt);
  $('#rateVal').textContent = opt.rate.toFixed(2) + '×';
});
$('#clear').addEventListener('click', () => { input.value = ''; run(); input.focus(); });
$('#example').addEventListener('change', e => {
  if (!e.target.value) return;
  input.value = EXAMPLES[e.target.value]; e.target.value = ''; run();
});
$('#legendBtn').addEventListener('click', () => { buildLegend(); $('#voiceSummary').textContent = voiceSummary(); $('#legend').showModal(); });
$('#legendClose').addEventListener('click', () => $('#legend').close());
$('#resetAll').addEventListener('click', () => { overrides = {}; saveOverrides(); buildLegend(); });
$('#legend').addEventListener('click', e => { if (e.target.id === 'legend') $('#legend').close(); });

applyOpt();
input.value = store.get('text', EXAMPLES.fr + '\n\n' + EXAMPLES.en);
run();
})();
