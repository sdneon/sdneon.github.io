# Do U Read Me?

(The Japanese page, `japanese.html`, is **Kana Do!**)

A static web page for learning to read IPA phonetics, for English speakers.
Paste English, Spanish, French, German, Italian, Latin, Japanese or Korean text (or IPA itself).
Under each word you get its IPA, an English-style sound-alike (stressed syllable in CAPITALS) and, optionally, a Hanyu Pinyin approximation.
Chinese (Simplified or Traditional) gets Hanyu Pinyin under each word.

Translations to English available too.

`japanese.html` (Kana Do!): Japanese text → kana per word with romaji under each kana, meanings, translation and a kana chart.

Idea by Neon 😁 Built by Claude Code.

## Usage

Open `index.html` in a browser. No server needed.

- **Legend** button: every symbol these languages use, with its sound-alike, example and pinyin hint.
  The sound-alikes are editable. Your edits are saved in the browser and used in the output.
- Language is detected per line. The dropdown can force one.
- Read Aloud (uses the browser's installed voices)
  - Click a word to hear it.
  - Click Speaker button to read the whole block.
    - Click any word to interrupt and restart reading from that word.
    - Words are highlighted as they're read.
      May go out of sync especially if Google voice is used. If so, do the above.
- Translation needs Chrome 138 or later.

## Files

| Path | What |
|---|---|
| `index.html`, `css/app.css` | page |
| `js/app.js` | IPA page: UI, rendering, legend dialog |
| `japanese.html`, `js/japanese.js`, `js/kana.js` | Kana Do! (Japanese) page; kana → morae + romaji |
| `js/speech.js`, `js/translate.js` | reading aloud and translation, shared by both pages |
| `js/ipa.js` | IPA → syllables → respelling / pinyin |
| `js/g2p.js` | text → IPA per language (dictionaries + rules) |
| `js/detect.js` | language detection |
| `js/legend-data.js` | symbol table for the legend and hover hints |
| `dict/*.js` | generated dictionaries |
| `tools/build-dicts.js` | builds `dict/` from the raw downloads |
| `tools/kaikki-to-ipadict.js` | Wiktionary (kaikki.org) dump → `word<TAB>/ipa/` list (used for Italian, Latin) |
| `tools/raw-dicts/` | the raw downloads (sources below) |

## Rebuilding the dictionaries

Run `node tools/build-dicts.js`. It reads `tools/raw-dicts/`, which holds:
- `en_UK.txt en_US.txt fr_FR.txt de.txt ko.txt` from https://github.com/open-dict-data/ipa-dict (`data/`)
  (`es_ES.txt` and `ja.txt` are there too but unused: Spanish is rule-based, Japanese uses JMdict)
- `JMdict_e.gz` from http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz (`edict2.gz` from the same place is the fallback)
- `google-10000-english-no-swears.txt` from https://github.com/first20hours/google-10000-english, saved as `google-10000.txt`

- `cedict.txt.gz` from https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz (CC-CEDICT)
- `jieba-dict.txt` from https://github.com/fxsjy/jieba (`jieba/dict.txt`, word counts for splitting Chinese)
- `it.txt`: Italian, made from https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl.gz
  (English Wiktionary extract, 76 MB, not kept) with `node tools/kaikki-to-ipadict.js <download> tools/raw-dicts/it.txt`
- `la_cl.txt`, `la_ec.txt`: Latin, from https://kaikki.org/dictionary/Latin/kaikki.org-dictionary-Latin.jsonl.gz (108 MB,
  not kept) with `node tools/kaikki-to-ipadict.js <download> tools/raw-dicts/la_cl.txt Classical-Latin` and
  `… tools/raw-dicts/la_ec.txt -` (ecclesiastical = the untagged pronunciation)

To update a source, download a newer copy over the old file and rebuild.

## Data licences

- ipa-dict: MIT (https://github.com/open-dict-data/ipa-dict)
- google-10000-english: personal/educational use (LDC licence + Norvig MIT)
- CC-CEDICT: CC BY-SA 4.0 (https://www.mdbg.net/chinese/dictionary?page=cc-cedict)
- jieba dictionary: MIT (https://github.com/fxsjy/jieba)
- Wiktionary (Italian and Latin pronunciations, via kaikki.org / wiktextract): CC BY-SA 4.0 and GFDL
- JMdict / EDICT2: CC BY-SA 4.0, © Electronic Dictionary Research and Development Group (https://www.edrdg.org/edrdg/licence.html)
