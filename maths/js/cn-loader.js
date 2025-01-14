const VALIDATE = false; //Set to true to enable validations
const VOWELS = {
    a: 'āáǎà',
    e: 'ēéěè',
    o: 'ōóǒò',
    i: 'īíǐì',
    u: 'ūúǔù',
    v: 'ǖǘǚǜü'
};
const VOWELS2 = [
    'āáǎà',
    'ēéěè',
    'ōóǒò',
    'īíǐì',
    'ūúǔù',
    'ǖǘǚǜü'
];
const REGEX_VOWELS = [/([āáǎà])/g, /([ēéěè])/g, /([ōóǒò])/g, /([īíǐì])/g, /([ūúǔù])/g, /([ǖǘǚǜü])/g],
    REPLACE_VOWELS = ['a', 'e', 'o', 'i', 'u', 'v'];
const LEVELS = ['', '小一', '小二', '小三', '小四', '小五', '小六'];
const URL_SEARCH_A = 'https://duckduckgo.com/?q=define+',
    URL_SEARCH_B = 'https://www.omgchinese.com/dictionary/chinese/',
    URL_SEARCH = URL_SEARCH_B;

function printTranslations(translations, line) //for Validation
{
    const cnt = line.length,
        cnt2 = translations.length;
    console.log(cnt === cnt2? 'ok': 'XXX mismatched!', cnt, 'vs', cnt2, line, translations);
    for (let k = 0; (k < cnt2) || (k < cnt); ++k)
    {
        console.log(line.charAt(k), translations[k]);
    }
}

/*
    Return what the given pinyin sounds like, i.e. remove accent
    @param word (string) Pinyin like 'gōng'
    @return (string) Pinyin without accent like 'gong'
*/
function soundsLike(pinyin)
{
    for (let i = 0; i < REGEX_VOWELS.length; ++i)
        pinyin = pinyin.replaceAll(REGEX_VOWELS[i], REPLACE_VOWELS[i]);
    return pinyin;
}

/*
    Return the given pinyin (e.g.: 'yǔ') in 2 parts:
    1. pinyin without accent, e.g.: yu
    2. its accent number, e.g.: 3
    @param word (string) Pinyin like 'gōng'
    @return (array: [string, int]) array of 2 pinyin forms, e.g.: ['yu', 3]
*/
function pinyinParts(pinyin)
{
    let j, m;
    for (j = 0; j < REGEX_VOWELS.length; ++j)
    {
        REGEX_VOWELS[j].lastIndex = 0; //also reset before reuse!
        m = REGEX_VOWELS[j].exec(pinyin);
        if (m && m[1])
        {
            const num = VOWELS2[j].indexOf(m[1]);
            let py = pinyin.replace(m[1], REPLACE_VOWELS[j]);
            return [py, num + 1];
        }
    }
    return [pinyin, 5];
}

//global data
let wordKeys, cntWords,
    levels, seen = '',
    dic = {}, dicSound = {},
    dicByLevels = {},
    level = 'P1A',
    lvl = 1,
    showPinyin = true;

function loadDictionary()
{
    const lines = words.split(/\n/);
    dic = {}; dicSound = {}; //reset, in case of levels choice changes

    let i, lesson;
    let lastTranslations, lastLine; //for Validation
    for (i = 0; i < lines.length; ++i)
    {
        let line = lines[i];
        if ((line.length === 3) && (line[0] === 'P')
            && (line[1] >= '1') && (line[1] <= '9'))
        {
            level = line;
            lvl = parseInt(level[1], 10);
            dicByLevels[level] = [];
            lesson = 0;
            continue;
        }

        //read chinese chars to learn
        let cnt = line.length;
        ++lesson;
        dicByLevels[level][lesson] = { read: line };
        // and read hanyu pinyin of above chars
        const pinyins = lines[i+1].split(' ');
        let j;
        for (j = 0; j < cnt; ++j)
        {
            const ch = line[j];
            if (dic[ch] === undefined)
            {
                //validation //Use this to check new data!
                if (VALIDATE && (pinyins[j] === undefined)) console.log('Missing pinyin for:', ch);

                //const group = soundsLike(pinyins[j]);
                const [ group, accNum ] = pinyinParts(pinyins[j]);
                dic[ch] = {
                    pinyin: pinyins[j],
                    level: level,
                    lvl: lvl,
                    soundsLike: group,
                    accNum: accNum
                };
                if (dicSound[group] === undefined)
                {
                    dicSound[group] = [];
                }
                dicSound[group].push(ch);

                if (VALIDATE)
                {
                    //Check if pinyin has no accent. Althougth there's 'silent' accents, we'll remove it for simplicity
                    if (!checkHasAccent(dic[ch]))
                    {
                        console.log('Cannot find accented vowel!? (maybe a silent sound) for ', ch, dic[ch].pinyin);
                    }
                }
            }
            else console.log('repeated:', ch);
        }
        //read english translation if any
        i += 2;
        const lineEn = lines[i];
        if ((lineEn.length >= 2) && (lineEn.charCodeAt(1) < 200))
        {
            const translations = lineEn.split(',');
            //validation: ensure as many translations as chars (if translations line is provided)
            if (VALIDATE)
            {
                if (translations.length > 0)
                {
                    lastTranslations = translations;
                    lastLine = line;
                    if (translations.length !== cnt)
                    {
                        console.log('Warning! More/less translations for line:', line, '#', cnt, 'vs', translations.length, lineEn);
                        printTranslations(translations, line);
                    }
                }
            }

            for (j = 0; j < cnt; ++j)
            {
                const ch = line[j];
                dic[ch].en = translations[j];
            }
            line = lines[i+1];
            ++i;
        }
        else line = lineEn;
        //read chinese chars to write
        // verify leading 'w'
        //if (line[0] === 'w') //OK
        line = line.substring(1); //remove leading 'w'
        dicByLevels[level][lesson].write = line;
        cnt = line.length;
        for (j = 0; j < cnt; ++j)
        {
            const ch = line[j];
            if (dic[ch])
                dic[ch].write = true;
        }
    }
    if (VALIDATE) printTranslations(lastTranslations, lastLine); //for validation, show last entered translations line
    wordKeys = Object.keys(dic);
    cntWords = wordKeys.length;
}

function loadDictionary2()
{
    const lines = wordsCnEn.split(/\n/);

    let i, ch;
    for (i = 0; i < lines.length; ++i)
    {
        let line = lines[i];
        if ((line.length >= 2) && (line[1] === '>'))
        {
            ch = line[0];
            if (dic[ch] !== undefined)
            {
                dic[ch].phrases = [];
                if (line.length >= 3)
                {
                    dic[ch].en2 = line.substring(2);
                }
            }
            continue;
        }

        //read phrases and their translations on each line
        const content = line.split('>');
        dic[ch].phrases.push({
            phrase: content[0],
            pinyin: content[1],
            en: content[2]
        });
    }

    //Validation: check that all words have phrases data
    // Note: no meaning/translation for 垃,圾,椰,著
    if (VALIDATE)
    {
        const words = Object.keys(dic);
        for (i = 0; i < words.length; ++i)
        {
            ch = words[i];
            if (dic[ch].phrases === undefined)
            {
                console.log('WRN: Missing phrases data for', ch);
            }
        }
    }
}
