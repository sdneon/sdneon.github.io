// Kana -> morae with Hepburn romaji that spells the sound (long vowels, particles, small tsu marked).
(function (g) {
'use strict';
const ROMA = {};
('あa いi うu えe おo かka きki くku けke こko がga ぎgi ぐgu げge ごgo さsa しshi すsu せse そso ざza じji ずzu ぜze ぞzo ' +
 'たta ちchi つtsu てte とto だda ぢji づzu でde どdo なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho ばba びbi ぶbu べbe ぼbo ' +
 'ぱpa ぴpi ぷpu ぺpe ぽpo まma みmi むmu めme もmo やya ゆyu よyo らra りri るru れre ろro わwa ゐwi ゑwe をo んn ゔvu ' +
 'ぁa ぃi ぅu ぇe ぉo ゃya ゅyu ょyo ゎwa').split(' ').forEach(p => { ROMA[p[0]] = p.slice(1); });
const SMALL = new Set([...'ゃゅょぁぃぅぇぉゎ']);
const hira = c => { const k = c.charCodeAt(0); return k >= 0x30a1 && k <= 0x30f6 ? String.fromCharCode(k - 0x60) : c; };
const kata = c => { const k = c.charCodeAt(0); return k >= 0x3041 && k <= 0x3096 ? String.fromCharCode(k + 0x60) : c; };
const VOWEL = { a: 1, i: 1, u: 1, e: 1, o: 1 };

// Base romaji + small kana: shi+ゃ -> sha, ki+ゃ -> kya, fu+ぁ -> fa, te+ぃ -> ti, u+ぃ -> wi.
function combine(r, small) {
  const v = ROMA[small].slice(-1);
  if ('ゃゅょ'.includes(small)) {
    if (/^(sh|ch|j)i$/.test(r)) return r.slice(0, -1) + v;
    if (r.endsWith('i')) return r.slice(0, -1) + 'y' + v;
    return r + ROMA[small];
  }
  const stem = { fu: 'f', tsu: 'ts', te: 't', de: 'd', u: 'w', shi: 'sh', chi: 'ch', ji: 'j', vu: 'v' }[r];
  return (stem !== undefined ? stem : r.replace(/[aiueo]$/, '')) + v;
}

function lastVowel(out) {
  for (let i = out.length - 1; i >= 0; i--) { const r = out[i].r; if (r && VOWEL[r.slice(-1)]) return r.slice(-1); if (r) return ''; }
  return '';
}

// o: { verb, particle, noLong, stem, waEnd } from the dictionary token (see kanaToIpa in g2p.js).
function morae(kana, o = {}) {
  const chars = [...kana], out = [];
  const stem = o.stem === undefined ? Infinity : o.stem;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], c = hira(ch);
    const prev = out[out.length - 1];
    if (SMALL.has(c) && prev && prev.r && !prev.gem) { prev.k += ch; prev.r = combine(prev.r, c); continue; }
    if (c === 'っ') { out.push({ k: ch, r: '', gem: true }); continue; }
    if (c === 'ー') {
      const pv = lastVowel(out);
      out.push({ k: ch, r: pv, cls: 'long', note: 'long vowel mark: hold the “' + pv + '” longer' });
      continue;
    }
    const r = ROMA[c];
    if (r === undefined) { out.push({ k: ch, r: '' }); continue; }
    const pv = lastVowel(out);
    if (!o.noLong && prev && ((c === 'う' && (pv === 'o' || (pv === 'u' && i < stem))) || (c === 'い' && pv === 'e' && i < stem)) &&
        !(o.verb && c === 'う' && i === chars.length - 1)) {
      out.push({ k: ch, r: pv, cls: 'long', note: 'written ' + r + ', but it just makes the “' + pv + '” long' });
      continue;
    }
    if (o.waEnd && c === 'は' && i === chars.length - 1) { out.push({ k: ch, r: 'wa', cls: 'diff', note: 'this は was once a particle, so it is said “wa”' }); continue; }
    if (o.particle && c === 'は') { out.push({ k: ch, r: 'wa', cls: 'diff', note: 'particle は is said “wa” (normally “ha”)' }); continue; }
    if (o.particle && c === 'へ') { out.push({ k: ch, r: 'e', cls: 'diff', note: 'particle へ is said “e” (normally “he”)' }); continue; }
    if (c === 'を') { out.push({ k: ch, r: 'o', note: 'を (wo) is said “o”; used only as the object particle' }); continue; }
    out.push({ k: ch, r });
  }
  out.forEach((m, i) => {
    if (!m.gem) return;
    const n = out[i + 1] && out[i + 1].r;
    m.r = n ? (n.startsWith('ch') ? 't' : VOWEL[n[0]] ? '' : n[0]) : '';
    m.cls = 'gem';
    m.note = 'small tsu: a short pause that doubles the next consonant' + (m.r ? ' (' + m.r + m.r + ')' : '');
  });
  return out;
}

// Kana chart rows: [title, [kana or '' gaps]].
// Kana chart rows; '|' separates a base row from its voiced (゛ ゜) forms shown to its right: はひふへほ|ばびぶべぼ|ぱぴぷぺぽ.
const CHART = [
  ['Basic (gojūon) | with ゛ and ゜ (voiced)', ['あいうえお', 'かきくけこ|がぎぐげご', 'さしすせそ|ざじずぜぞ',
    'たちつてと|だぢづでど', 'なにぬねの', 'はひふへほ|ばびぶべぼ|ぱぴぷぺぽ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わ   を', 'ん    ']],
];
const YOUON = ['き|ぎ', 'し|じ', 'ち', 'に', 'ひ|び|ぴ', 'み', 'り'].map(r => r.split('|').map(b => [b + 'ゃ', b + 'ゅ', b + 'ょ']));
const LOAN = [['ファ', 'フィ', 'フェ', 'フォ'], ['ティ', 'ディ', 'トゥ', 'ドゥ'], ['ウィ', 'ウェ', 'ウォ', 'ヴァ'], ['シェ', 'ジェ', 'チェ', 'ツァ']];

function romaji(kana) { return morae(kana).map(m => m.r).join(''); }

g.Kana = { morae, romaji, hira, kata, CHART, YOUON, LOAN };
})(window);
