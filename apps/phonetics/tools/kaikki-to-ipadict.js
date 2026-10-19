// Extracts word<TAB>/ipa/ lines (ipa-dict format) from a kaikki.org Wiktionary JSONL dump.
// Usage: node tools/kaikki-to-ipadict.js <kaikki.jsonl[.gz]> <out.txt> [tag]
// Without tag: first phonemic (/…/) pronunciation per word; one without regional tags wins over a tagged one.
// With tag: first pronunciation (/…/ or […]) carrying that tag, or "-" for one with no tags
// (Latin: Classical-Latin = classical, - = ecclesiastical).
'use strict';
const fs = require('fs'), zlib = require('zlib'), readline = require('readline');
const [src, out, tag] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node tools/kaikki-to-ipadict.js <in.jsonl[.gz]> <out.txt> [tag|-]'); process.exit(1); }
let input = fs.createReadStream(src);
if (src.endsWith('.gz')) input = input.pipe(zlib.createGunzip());
const best = new Map();   // word -> { ipa, tagged }
const rl = readline.createInterface({ input, crlfDelay: Infinity });
rl.on('line', line => {
  if (!line.includes('"ipa"')) return;
  let e;
  try { e = JSON.parse(line); } catch (err) { return; }
  const w = e.word;
  if (!w || /[\s\d]/.test(w) || !Array.isArray(e.sounds) || (tag && best.has(w))) return;
  for (const s of e.sounds) {
    if (!s.ipa) continue;
    const tags = s.tags || [];
    if (tag) {
      if (!/^[/[].+[/\]]$/.test(s.ipa) || (tag === '-' ? tags.length : !tags.includes(tag))) continue;
      best.set(w, { ipa: '/' + s.ipa.slice(1, -1) + '/' });
      break;
    }
    if (!/^\/.+\/$/.test(s.ipa)) continue;
    const tagged = tags.length > 0;
    const b = best.get(w);
    if (!b || (b.tagged && !tagged)) best.set(w, { ipa: s.ipa, tagged });
    if (!tagged) break;
  }
});
rl.on('close', () => {
  const lines = [...best].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([w, v]) => w + '\t' + v.ipa);
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(lines.length, 'words ->', out);
});
