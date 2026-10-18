// Japanese Reader page: words -> kana cells with romaji, meanings, translation, kana chart.
(function () {
'use strict';
const $ = s => document.querySelector(s);
const EXAMPLES = [
  'こんにちは。私は学生です。\nはじめまして、どうぞよろしく。',
  '毎朝コーヒーを飲みます。\n昨日、友達と映画を見ました。\n日本語を勉強しています。',
  'コンビニでパンとジュースを買いました。\nスマートフォンでメールを送ります。',
];
const store = {
  get(k, d) { try { const v = localStorage.getItem('jp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('jp.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const opt = Object.assign({ meanings: true, translate: true, katakana: false, rate: 0.7 }, store.get('settings', {}));
const input = $('#input'), output = $('#output'), status = $('#status');

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const speak = text => Speech.speak([[text, 'ja-JP', 'Japanese']], opt.rate);
const toKata = s => [...s].map(Kana.kata).join('');

function wordBlock(tok) {
  const w = el('div', 'jw');
  const orig = el('div', 'orig', tok.text);
  if (tok.kana === tok.text) orig.classList.add('same');
  w.appendChild(orig);
  const row = el('div', 'mo-row');
  // Spoken alone, a word is read from its kana as it sounds (私 → わたし, particle は → わ), not from the kanji.
  const say = m => (m.cls === 'diff' ? { wa: 'わ', e: 'え' }[m.r] || m.k : m.k);
  let spoken = tok.text;
  if (!tok.kana) row.appendChild(el('span', 'mo unknown', '?'));
  else {
    const kana = opt.katakana ? toKata(tok.kana) : tok.kana;
    const mo = Kana.morae(kana, tok);
    spoken = mo.map(say).join('');
    for (const m of mo) {
      const cell = el('span', 'mo' + (m.cls ? ' ' + m.cls : ''));
      cell.append(el('span', 'k', m.k), el('span', 'r', m.r || ' '));
      if (m.note) cell.title = m.note;
      cell.addEventListener('click', () => { if (!Speech.restartFrom(w)) speak(say(m)); });
      row.appendChild(cell);
    }
  }
  // while its line is being read, a click restarts the reading from this word
  orig.addEventListener('click', () => { if (!Speech.restartFrom(w)) speak(spoken); });
  w.appendChild(row);
  if (opt.meanings) w.appendChild(el('div', 'm', tok.gloss || ''));
  return w;
}

function renderLine(line) {
  const div = el('div', 'line');
  if (!line.trim()) { div.classList.add('blank'); return div; }
  const head = el('div', 'lhead');
  const spoken = [];   // words in order, for the highlight while reading
  if (Speech.has) {
    const b = el('button', 'speak', '🔊');
    b.type = 'button'; b.title = 'Read this line aloud';
    b.addEventListener('click', () => Speech.speakLine(line, 'ja-JP', 'Japanese', opt.rate, spoken));
    head.appendChild(b);
  }
  div.appendChild(head);
  const words = el('div', 'words');
  for (const tok of G2P.convertLine(line, 'ja', opt)) {
    if (tok.kind === 'punct') { const p = el('div', 'jw punct'); p.appendChild(el('div', 'orig', tok.text)); words.appendChild(p); continue; }
    const wb = wordBlock(tok);
    words.appendChild(wb);
    spoken.push({ text: tok.text, el: wb, weight: tok.kana ? Kana.morae(tok.kana, tok).length : [...tok.text].length * 2 });
  }
  const body = el('div', 'lbody');
  body.appendChild(words);
  if (opt.translate && /[぀-ヿ一-鿿]/.test(line)) body.appendChild(Translate.row(line, 'ja', 'Japanese', run));
  div.appendChild(body);
  return div;
}

let runId = 0;
async function run() {
  const id = ++runId;
  store.set('text', input.value);
  const need = G2P.dictsFor('ja', { meanings: opt.meanings });
  status.textContent = 'Loading Japanese dictionary…';
  try { await Promise.all(need.map(G2P.loadDict)); } catch (e) { status.textContent = e.message; return; }
  if (id !== runId) return;
  status.textContent = '';
  const frag = document.createDocumentFragment();
  input.value.split(/\r?\n/).forEach(l => frag.appendChild(renderLine(l)));
  output.replaceChildren(frag);
}
let timer = 0;
const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 250); };

// ---------- kana chart ----------
let script = 'h';
function chartCell(k) {
  const td = el('td', k.trim() ? 'kc' : 'kc gap');
  if (!k.trim()) return td;
  const shown = script === 'k' ? toKata(k) : k;
  if (script === 'hk' && toKata(k) !== k) {
    td.classList.add('pair');
    const pair = el('span', 'k');
    pair.append(k, el('span', 'kk', toKata(k)));
    td.append(pair, el('span', 'r', Kana.romaji(k)));
  } else td.append(el('span', 'k', shown), el('span', 'r', Kana.romaji(shown)));
  td.addEventListener('click', () => speak(shown));
  return td;
}
// rows: [[group of kana], ...]; groups after the first (voiced forms) are shaded, with a gap between groups.
function chartTable(rows) {
  const t = el('table', 'kana-table');
  for (const r of rows) {
    const tr = el('tr');
    r.forEach((grp, gi) => {
      if (gi) tr.appendChild(el('td', 'sep'));
      grp.forEach(k => { const td = chartCell(k); if (gi) td.classList.add('voiced'); tr.appendChild(td); });
    });
    t.appendChild(tr);
  }
  return t;
}
function buildChart() {
  const body = $('#chartBody');
  body.replaceChildren();
  for (const [title, rows] of Kana.CHART) {
    body.appendChild(el('h3', '', title));
    body.appendChild(chartTable(rows.map(r => r.split('|').map(g => [...g]))));
  }
  body.appendChild(el('h3', '', 'Combined with small ゃ ゅ ょ | voiced'));
  body.appendChild(chartTable(Kana.YOUON));
  if (script !== 'h') {
    body.appendChild(el('h3', '', 'Extra katakana for foreign sounds'));
    const t2 = el('table', 'kana-table');
    for (const r of Kana.LOAN) { const tr = el('tr'); r.forEach(k => tr.appendChild(chartCell(k))); t2.appendChild(tr); }
    body.appendChild(t2);
  }
  body.appendChild(el('h3', '', 'Marks'));
  const notes = el('ul', 'chart-notes');
  [['っ / ッ', 'small tsu: short pause, doubles the next consonant (きって = kitte)'],
    ['ー', 'katakana long vowel: hold the previous vowel (コーヒー = kōhī)'],
    ['おう / えい', 'in many words just a long o / long e (とうきょう = tōkyō, せんせい = sensē)'],
    ['は / へ / を', 'as particles said wa / e / o']].forEach(([a, b]) => { const li = el('li'); li.append(el('b', '', a), ' ' + b); notes.appendChild(li); });
  body.appendChild(notes);
  document.querySelectorAll('#chart .chips button').forEach(b => b.classList.toggle('on', b.dataset.script === script));
}

// ---------- wiring ----------
function applyOpt() {
  $('#meanings').checked = opt.meanings; $('#translate').checked = opt.translate; $('#katakana').checked = opt.katakana;
  $('#rate').value = opt.rate; $('#rateVal').textContent = Number(opt.rate).toFixed(2) + '×';  document.body.classList.toggle('show-meanings', opt.meanings);
  document.body.classList.toggle('show-translate', opt.translate);
}
['meanings', 'translate', 'katakana'].forEach(k => $('#' + k).addEventListener('change', e => {
  opt[k] = e.target.checked; store.set('settings', opt); applyOpt(); run();
}));
$('#rate').addEventListener('input', e => { opt.rate = Number(e.target.value); store.set('settings', opt); applyOpt(); });input.addEventListener('input', schedule);
$('#clear').addEventListener('click', () => { input.value = ''; run(); input.focus(); });
$('#example').addEventListener('change', e => { if (e.target.value === '') return; input.value = EXAMPLES[+e.target.value]; e.target.value = ''; run(); });
$('#chartBtn').addEventListener('click', () => { buildChart(); $('#chart').showModal(); });
$('#chartClose').addEventListener('click', () => $('#chart').close());
$('#chart').addEventListener('click', e => { if (e.target.id === 'chart') $('#chart').close(); });
document.querySelectorAll('#chart .chips button').forEach(b => b.addEventListener('click', () => { script = b.dataset.script; buildChart(); }));

applyOpt();
input.value = store.get('text', EXAMPLES[0] + '\n' + EXAMPLES[1]);
run();
})();
