// Line translation to English with Chrome's built-in on-device Translator. Shared by both pages.
(function (g) {
'use strict';
const translators = {};          // lang -> Promise<Translator>
const cache = new Map();         // lang + '\n' + line -> English
const has = typeof Translator !== 'undefined';

function get(lang, onProgress) {
  if (!translators[lang]) {
    translators[lang] = Translator.create({
      sourceLanguage: lang, targetLanguage: 'en',
      monitor(m) { m.addEventListener('downloadprogress', e => { if (onProgress) onProgress(e.loaded); }); },
    }).catch(e => { delete translators[lang]; throw e; });
  }
  return translators[lang];
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// A row that fills with the translation; offers a one-time model download first. onReady runs after a download.
function row(line, lang, langName, onReady) {
  const r = el('div', 'tr');
  const key = lang + '\n' + line;
  if (cache.has(key)) { r.textContent = cache.get(key); return r; }
  const fail = msg => { r.textContent = msg; r.classList.add('note'); };
  if (!has) { fail('Translation needs Chrome 138 or later.'); return r; }
  r.textContent = '…';
  (async () => {
    try {
      const av = translators[lang] ? 'available' : await Translator.availability({ sourceLanguage: lang, targetLanguage: 'en' });
      if (av === 'unavailable') { fail('No ' + langName + ' translator in this browser.'); return; }
      if (av !== 'available') {
        r.textContent = '';
        r.classList.add('note');
        const b = el('button', 'get-tr', 'Download ' + langName + ' → English translator');
        b.type = 'button';
        b.title = 'One-time download by Chrome; afterwards translation works offline';
        b.addEventListener('click', async () => {
          b.disabled = true; b.textContent = 'Downloading…';
          try {
            await get(lang, p => { b.textContent = 'Downloading… ' + Math.round(p * 100) + '%'; });
            onReady();
          } catch (e) { b.textContent = 'Download failed: ' + e.message; }
        });
        r.append(b, ' one time, then it works offline');
        return;
      }
      const en = await (await get(lang)).translate(line);
      cache.set(key, en);
      r.textContent = en;
    } catch (e) { fail('Translation failed: ' + e.message); }
  })();
  return r;
}

g.Translate = { has, row };
})(window);
