// Guesses the language of a text: IPA, Korean, Japanese, Chinese, or en/es/fr/de by common words and letters.
(function (g) {
'use strict';
const IPA_RE = /[əɪʊʃʒθðŋɑɒɔɛɜʌæɹʁɐɲʎβɣɕʑɯɴɾʔˈˌːɝɚɫɥʏ]/g;
const STOP = {
  en: 'the and of to is you that it in was for on are with this be have not what i he she we they my your a an would like please',
  es: 'el la de que y en los las por un una es con para se del no al lo como más pero su sus yo muy está estás me te',
  fr: 'le la les de des et est un une que qui en pas pour dans je vous il elle au du ce ne sur avec nous mon ma mes très',
  de: 'der die das und ist nicht ich du sie es ein eine zu mit den dem von auf für sich auch wir ihr sind bitte wie',
};
const SETS = {};
for (const L in STOP) SETS[L] = new Set(STOP[L].split(' '));
const CHARS = { es: /[ñ¿¡áíóú]/g, fr: /[çœèêàùâîôûëïÿ]/g, de: /[äöüß]/g };

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
  const sc = { en: 0, es: 0, fr: 0, de: 0 };
  for (const L in SETS) for (const w of words) if (SETS[L].has(w)) sc[L]++;
  for (const L in CHARS) sc[L] += 2 * (low.match(CHARS[L]) || []).length;
  sc.fr += 2 * (low.match(/(^|[^\p{L}])(l|d|j|qu|c|n|s|m)['’]\p{L}/gu) || []).length;
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
