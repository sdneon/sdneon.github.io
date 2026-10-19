// Guesses the language of a text: IPA, Korean, Japanese, Chinese, or en/es/fr/de/it/la by common words and letters.
(function (g) {
'use strict';
const IPA_RE = /[əɪʊʃʒθðŋɑɒɔɛɜʌæɹʁɐɲʎβɣɕʑɯɴɾʔˈˌːɝɚɫɥʏ]/g;
const STOP = {
  en: 'the and of to is you that it in was for on are with this be have not what i he she we they my your a an would like please',
  es: 'el la de que y en los las por un una es con para se del no al lo como más pero su sus yo muy está estás me te',
  fr: 'le la les de des et est un une que qui en pas pour dans je vous il elle au du ce ne sur avec nous mon ma mes très',
  de: 'der die das und ist nicht ich du sie es ein eine zu mit den dem von auf für sich auch wir ihr sind bitte wie',
  it: 'il lo gli di che e è non sono per una con del della delle dei nel alla ma anche questo questa molto io tu lui lei noi voi ciao grazie mi ti ci sei come',
  la: 'sed quod ut quae quid enim sunt esse hoc etiam atque neque autem ergo nec sum nos vos ego deus dominus sine inter ab ex cum est et in ad',
};
const SETS = {};
for (const L in STOP) SETS[L] = new Set(STOP[L].split(' '));
// è ends words only in Italian (è, caffè); in French it is inside a word (mère)
const CHARS = { es: /[ñ¿¡áíóú]/g, fr: /[çœêàùâîôûëïÿ]|è(?=\p{L})/gu, de: /[äöüß]/g,
  it: /[ìò]|[àèù](?!\p{L})|zz|cch|gli|zion|(^|[^\p{L}])(dell|nell|all|dall|sull|quest|un)['’]/gu };

function score(text) {
  const t = text.trim();
  if (!t) return null;
  if (/^[/[].*[/\]]$/.test(t)) return { lang: 'ipa', conf: 9 };
  const letters = (t.match(/\p{L}/gu) || []).length || 1;
  const ipaN = (t.match(IPA_RE) || []).length;
  if (ipaN && ipaN / letters >= 0.03) return { lang: 'ipa', conf: 9 };
  const hang = (t.match(/[가-힯]/g) || []).length;
  const ja = (t.match(/[぀-ヿ一-鿿]/g) || []).length;
  if (hang && hang >= ja) return { lang: 'ko', conf: 9 };
  // Han characters: Japanese if there is any kana, else Chinese
  if (ja) return { lang: /[぀-ヿ]/.test(t) ? 'ja' : 'zh', conf: 9 };
  const low = t.toLowerCase();
  const words = low.split(/[^\p{L}']+/u).filter(Boolean);
  const sc = { en: 0, es: 0, fr: 0, de: 0, it: 0, la: 0 };
  for (const L in SETS) for (const w of words) if (SETS[L].has(w)) sc[L]++;
  for (const L in CHARS) sc[L] += 2 * (low.match(CHARS[L]) || []).length;
  // Latin endings: -us/-um/-ae/-is words, -orum/-arum/-ibus, -que, macrons
  for (const w of words) {
    if (/^\p{L}{3,}(orum|arum|ibus)$/u.test(w) || /[āēīōū]/.test(w)) sc.la += 2;
    else if (/^\p{L}{2,}(us|um|ae|que)$/u.test(w)) sc.la += 1;
  }
  sc.fr += 2 * (low.match(/(^|[^\p{L}])(l|d|j|qu|c|n|s|m)['’](?!è(?!\p{L}))\p{L}/gu) || []).length;   // not Italian c'è
  let best = 'en';
  for (const L in sc) if (sc[L] > sc[best]) best = L;
  return { lang: best, conf: sc[best] };
}

// A short or unclear line takes the language of the whole text.
function lineLang(line, blockLang) {
  const r = score(line);
  if (!r) return blockLang;
  if (r.lang === 'zh' && blockLang === 'ja') return 'ja';   // a kanji-only line in Japanese text (東京都)
  if (r.lang === 'ipa' || r.lang === 'ko' || r.lang === 'ja' || r.lang === 'zh') return r.lang;
  return r.conf >= 2 ? r.lang : blockLang;
}

g.Detect = { score, lineLang };
})(window);
