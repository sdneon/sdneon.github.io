//Careers: the game (board drawing, turns, rules, score sheets, options); rules decisions in careers-design.md
let UNIT = 54; //px per board unit
/*
players: { id (in PLAYERS), cash, salary, fame, hearts, degree: '' or a key of DEGREES or PLAIN_DEGREE,
    at: outer square index, path: career path name or '', step: index in its path (-1: on its entrance),
    stuck: 'hospital' | 'unemployment' | '', skip: turns to lose, doubleHearts: the path whose hearts count double,
    opp: Opportunity cards held, exp: Experience cards held (squares to move),
    formula: { money (points: $1,000 each), fame, hearts }: the secret Success Formula,
    record: { path name: times completed }, history: { salary, fame, hearts: every value, latest last } (score sheet),
    throws: how many turns the player has thrown in (the formula is fixed from the first),
    lean: their recent gains and the pin it earns (tallyLean) }
*/
let players = [],
    who = 0,
    rolled = false, //thrown (or a card played) this turn
    moved = false, //moved this turn
    target = null, //where the throw takes the player: { at, path, step, passPay, done }
    queue = [], //choices waiting for the player: { kind, ... } (see choiceOptions)
    busy = false, //dice rolling: wait
    again = false, //the player throws again once this move is over
    cardPlayed = false, //a card has been played this turn (1 a turn)
    oppUsed = false, //an Opportunity card has been played this turn
    drawnNow = [], //numbers (card[4]) of the Opportunity cards the player whose turn it is drew this turn: playable at once
    gameOver = false,
    oppDeck = [], //Opportunity Knocks cards, top first
    expDeck = [], //Experience cards (squares to move), top first
    revealAll = false, //show everyone's cash and scores (for debugging); else only the current player's
    gameRun = 0, //goes up with each new game: a computer player's pending action from an older game is dropped
    diceOne, diceTwo;
let DICE_MS = 2000; //(as Hotels) dice roll for this long before their throw counts (the page test sets 0)
const OPTIONS_KEY = 'careers.options',
    //anyDegree: any degree lets you into Big Business and Sports free, else only the plain College degree
    //success: points in a Success Formula; ai: { player id: level in AI_LEVELS } (computer players); aiPause: they wait for Go!
    //aiReview: after a computer player's turn, wait for Next Player (when a person plays too)
    //casual ('cheat') mode: people may roll again before moving, and move 1 square short of or past the glowing one
    DEFAULT_OPTIONS = { cash: 1000, salary: 1000, bumpCard: true, anyDegree: true, success: 60, players: [0, 1, 2], //players: ids in PLAYERS
        ai: { 1: 'smart' }, aiPause: false, aiReview: true, casual: true, theme: 'vivid' }; //theme: a key of BOARD_THEMES (themes.js)
let options = { ...DEFAULT_OPTIONS };

/*
Message area (as Hotels'): what happens this turn, a line per action (STATUS_HTML starts a line, appendStatus adds to
it); every line also goes into the History window, with a heading per turn.
*/
let historyLines = [], popupHistory = null;
function STATUS_HTML(s)
{
    historyLines.push(s);
    const div = $('#divStatus');
    div.append($('<div class="log_line"></div>').html(s));
    div.scrollTop(div[0].scrollHeight);
    refreshHistory();
}

function appendStatus(s)
{
    if (!s) return;
    if (!historyLines.length) return STATUS_HTML(s);
    historyLines[historyLines.length - 1] += ' ' + s;
    const div = $('#divStatus'), line = div.children('.log_line').last();
    if (line.length) line.append(' ' + s);
    else div.append($('<div class="log_line"></div>').html(s));
    div.scrollTop(div[0].scrollHeight);
    refreshHistory();
}

//a new turn: the message area starts afresh; History keeps it all
function statusNewTurn(heading)
{
    $('#divStatus').empty();
    historyLines.push(`<div class="turn_head">${heading}</div>`);
    if (historyLines.length > 3000) historyLines.splice(0, historyLines.length - 3000);
    refreshHistory();
}

function showHistory()
{
    if (!popupHistory)
    {
        popupHistory = new WinBox({
            title: 'History',
            x: 'right', y: '100px', width: '40%', height: `${Math.max(300, window.innerHeight - 160)}px`,
            html: '<div id="divHistory" class="history"></div>',
            onclose: () => { popupHistory = null; return false; }
        });
    }
    else popupHistory.focus();
    refreshHistory();
}

function refreshHistory()
{
    const div = $('#divHistory');
    if (!div.length) return;
    //cards drawn show face down there for good: the History is for everyone
    div.html(historyLines.map((s) => `<div class="log_line">${s.replace(/flipcard ([a-z]+) mine/g, 'flipcard $1').replace(/onclick="[^"]*"/g, '')}</div>`).join(''));
    div.scrollTop(div[0].scrollHeight);
}

//[x, y, w, h] in units of an outer square
function outerRect(i)
{
    const c = CORNER_UNITS, s = SIDE_UNITS, far = BOARD_UNITS - c;
    if (i === PAYDAY) return [far, 0, c, c];
    if (i < HOSPITAL) return [far, c + (i - 1) * s, c, s];
    if (i === HOSPITAL) return [far, far, c, c];
    if (i < UNEMPLOYMENT) return [far - (i - HOSPITAL) * s, far, s, c];
    if (i === UNEMPLOYMENT) return [0, far, c, c];
    if (i < HAWAII) return [0, far - (i - UNEMPLOYMENT) * s, c, s];
    if (i === HAWAII) return [0, 0, c, c];
    return [c + (i - HAWAII - 1) * s, 0, s, c];
}

//which side of the board an outer square is on: its text is turned to face that side
function outerSide(i)
{
    if (i % 8 === 0) return 'corner';
    return ['right', 'bottom', 'left', 'top'][(i / 8) | 0];
}

function pathCellId(name, step)
{
    return 'path_' + name.replace(/ /g, '_') + '_' + step;
}

function cellId(pos)
{
    return (pos.path && (pos.step >= 0))? pathCellId(pos.path, pos.step): 'outer_' + pos.at;
}

function place(div, x, y, w, h)
{
    div.css({ left: x * UNIT, top: y * UNIT, width: w * UNIT, height: h * UNIT });
}

function drawBoard()
{
    const board = $('#divBoard').empty();
    board.css({ width: BOARD_UNITS * UNIT, height: BOARD_UNITS * UNIT });
    $('<div class="inner"></div>').appendTo(board).css({ left: CORNER_UNITS * UNIT, top: CORNER_UNITS * UNIT,
        width: INNER_UNITS * UNIT, height: INNER_UNITS * UNIT });
    $(`<div class="title">${TITLE_ART? artHtml(TITLE_ART, 'title_pic'): 'Careers<div class="motto">The Choice is Yours</div>'}</div>`).appendTo(board)
        .css({ left: 7 * UNIT, top: 7 * UNIT, width: 6 * UNIT, height: 6 * UNIT });
    OUTER.forEach((sq, i) =>
    {
        const [kind, name, print] = sq,
            side = outerSide(i),
            div = $(`<div id="outer_${i}" class="sq outer ${kind} side_${side}" data-tip="outer_${i}" onclick="squareClicked(this.id);"></div>`),
            path = PATHS[name];
        const label = $('<div class="label"></div>').appendTo(div);
        if (kind === 'entry') label.append(`<div class="small">May enter: ${artHtml(theme_(name).icon, 'emblem')}</div>`);
        label.append(`<div class="name${(name.length > 10)? ' long_name': ''}">${name}</div>`);
        //small print, less its 'May enter: <path>.' (already above); print may hold HTML such as <b>Pay</b>
        if (kind !== 'opp') label.append(`<div class="print">${print.replace(/^(?:<[^>]+>)*May (?:enter|go into):(?:<[^>]+>|[^.<])*\.(?:<\/[^>]+>)*\s*/, '')}</div>`);
        if (path) div.css('border-color', pathBorder(name));
        if (path && boardTheme().entryTint) div.css('background', theme_(name).tint); //an entrance in its path's colour
        place(div, ...outerRect(i));
        //tokens: corners in 2 empty corners (off the diagonal name); other squares along the board's outer rim
        if (side === 'corner') div.append('<div class="tokens corner_a"></div><div class="tokens corner_b"></div>');
        else div.append(`<div class="tokens rim_${side}"></div>`);
        board.append(div);
    });
    for (const [name, path] of Object.entries(PATHS))
    {
        const theme = theme_(name);
        drawEmblem(board, name);
        path.squares.forEach((sq, step) =>
        {
            const [col, row, story, reward] = sq,
                id = pathCellId(name, step),
                div = $(`<div id="${id}" class="sq path" data-tip="${id}" onclick="squareClicked(this.id);"></div>`);
            div.css({ 'border-color': pathBorder(name), background: theme.tint });
            div.append(`<div class="story">${story}</div><div class="reward">${reward}</div><div class="tokens"></div>`);
            place(div, CORNER_UNITS + col, CORNER_UNITS + row, 1, 1);
            board.append(div);
        });
        //arrow from the entrance into the path, and from the path's end out to the track
        drawArrow(board, `in:${name}`, path.squares[0], path.entry, true);
        drawArrow(board, `out:${name}`, path.squares[path.squares.length - 1], path.exit, false);
    }
    initTips();
}

//the path's emblem (PATH_THEMES in art.js) on a coloured disc, in the middle of the space its squares go round
function drawEmblem(board, name)
{
    const theme = theme_(name), [dx, dy] = theme.emblemShift || [0, 0],
        cols = PATHS[name].squares.map((sq) => sq[INDEX_COL]), rows = PATHS[name].squares.map((sq) => sq[INDEX_ROW]),
        x = (Math.min(...cols) + Math.max(...cols) + 1) / 2 + dx, y = (Math.min(...rows) + Math.max(...rows) + 1) / 2 + dy;
    $(`<div class="path_emblem" title="${name}">${artHtml(theme.icon, 'emblem_pic')}</div>`).appendTo(board)
        .css({ left: (CORNER_UNITS + x) * UNIT - EMBLEM_SIZE / 2, top: (CORNER_UNITS + y) * UNIT - EMBLEM_SIZE / 2,
            background: `radial-gradient(circle, ${theme.disc} 0%, ${theme.disc} 55%, transparent 72%)` });
}
const EMBLEM_SIZE = 80; //px; as in .path_emblem in careers.css

//an arrow on the edge between the outer square and the path square next to it
function drawArrow(board, tip, sq, at, inward)
{
    const [col, row] = sq, side = outerSide(at), c = CORNER_UNITS;
    let x = c + col + 0.5, y = c + row + 0.5, turn = 0, //turn: degrees, 0 points down
        dx = 0, dy = 0; //px: onto the outer square, clear of the path square's text
    const off = ARROW_SIZE[1] / 2 + 1;
    if (side === 'right') { x = c + INNER_UNITS; turn = inward? 90: -90; dx = off; }
    else if (side === 'left') { x = c; turn = inward? -90: 90; dx = -off; }
    else if (side === 'top') { y = c; turn = inward? 0: 180; dy = -off; }
    else { y = c + INNER_UNITS; turn = inward? 180: 0; dy = off; }
    $(`#outer_${at}`).addClass('has_arrow'); //its text keeps clear of the arrow
    $(`<div class="arrow ${inward? 'in': 'out'}" data-tip="${tip}"></div>`).appendTo(board)
        .css({ left: x * UNIT - ARROW_SIZE[0] / 2 + dx, top: y * UNIT - ARROW_SIZE[1] / 2 + dy, transform: `rotate(${turn}deg)` });
}
const ARROW_SIZE = [36, 20]; //px; as in .arrow in careers.css

/*
Tooltips: rich text in large print, made when the mouse comes over a square or an arrow (so they show who is there).
data-tip: 'outer_<i>', a path square's id, or 'in:<path>' / 'out:<path>' for the arrows.
*/
function initTips()
{
    if (!$('#divTip').length) $('body').append('<div id="divTip"></div>');
    $('#divBoard').off('.tip')
        .on('mouseenter.tip', '[data-tip]', function () { $('#divTip').html(tipHtml($(this).attr('data-tip'))).show(); })
        .on('mousemove.tip', '[data-tip]', (e) => moveTip(e))
        .on('mouseleave.tip', '[data-tip]', () => $('#divTip').hide());
}

//keep the tip beside the mouse, inside the window
function moveTip(e)
{
    const tip = $('#divTip'), w = tip.outerWidth(), h = tip.outerHeight(),
        x = (e.clientX + 20 + w < window.innerWidth)? e.clientX + 20: e.clientX - 20 - w,
        y = Math.max(4, Math.min(e.clientY + 20, window.innerHeight - h - 4));
    tip.css({ left: x, top: y });
}

//print with stars, hearts and dollar amounts picked out
function richPrint(s)
{
    return s.replace(/★/g, '<span class="star">&#x2605;</span>').replace(/♥/g, '<span class="heart">&#x2665;</span>')
        .replace(/\$[\d,]+/g, '<b>$&</b>');
}

function tipIcon(name)
{
    return artHtml(theme_(name).icon, 'tip_icon');
}

function tipHtml(key)
{
    let s = '', here = '';
    if (key.startsWith('in:') || key.startsWith('out:'))
    {
        const [way, name] = key.split(':'), path = PATHS[name];
        if (way === 'in') return `<div class="tip_title">${tipIcon(name)}Into ${name}</div>${richPrint(OUTER[path.entry][INDEX_PRINT])}`;
        return `<div class="tip_title">${tipIcon(name)}Out of ${name}</div><div class="tip_reward">${richPrint(path.exitPrint || 'Collect Experience')}</div>`;
    }
    const atKey = (p) => (key === cellId(p));
    here = players.filter(atKey).map((p) => `${tokenImg(p, 'icon')} ${playerName(p)}${p.stuck? ' (stuck)': ''}`).join('<br>');
    if (key.startsWith('outer_'))
    {
        const [kind, name, print] = OUTER[parseInt(key.substring(6))];
        s = `<div class="tip_title tip_${kind}">${(kind === 'entry')? tipIcon(name): ''}${name}</div>` + ((kind === 'opp')? 'Draw an Opportunity card.': richPrint(print));
    }
    else
    {
        for (const [name, path] of Object.entries(PATHS)) path.squares.forEach((sq, step) =>
        {
            if (pathCellId(name, step) !== key) return;
            s = `<div class="tip_title" style="color:${pathBorder(name)}">${tipIcon(name)}${name} <span class="tip_step">square ${step + 1} of ${path.squares.length}</span></div>
<div class="tip_art">${artHtml((SQUARE_ART[name] || [])[step], 'tip_art_pic')}</div>
<div class="tip_story">${sq[INDEX_STORY]}</div><div class="tip_reward">${richPrint(sq[INDEX_REWARD])}</div>`;
        });
    }
    return s + (here? `<div class="tip_here">${here}</div>`: '');
}

function tokenImg(p, cls)
{
    return `<img class="${cls}" src="../cluedo/images/token-${TOKENS[p.id]}.png" title="${PLAYERS[p.id]}" alt="${PLAYERS[p.id]}">`;
}

function playerName(p)
{
    return `<b style="color:${PLAYER_COLORS[p.id]}">${PLAYERS[p.id]}</b>`;
}

//on a corner, tokens go into its 2 empty corners by turns
function drawTokens()
{
    $('.tokens').empty();
    const count = {};
    players.forEach((p, i) =>
    {
        const id = cellId(p), n = count[id] = (count[id] || 0) + 1;
        let box = $(`#${id} .tokens`);
        if (box.length > 1) box = box.eq((n - 1) % 2);
        //the player whose turn it is: Cluedo's swirling rainbow round the token
        const cls = 'token' + ((p.hop === 'step')? ' step': p.hop? ' hop': ''); //hop: just arrived by a card, or sent to Hospital / Unemployment; step: walking
        delete p.hop;
        box.append((i === who)? `<span class="token_box current">${tokenImg(p, cls)}<span class="swirl"></span></span>`: tokenImg(p, cls));
    });
    drawTrails();
    drawBubbles();
    drawPlayersInfo();
}

/*
Whether the page shows a player's cash, salary, fame and happiness. As on paper, players keep these to themselves:
only those of the player whose turn it is show. 'Reveal all' (for debugging) shows everyone's.
*/
function scoresShown(i)
{
    return revealAll || ((i === who) && !aiLevel(players[i]) && handShown); //a computer player keeps its numbers to itself; a person's: after Reveal
}

function toggleRevealAll()
{
    revealAll = !revealAll;
    drawPlayersInfo();
}

function money(n)
{
    return '$' + n.toLocaleString();
}

function drawPlayersInfo()
{
    let s = '<table><tr><th></th><th>Player</th><th>Cash</th><th>Salary</th><th>&#x2605;</th><th>&#x2665;</th><th>Degree</th><th>Cards</th><th>Where</th></tr>';
    players.forEach((p, i) =>
    {
        const where = p.path? `${p.path}${(p.step >= 0)? ' #' + (p.step + 1): ' (entering)'}`: OUTER[p.at][INDEX_NAME],
            shown = scoresShown(i),
            hide = '<td class="hidden" title="kept to themselves">?</td>';
        s += `<tr${(i === who)? ' class="current"': ''} onclick="openSheet(${i});" title="Open the score sheet"><td>${tokenImg(p, 'icon')}</td>
<td>${playerName(p)}${aiLevel(p)? ` <span class="ai_tag">${AI_LEVELS[aiLevel(p)]}</span>`: ''}</td>
${shown? `<td>${money(p.cash)}</td><td>${money(p.salary)}</td><td>${p.fame}</td><td>${p.hearts}</td>`: hide.repeat(4)}
<td>${p.degree || ''}${(p.degree === DOCTOR_DEGREE)? ' (Doctor)': ''}</td>
<td title="Opportunity / Experience cards held">&#x1F0CF;${p.opp.length} &#x1F463;${p.exp.length}</td><td>${where}${p.stuck? ' (stuck)': ''}${p.skip? ' (loses a turn)': ''}</td></tr>`;
    });
    s += `</table><button onclick="toggleRevealAll();" class="button_minor">${revealAll? 'Hide': 'Reveal all'}</button>`;
    $('#divPlayersInfo').html(s);
    refreshSheets();
}

//cash on the score sheet: each new amount, the old ones crossed out (games saved before it: from now on)
function cashTally(p)
{
    const list = p.history.cash || (p.history.cash = []);
    if (list[list.length - 1] !== p.cash) list.push(p.cash);
}

//a score on the sheet changes: the old value stays, crossed out, as on paper
function setScore(p, what, value)
{
    p[what] = value;
    p.history[what].push(value);
}

function formulaTotal(p)
{
    return p.formula.money + p.formula.fame + p.formula.hearts;
}

//money points: $1,000 of cash on hand each
function moneyPoints(p)
{
    return Math.floor(p.cash / 1000);
}

/*
Score sheets, after the Careers score card by Greg Sabino Mullane (MIT licence; dl/careers/careers_board_game-main),
for this board: careers as on the board, money points of $1,000. One window per player; what a player keeps to
themselves (formula, salary, scores, cash) shows only on their turn (or with Reveal all).
*/
let sheetBoxes = {}; //player index: its WinBox
const SHEET_DEGREES = ['Law', 'Medical', 'Engineering', 'Science', PLAIN_DEGREE];

function openSheet(i)
{
    if (!players[i]) return;
    if ((i === who) && !aiLevel(players[i]) && !handShown) toggleHand(); //your own sheet: a deliberate look
    if (sheetBoxes[i])
    {
        sheetBoxes[i].focus();
        return;
    }
    const n = Object.keys(sheetBoxes).length;
    sheetBoxes[i] = new WinBox({
        title: `${PLAYERS[players[i].id]}: score sheet`,
        html: `<div id="divSheet${i}" class="sheet"></div>`,
        x: Math.max(0, window.innerWidth - 480 - 30 * n), y: 40 + 30 * n, width: 470, height: 640,
        onclose: () => { delete sheetBoxes[i]; return false; }
    });
    refreshSheets();
}

function closeSheets()
{
    for (const box of Object.values(sheetBoxes)) box.close();
    sheetBoxes = {};
}

function refreshSheets()
{
    for (const i of Object.keys(sheetBoxes)) $(`#divSheet${i}`).html(sheetHtml(parseInt(i)));
}

function sheetHtml(i)
{
    const p = players[i], shown = scoresShown(i), f = p.formula, q = '<span class="hidden">?</span>',
        editable = shown && !p.throws && !p.formulaSet && (i === who),
        //each part of the formula reached (as many or more): green, in the formula and in its column; black again if it falls short
        got = { money: shown && (moneyPoints(p) >= f.money), fame: shown && (p.fame >= f.fame), hearts: shown && (p.hearts >= f.hearts) },
        green = (key) => got[key]? ' class="reached"': '',
        gap = options.success - formulaTotal(p),
        nudge = (key, dir, sign, tip, ok) => `<button class="formula_nudge" onclick="nudgeFormula(${i}, '${key}', ${dir});" title="${tip}"${ok? '': ' disabled'}>${sign}</button>`,
        part = (key, value, unit) => editable?
            `<span class="formula_part">${nudge(key, 1, '&#x25B2;', `Up by what is missing to make ${options.success} points`, gap > 0)}` +
            `<input type="number" min="0" max="${options.success}" value="${value}" onchange="setFormula(${i}, '${key}', this.value);"${green(key)}>` +
            `${nudge(key, -1, '&#x25BC;', `Down by what is over ${options.success} points`, gap < 0)}</span>${unit}`:
            (shown? `<span${green(key)}><b>${value}</b>${unit}</span>`: q),
        reached = (key) => got[key]? ' <span class="reached">&#x2714;</span>': '',
        crossed = (list, fmt, key, sep) => shown? list.map((v, k) => (k < list.length - 1)? `<s>${fmt(v)}</s>`: `<b${green(key)}>${fmt(v)}</b>`).join(sep || '<br>'): q;
    let s = `<div class="sheet_head">${tokenImg(p, 'icon')} ${playerName(p)}</div>
<div class="sheet_formula"><b>SUCCESS FORMULA</b>${editable? (preparing? ' (set it, then Lock it in, at the top; keep it secret!)': ' (set it before your first throw; keep it secret!)'): ''}<br>
${part('money', f.money, ' &times; $1,000')} + ${part('fame', f.fame, ' &#x2605;')} + ${part('hearts', f.hearts, ' &#x2665;')}
= ${shown? `<b class="${(formulaTotal(p) === options.success)? '': 'bad'}">${formulaTotal(p)}</b>`: q} of ${options.success} points</div>`;
    if (shown) s += `<div class="sheet_now">Now: <span${green('money')}>money ${moneyPoints(p)}</span>${reached('money')},
<span${green('fame')}>&#x2605; ${p.fame}</span>${reached('fame')}, <span${green('hearts')}>&#x2665; ${p.hearts}</span>${reached('hearts')}</div>`;
    s += `<div class="sheet_cash">Cash on hand: ${shown? `<b${green('money')}>${money(p.cash)}</b>`: q}</div>`;
    s += '<table class="sheet_cols"><tr><th>OCCUPATION RECORD</th><th>CASH</th><th>&#x2605;</th><th>&#x2665;</th></tr><tr><td>';
    s += `<div class="sheet_salary"><b>SALARY</b> ${crossed(p.history.salary, money, '', ' ')}</div>`;
    s += '<table class="sheet_occ"><tr><th></th><th>1st</th><th>2nd</th><th>3rd</th></tr>';
    for (const name of Object.keys(PATHS).filter((n) => n !== 'College'))
    {
        const times = p.record[name] || 0;
        s += `<tr><td>${name}</td>${[1, 2, 3].map((k) => `<td>${(times >= k)? '&#x2714;': ''}</td>`).join('')}</tr>`;
    }
    s += '</table><div class="sheet_college"><b>COLLEGE EDUCATION</b>';
    for (const d of SHEET_DEGREES) s += `<div>${(p.degree === d)? '&#x2714;': '&nbsp;&nbsp;&nbsp;'} ${(d === PLAIN_DEGREE)? 'College Degree': d}</div>`;
    s += `</div></td><td>${crossed(p.history.cash || [p.cash], money, 'money')}</td><td>${crossed(p.history.fame, String, 'fame')}</td><td>${crossed(p.history.hearts, String, 'hearts')}</td></tr></table>
<div class="sheet_cards">Opportunity cards: ${shown? (p.opp.map(oppLabel).join('; ') || 'none'): `${p.opp.length} ${q}`}<br>
Experience cards: ${shown? (p.exp.map((n) => `move ${n}`).join(', ') || 'none'): `${p.exp.length} ${q}`}</div>`;
    return s;
}

//▲ / ▼ by a part of the formula: up by what is missing to make the full points, or down by what is over
function nudgeFormula(i, key, dir)
{
    const p = players[i], gap = options.success - formulaTotal(p);
    if ((dir > 0) && (gap > 0)) setFormula(i, key, p.formula[key] + gap);
    else if ((dir < 0) && (gap < 0)) setFormula(i, key, Math.max(0, p.formula[key] + gap));
}

function setFormula(i, key, value)
{
    const p = players[i];
    if ((i !== who) || p.throws || p.formulaSet) return;
    p.formula[key] = Math.max(0, parseInt(value) || 0);
    refreshSheets();
}

function createDice()
{
    if ($('#dice1').length) return;
    const div = $('.dice-container');
    div.append($(Dice.html('dice1')));
    div.append($(Dice.html('dice2')));
    diceOne = new Dice('dice1', false);
    diceTwo = new Dice('dice2', false);
}

//Options: kept in localStorage; they take effect at the next New Game
function loadOptions()
{
    try
    {
        const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}');
        options = { ...DEFAULT_OPTIONS, ...saved };
    }
    catch (e) {}
    $('#option_cash').val(options.cash);
    $('#option_salary').val(options.salary);
    $('#option_bump_card')[0].checked = options.bumpCard;
    $('#option_any_degree')[0].checked = options.anyDegree;
    $('#option_success').val(options.success);
    $('#option_ai_pause')[0].checked = options.aiPause;
    $('#option_ai_review')[0].checked = options.aiReview;
    $('#option_casual')[0].checked = options.casual;
    applyTheme();
}

function saveOptions()
{
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(options)); } catch (e) {}
}

function setOption(name, value)
{
    if ((name === 'cash') || (name === 'salary')) value = Math.max(0, parseInt(value) || 0);
    if (name === 'success') value = Math.max(3, parseInt(value) || DEFAULT_OPTIONS.success);
    options[name] = value;
    saveOptions();
}

function resetOptions()
{
    options = { ...DEFAULT_OPTIONS };
    saveOptions();
    loadOptions();
    drawPlayerChoice();
}

/*
Characters to play: tick up to MAX_PLAYERS, at least 2 (at once, as Cluedo: playerJoins / playerLeaves); 'AI' and a level for a computer
player (at once, in the game being played too). Laid out as Cluedo's Players table.
*/
function drawPlayerChoice()
{
    let levels = '';
    for (const [key, name] of Object.entries(AI_LEVELS)) levels += `<option value="${key}">${name}</option>`;
    let s = '<table class="player_table"><tr>';
    PLAYERS.forEach((name, id) =>
    {
        const on = options.players.includes(id), ai = options.ai[id];
        s += `<td style="background:${PLAYER_COLORS[id]}" title="${name}">
<div class="player_pick"><div class="player_pick_opts">
<input type="checkbox" class="big_checkbox" id="player${id}" ${on? 'checked': ''} onclick="playerTicked(${id}, this.checked);" title="Play ${name}">
<span title="The computer plays ${name}"><input type="checkbox" class="checkbox_ai" id="ai${id}" ${ai? 'checked': ''} onclick="aiTicked(${id});"><label for="ai${id}" class="player_pick_ai">AI</label></span>
</div><label for="player${id}"><img src="../cluedo/images/token-${TOKENS[id]}.png" alt="${name}" class="player_pick_token"></label></div>
<select id="aiLevel${id}" class="player_pick_level" style="${ai? '': 'display: none;'}" onchange="aiTicked(${id});">${levels}</select>
<div class="player_pick_name">${name}</div></td>`;
    });
    $('#divPlayerChoice').html(s + '</tr></table>');
    PLAYERS.forEach((name, id) => { if (options.ai[id]) $(`#aiLevel${id}`).val(options.ai[id]); });
    limitPlayerChoice();
}

//'AI' ticked / unticked or its level changed: takes effect at once
function aiTicked(id)
{
    const on = $(`#ai${id}`)[0].checked;
    $(`#aiLevel${id}`).toggle(on);
    options.ai = { ...options.ai };
    if (on) options.ai[id] = $(`#aiLevel${id}`).val();
    else delete options.ai[id];
    saveOptions();
    const p = players.find((x) => x.id === id);
    if (p && on && !p.throws && !p.formulaSet) p.formula = aiFormula(p);
    aiGoing = false;
    if (preparing && on && (p === players[who])) //was setting their formula: the computer has set it
    {
        preparing = false;
        closeSheets();
        if (turnCount === 0) return prepNext(who + 1);
        STATUS_HTML(turnPrompt(p));
    }
    drawPlayersInfo();
    drawDial();
    showButtons();
}

function setAiPause(on)
{
    setOption('aiPause', on);
    aiGoing = false;
    showButtons();
}

//'Pause AI' / 'Resume AI' in the top panel (as Hotels): the same as the option
function toggleAiPause()
{
    setAiPause(!options.aiPause);
    $('#option_ai_pause')[0].checked = options.aiPause;
}

//a player ticked / unticked: for the next New Game, and (as Cluedo) at once in the game being played
function playerTicked(id, on)
{
    if (!on && !gameOver && players.some((p) => p.id === id) && !playerLeaves(id))
    {
        $(`#player${id}`).prop('checked', true); //could not leave just now
        return;
    }
    options.players = options.players.filter((i) => i !== id);
    if (on) options.players.push(id);
    options.players.sort((a, b) => a - b);
    saveOptions();
    limitPlayerChoice();
    if (on && players.length && !gameOver && !players.some((p) => p.id === id)) playerJoins(id);
}

//joins the game being played: at Pay Day with the starting cash and salary, in their place in the turn order
function playerJoins(id)
{
    const p = newPlayer(id), k = players.filter((x) => x.id < id).length;
    players.splice(k, 0, p);
    if (k <= who) ++who; //the same player's turn still
    tokenBubble(p, MOOD.joined);
    STATUS_HTML(`${playerName(p)} joins the game at Pay Day with ${money(p.cash)}` +
        (aiLevel(p)? '.': ', and sets their Success Formula at the start of their first turn.'));
    drawTokens();
    drawDial();
    drawPlayersInfo();
    showButtons();
}

//leaves the game being played (cards back to the decks); @return false if not now
function playerLeaves(id)
{
    const i = players.findIndex((p) => p.id === id), p = players[i];
    if (players.length <= 2)
    {
        STATUS_HTML('At least 2 must stay in the game (or start a New Game).');
        return false;
    }
    if ((i === who) && (busy || queue.length || target))
    {
        STATUS_HTML(`${playerName(p)} is in the middle of a move: untick them after it.`);
        return false;
    }
    if (i === who)
    {
        const wasPreparing = preparing && (turnCount === 0);
        if (wasPreparing)
        {
            returnCards(p);
            closeSheets();
            players.splice(i, 1);
            prepNext(i); //(the next player is at i now)
            STATUS_HTML(`(${PLAYERS[id]} has left the game.)`);
        }
        else STATUS_HTML(leaveGame(p));
        return true;
    }
    returnCards(p);
    closeSheets();
    players.splice(i, 1);
    if (i < who) --who; //the same player's turn still
    delete bubbles[id];
    delete trails[id];
    STATUS_HTML(`(${playerName(p)} has left the game.)`);
    drawTokens();
    drawDial();
    drawPlayersInfo();
    showButtons();
    return true;
}

function limitPlayerChoice()
{
    const full = options.players.length >= MAX_PLAYERS;
    PLAYERS.forEach((name, id) => $(`#player${id}`).prop('disabled', full && !options.players.includes(id)));
    $('#spanPlayerCount').text(`${options.players.length} chosen` + ((options.players.length < 2)? ': choose at least 2': ''));
}

//Decks: Opportunity Knocks (OPPORTUNITY_CARDS, and BUMP_CARD if the option is on) and Experience, shuffled.
//Cards are drawn from the top; a card played goes to the bottom.
function shuffle(list)
{
    for (let i = list.length - 1; i > 0; --i)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function buildOppDeck()
{
    oppDeck = [];
    const kinds = options.bumpCard? [...OPPORTUNITY_CARDS, BUMP_CARD]: OPPORTUNITY_CARDS;
    let uid = 0;
    for (const card of kinds) for (let i = 0; i < card[0]; ++i) oppDeck.push([card[0], card[1], card[2], card[3] || '', ++uid]); //card[4]: its number
    shuffle(oppDeck);
}

function buildExpDeck()
{
    expDeck = [];
    for (const [count, move] of EXPERIENCE_CARDS) for (let i = 0; i < count; ++i) expDeck.push(move);
    shuffle(expDeck);
}

//drawn cards are named to the player who draws them (on their turn), unless a computer player
function drawOpp(p, n)
{
    const drawn = [];
    for (let i = 0; (i < n) && oppDeck.length; ++i) drawn.push(oppDeck.shift());
    p.opp.push(...drawn);
    if (p === players[who]) drawnNow.push(...drawn.map((c) => c[4]));
    if (!drawn.length) return 'finds no Opportunity cards left to draw';
    return `draws ${(drawn.length > 1)? drawn.length + ' Opportunity cards': 'an Opportunity card'}` +
        cardsShown(p, drawn.map((c) => oppCardFace(c) + `<button class="use_now" onclick="event.stopPropagation(); playOppNow(${c[4]});">Use it now</button>`), 'opp');
}

/*
Cards just drawn, face down in the message area (as Cluedo's): the player who drew them clicks to turn them over.
Another player's, or a computer player's, stay face down.
*/
function cardsShown(p, faces, kind)
{
    const mine = (p === players[who]) && !aiLevel(p),
        back = (kind === 'opp')? '<div class="flip_title">Opportunity<br>Knocks!</div>': '<div class="flip_title">Experience</div>';
    return `<span class="drawn_cards">${faces.map((face) => `<span class="flipcard ${kind}${mine? ' mine': ''}"
${mine? 'onclick="this.classList.toggle(\'flipped\');" title="Click to turn over"': 'title="Kept to themselves"'}>
<span class="flip_inner"><span class="flip_back">${back}</span><span class="flip_front">${mine? face: ''}</span></span></span>`).join('')}</span>` +
        (mine? ' (click to turn over)': '');
}

function oppCardFace(card)
{
    const icon = (card[3] === 'bump')? '\u{1F6AB}': (card[1] === 'any')? '⭐': (card[1] === 'Hawaii')? '\u{1F33A}': theme_(card[1]).icon;
    return `${artHtml(icon, 'flip_icon')}<b>${oppLabel(card)}</b><span class="flip_text">${card[2]}</span>`;
}

function drawExp(p, n)
{
    const drawn = [];
    for (let i = 0; (i < n) && expDeck.length; ++i) drawn.push(expDeck.shift());
    p.exp.push(...drawn);
    const named = drawn.length? cardsShown(p, drawn.map((m) => `<span class="flip_move">${m}</span><b>Move ${m}</b><span class="flip_text">square${(m > 1)? 's': ''}, on the track or in a career</span>`), 'exp'): '';
    if (drawn.length < n) return `draws ${drawn.length} Experience card${(drawn.length === 1)? '': 's'} (no more in the deck)` + named;
    return `draws ${(drawn.length > 1)? drawn.length + ' Experience cards': 'an Experience card'}` + named;
}
//Experience cards for completing a career: 1 the first time, 2 the second, 3 from the third on (each career counts apart)
const MAX_EXPERIENCE_DRAW = 3;

function newGame()
{
    if (options.players.length < 2)
    {
        STATUS_HTML('Choose at least 2 players (Options, below the board), then New Game.');
        return;
    }
    players = options.players.map(newPlayer);
    who = 0;
    turnCount = 0;
    ++gameRun;
    gameOver = false;
    revealAll = false;
    preparing = false;
    bubbles = {};
    trails = {};
    closeSheets();
    buildOppDeck();
    buildExpDeck();
    if (FORMULA_PREP) statusNewTurn('Round 0: getting ready. Each in turn sets their Success Formula');
    prepNext(0);
}

//a player at Pay Day with the starting cash and salary; a computer player's formula is set, a person's to be set
function newPlayer(id)
{
    const third = Math.floor(options.success / 3),
        p = { id, cash: options.cash, salary: options.salary, fame: 0, hearts: 0, degree: '',
            at: PAYDAY, path: '', step: -1, stuck: '', skip: 0, doubleHearts: '', opp: [], exp: [],
            formula: { money: options.success - 2 * third, fame: third, hearts: third }, formulaSet: false,
            record: {}, history: { salary: [options.salary], fame: [0], hearts: [0], cash: [options.cash] }, throws: 0 };
    if (aiLevel(p)) p.formula = aiFormula(p);
    return p;
}

/*
Getting ready (owner's KIV point): round 0, everyone in turn order before turn 1. Each person sets their Success
Formula on their own score sheet (the others look away) and locks it in; a computer player's turn shows for a moment
(its formula is set already). Then turn 1, from the 1st player. A person who joins later does it at the start of
their first turn. Locked: no more changes. The page test turns it off (FORMULA_PREP).
*/
let FORMULA_PREP = true,
    preparing = false; //round 0, or a person setting their formula: the turn waits

function formulaLocked(p)
{
    return !!aiLevel(p) || !FORMULA_PREP || p.formulaSet || (p.throws > 0); //(saves from before r122 have no formulaSet)
}

//round 0, from player k on: the next one to set their formula, else turn 1 starts with the 1st player
function prepNext(k)
{
    const run = gameRun;
    for (; k < players.length; ++k)
    {
        const p = players[k];
        if (!formulaLocked(p))
        {
            who = k;
            askFormula(p);
            return;
        }
        if (FORMULA_PREP && aiLevel(p)) //a computer player: its turn shows for a moment
        {
            who = k;
            preparing = true;
            closeSheets();
            drawTokens();
            drawDial();
            STATUS_HTML(`${playerName(p)} (computer) sets its Success Formula.`);
            showButtons();
            setTimeout(() => { if (run === gameRun) prepNext(k + 1); }, AI_THINK_MS);
            return;
        }
    }
    preparing = false;
    who = 0;
    startTurn();
}

//the person whose turn it is sets and locks their formula
function askFormula(p)
{
    preparing = true;
    handShown = false;
    closeSheets();
    drawTokens();
    drawDial();
    STATUS_HTML(`${playerName(p)}: set your Success Formula on your score sheet (${options.success} points of money, &#x2605; and &#x2665;), then lock it in. ` +
        'Everyone else, look away! It cannot be changed after.');
    openSheet(who);
    showButtons();
}

function lockFormula()
{
    const p = players[who];
    if (!preparing || !p || aiLevel(p)) return;
    if (formulaTotal(p) !== options.success)
    {
        STATUS_HTML(`It must add up to ${options.success} points (now ${formulaTotal(p)}).`);
        return;
    }
    p.formulaSet = true;
    preparing = false;
    closeSheets();
    handShown = false;
    STATUS_HTML(`${playerName(p)} has locked in their Success Formula.`);
    if (turnCount === 0) return prepNext(who + 1); //round 0: the next player
    STATUS_HTML(turnPrompt(p));
    drawPlayersInfo();
    showButtons();
}

/*
Lean (owner's open point 2): a player who gets 10 of one kind (fame, hearts, money points) within their last 10
turns wears its pin on the turn dial until they get 10 of a kind again. p.lean: { last: the numbers at their last
turn's start, recent: gains per turn [money, fame, hearts], latest last, pin: '' or a LEANS key, turn }
*/
const LEAN_TURNS = 10, LEAN_POINTS = 10;
const LEANS = { //goal: what the pin says the player goes for; got: what they got 10 of
    money: { icon: '$', cls: 'pin_lean_money', goal: 'fortune', got: 'money points ($1,000 each)' },
    fame: { icon: '★', cls: 'pin_lean_fame', goal: 'fame', got: '★' },
    hearts: { icon: '♥', cls: 'pin_lean_hearts', goal: 'happiness', got: '♥' }
};

//at the start of the player's turn: what they gained since their last; @return the kind of a pin just won, else ''
function tallyLean(p)
{
    const lean = p.lean || (p.lean = { recent: [], pin: '' }), kinds = Object.keys(LEANS),
        now = { money: moneyPoints(p), fame: p.fame, hearts: p.hearts };
    if (lean.turn === turnCount) return ''; //a restored turn: tallied already
    lean.turn = turnCount;
    if (lean.last) lean.recent = lean.recent.concat([kinds.map((k) => Math.max(0, now[k] - lean.last[k]))]).slice(-LEAN_TURNS);
    lean.last = now;
    const sums = kinds.map((k, i) => lean.recent.reduce((n, gains) => n + gains[i], 0)),
        best = Math.max(...sums);
    if (best < LEAN_POINTS) return '';
    lean.pin = kinds[sums.indexOf(best)];
    lean.recent = []; //counted afresh for the next pin
    return lean.pin;
}

function leanPin(p)
{
    const kind = p.lean && p.lean.pin;
    if (!kind) return '';
    const lean = LEANS[kind];
    return TurnDial.pin(`pin_left pin_lean ${lean.cls}`, lean.icon, `Lately going for ${lean.goal}: got ${LEAN_POINTS} ${lean.got} within ${LEAN_TURNS} turns`);
}

//turn dial in the top panel (cluedo/js/turndial.js); computer players wear an 'AI' pin, and anyone their lean's pin
let dial = null;
function drawDial()
{
    const div = $('#divDial'), n = players.length;
    dial = dial || new TurnDial(div[0], { onPick: (k) => findMe(k) });
    dial.draw(players.map((p, k) => ({ key: k, title: `${PLAYERS[p.id]}: click to find`, html: tokenImg(p, 'dial_img') +
        (aiLevel(p)? TurnDial.pin(AI_PINS[aiLevel(p)] || 'pin_silver', 'AI', 'Computer player: ' + AI_LEVELS[aiLevel(p)]): '') + leanPin(p) })), who);
    if (n && players[who]) div.attr('title', 'Turn order: ' + players.map((p, j) => PLAYERS[players[(who + j) % n].id]).join(', then '));
}

/*
A turn: the player throws (or plays a card, or pays to leave Hospital / Unemployment, or tries to stay in Hawaii),
clicks the glowing square to move there, and what happens there happens; choices it brings go into 'queue' and
come up as buttons, one at a time. Then Next Player.
*/
function startTurn()
{
    rolled = moved = again = cardPlayed = oppUsed = busy = aiGoing = preparing = false;
    aiWaiting = false;
    waitRoll = null;
    $('.dice-container').removeClass('dice_wait');
    drawnNow = [];
    ++turnCount;
    const leanWon = tallyLean(players[who]); //(before the save, so a restored turn is not tallied twice)
    saveGame();
    target = null;
    targetNear = [];
    moveThrow = null;
    queue = [];
    $('.sq').removeClass('target target_near');
    const p = players[who];
    handShown = false;
    delete bubbles[p.id]; //said its say
    delete trails[p.id]; //a new move
    statusNewTurn(`Turn ${turnCount}: ${tokenImg(p, 'icon')} ${playerName(p)}${aiLevel(p)? ` (${AI_LEVELS[aiLevel(p)]})`: ''}`);
    if (leanWon) STATUS_HTML(`${playerName(p)} got ${LEAN_POINTS} ${LEANS[leanWon].got} within ${LEAN_TURNS} turns: lately going for ${LEANS[leanWon].goal} (a ${LEANS[leanWon].icon} pin on the turn dial).`);
    $('#dice2').toggle(!p.path);
    drawTokens();
    drawDial();
    focusOn(aheadOf(p));
    if (p.skip)
    {
        --p.skip;
        rolled = moved = true;
        STATUS_HTML(`${playerName(p)} loses this turn.`);
        showButtons();
        return;
    }
    if (!formulaLocked(p)) return askFormula(p); //joined during the game: their formula first
    const entry = entryAtStart(p);
    if (entry) STATUS_HTML(entry);
    if (!queue.length) STATUS_HTML(turnPrompt(p));
    showButtons();
}

function turnPrompt(p)
{
    if (aiLevel(p))
    {
        if (p.stuck) return `${playerName(p)} is in ${OUTER[p.at][INDEX_NAME]}.`;
        return `${playerName(p)}'s turn` + (p.path? ` (in ${p.path}).`: '.');
    }
    let s = `${playerName(p)}'s turn: roll ${p.path? '1 die': '2 dice'}`;
    if (p.path) s += ` (in ${p.path})`;
    if (p.stuck === 'hospital') s = `${playerName(p)} is in Hospital: roll 5 or less to leave, or pay`;
    if (p.stuck === 'unemployment') s = `${playerName(p)} is unemployed: roll 7, 11 or doubles to leave, or pay`;
    if (onHawaii(p)) return `${playerName(p)}'s turn. Roll the dice. Try to roll 7 or less to stay in Hawaii Holiday (earns 2 &#x2665;), or more to leave` + (p.opp.length? '; or play an Opportunity card.': '.');
    if ((p.opp.length || p.exp.length) && !p.stuck) s += ', or play a card';
    return s + '.';
}

function onHawaii(p)
{
    return (p.at === HAWAII) && !p.path && !p.stuck;
}

//Next Player button, with the next player's token and name
function nextPlayerButton(click)
{
    const q = players[(who + 1) % players.length];
    return `<button onclick="${click}" class="button_final next_player">Next Player: ${tokenImg(q, 'icon')} ${PLAYERS[q.id]}</button>`;
}

//whether the player may start their move (throw, play a card...): their Success Formula must add up first
function readyToMove()
{
    const p = players[who];
    if (preparing || rolled || moved || busy || queue.length || gameOver || !players.length) return false;
    if (formulaTotal(p) !== options.success)
    {
        STATUS_HTML(`${playerName(p)}: your Success Formula must add up to ${options.success} points before your first move.`);
        openSheet(who);
        return false;
    }
    return true;
}

function showButtons()
{
    const p = players[who];
    let s = '';
    if (gameOver) s = '<button onclick="newGame();" class="button_final">New Game</button>';
    else if (waitRoll) s = `<span class="throw_prompt">&#x1F3B2; Roll ${(waitRoll.n === 2)? '2 dice': '1 die'} for ${waitRoll.why}.</span>`;
    else if (busy || !p) s = '';
    else if (preparing && aiLevel(p)) s = `<span class="ai_note">${PLAYERS[p.id]} (computer) sets its Success Formula</span>`;
    else if (preparing) s = `<button onclick="lockFormula();" class="button_final">&#x1F512; Lock in my Success Formula</button> <button onclick="openSheet(who);">My score sheet</button>`;
    else if (aiLevel(p))
    {
        //a computer player's turn: it plays by itself; paused, it waits for Go!
        const paused = options.aiPause && !aiGoing;
        s = `<span class="ai_note">${PLAYERS[p.id]} (computer, ${AI_LEVELS[aiLevel(p)]}, ${aiWaiting? 'done': paused? 'paused': 'thinking'})</span>`;
        if (aiWaiting) s += ' ' + nextPlayerButton('aiNext();');
        else
        if (paused) s += ' <button onclick="aiGo();" class="button_ai">Go!</button> <button onclick="aiUnpause();">Unpause permanently</button>';
    }
    else if (queue.length) s = choiceButtons(p);
    else
    {
        if (!rolled && !moved)
        {
            if (p.stuck)
            {
                const { fee, to } = leaveFee(p);
                s += `<button onclick="payToLeave();">${fee? `Pay ${money(fee)} to ${to? 'the Doctor': 'the bank'} and leave`: 'Leave free (Doctor)'}</button> `;
            }
        }
        if (moved || (rolled && !target)) s += nextPlayerButton('nextPlayer();');
    }
    $('#divButtons').html(s);
    drawAssets(p);
    $('#buttPause').html(options.aiPause? 'Resume AI &#x25B6;': 'Pause AI &#x23F8;');
    $('#divBoard').toggleClass('ai_turn', !!aiLevel(p) && !gameOver);
    aiSchedule();
}

/*
Top right (as Hotels): the cash of the player whose turn it is, as stacks of bank notes, and their cards. A person's
total, the count of each note and their cards stay hidden (cards face down) until they click Reveal (handShown: for
this turn only, as others may be looking on); a computer player keeps its cash to itself and its cards face down.
*/
let handShown = false;
function drawAssets(p)
{
    const div = $('#divMyAssets');
    if (!p) return div.html('');
    const ai = aiLevel(p), shown = revealAll || (!ai && handShown);
    let s = `<div class="assets_title">${tokenImg(p, 'icon')} ${playerName(p)}: <b>${shown? money(p.cash): ai? 'cash kept to itself': '$ ?'}</b>`;
    if (!ai) s += ` <button class="button_minor" onclick="toggleHand();" title="Show (or hide) your cash, scores and cards: others may be looking">${handShown? 'Hide': 'Reveal'}</button>`;
    s += '</div>' + ((ai && !shown)? '<div class="cash_fan"><i>&#x1F4BC; a computer player does not show its cash</i></div>': cashHtml(p.cash, shown));
    if (!p.opp.length && !p.exp.length) return div.html(s + '<div class="hand_title">no cards</div>');
    s += '<div class="hand_cards">';
    if (!shown)
    {
        //face down; a person's glow when one may be played, and a click turns them over
        const can = !ai && (p.opp.some((c) => oppPlayable(p, c)) || (p.exp.length && expPlayable(p))),
            back = (cls, text) => `<span class="handcard ${cls} back${can? ' playable': ''}"${ai? '': ' onclick="toggleHand();" title="Click to reveal your cards"'}>${text}</span>`;
        s += p.opp.map(() => back('opp', 'Opportunity<br>Knocks!')).join('') + p.exp.map(() => back('exp', 'Experience')).join('');
        return div.html(s + '</div>');
    }
    p.opp.forEach((card, k) =>
    {
        const ok = !ai && oppPlayable(p, card);
        s += `<span class="handcard opp${ok? ' playable': ''}${drawnNow.includes(card[4])? ' new': ''}"${ok? ` onclick="playOpp(${k});"`: ''}
title="${card[2].replace(/"/g, '&quot;')}${ok? ' (click to play)': ''}">${oppCardFace(card)}</span>`;
    });
    p.exp.forEach((n, k) =>
    {
        const ok = !ai && expPlayable(p);
        s += `<span class="handcard exp${ok? ' playable': ''}"${ok? ` onclick="playExp(${k});"`: ''}
title="Experience card: move ${n}${ok? ' (click to play)': ''}"><span class="flip_move">${n}</span><b>Move ${n}</b></span>`;
    });
    div.html(s + '</div>');
}

function toggleHand()
{
    if (aiLevel(players[who])) return;
    handShown = !handShown;
    drawPlayersInfo();
    drawAssets(players[who]);
    refreshSheets();
}

//cash as stacks of Hotels' bank notes, fanned out (as Hotels); counts: with the number of each note
function cashHtml(amount, counts)
{
    let s = '', tilt = -14, left = amount;
    for (const value of NOTES)
    {
        const count = Math.floor(left / value);
        left -= count * value;
        if (count <= 0) continue;
        let stack = '';
        for (let i = 0; i < Math.min(count, 5); ++i) stack += `<img src="../hotels/images/note-${value}.svg" alt="${value}" style="left: ${i * 5}px; top: ${i * 4}px;">`;
        s += `<div class="cash_stack" style="transform: rotate(${tilt}deg);">${stack}${counts? `<span class="cash_count">&times;${count}</span>`: ''}</div>`;
        tilt += 7;
    }
    if (left > 0) s += '<div class="cash_coins" title="small change">&#x1FA99;</div>';
    return `<div class="cash_fan">${s || '<i>no cash</i>'}</div>`;
}
/*
An Opportunity card may be played at the start of a turn instead of a throw (1 card a turn), or straight away when
just drawn (after moving, once a turn).
*/
function oppPlayable(p, card)
{
    if (gameOver || busy || queue.length || target || p.stuck) return false;
    const start = !rolled && !moved && !cardPlayed,
        now = moved && !oppUsed && drawnNow.includes(card[4]);
    return start || now;
}

function expPlayable(p)
{
    return !gameOver && !busy && !queue.length && !target && !p.stuck && !onHawaii(p) && !rolled && !moved && !cardPlayed;
}

//'Use it now' on a card just drawn (only this turn's)
function playOppNow(uid)
{
    if (drawnNow.includes(uid)) playOpp(players[who].opp.findIndex((c) => c[4] === uid));
}

//a click (or the dice) for the player whose turn it is: from a person only if it is not a computer player's turn
function humanMayAct(byAI)
{
    return byAI || !aiLevel(players[who]);
}

function oppLabel(card)
{
    if (card[3] === 'bump') return 'Send an opponent to Unemployment';
    if (card[1] === 'any') return 'Golden Opportunity';
    return card[1] + ((card[3] === 'free')? ' (all expense paid)': (card[3] === 'doubleHearts')? ' (double &#x2665;)': '');
}

//what leaving Hospital or Unemployment costs the player instead of a throw: { fee, to (who is paid: a player or null for the bank) }
function leaveFee(p)
{
    if (p.stuck === 'unemployment') return { fee: Math.floor(p.cash / 2), to: null };
    const doc = doctor();
    if (doc === p) return { fee: 0, to: null }; //the Doctor leaves free
    return { fee: Math.floor(p.salary / 2), to: doc };
}

function doctor()
{
    return players.find((p) => p.degree === DOCTOR_DEGREE) || null;
}

function payToLeave()
{
    const p = players[who];
    if (!p.stuck || rolled || moved || busy || gameOver) return;
    const { fee, to } = leaveFee(p), place = OUTER[p.at][INDEX_NAME];
    if (fee > p.cash)
    {
        STATUS_HTML(`Not enough cash to pay ${money(fee)}.`);
        return;
    }
    spend(p, fee, `to leave ${place}`, to);
    p.stuck = '';
    STATUS_HTML(`${playerName(p)} leaves ${place}` + (fee? `, paying ${money(fee)} to ${to? playerName(to) + ' (the Doctor)': 'the bank'}`: ' free (the Doctor)') +
        (aiLevel(p)? '.': ': now roll 2 dice' + ((p.opp.length || p.exp.length)? ', or play a card.': '.')));
    afterAction();
}

//degree's button label
function degreeText(d)
{
    if (d === DOCTOR_DEGREE) return `${d} (be the Doctor: paid the Hospital fees)`;
    return d + (DEGREES[d]? ` (free into ${DEGREES[d]})`: '');
}

//whether a degree lets its holder into a career path without paying the fee
function degreeAdmits(degree, name)
{
    const want = PATHS[name].degree;
    if (!degree || !want) return false;
    if (want === 'any') return options.anyDegree || (degree === PLAIN_DEGREE);
    return degree === want;
}

/*
A throw of n dice (1 or 2), then fn([values]) does what it brings and says what it did; the page waits meanwhile.
why: a throw a square asks for (shop, rewards, horses, Las Vegas): a person throws it themselves, by clicking the
dice (waitRoll); a computer player at once.
*/
let waitRoll = null;
function rollFor(n, fn, why)
{
    busy = true;
    $('#dice2').toggle(n === 2);
    if (why && !aiLevel(players[who]))
    {
        waitRoll = { n, fn, why };
        $('.dice-container').addClass('dice_wait');
        showButtons();
        return;
    }
    throwDice(n, fn);
}

function throwDice(n, fn)
{
    busy = true;
    showButtons();
    diceOne.roll();
    if (n === 2) diceTwo.roll();
    setTimeout(() =>
    {
        busy = false;
        appendStatus(fn((n === 2)? [diceOne.val, diceTwo.val]: [diceOne.val]));
        afterAction();
    }, DICE_MS);
}

function rollClicked(byAI)
{
    if (waitRoll)
    {
        if (!humanMayAct(byAI)) return;
        const w = waitRoll;
        waitRoll = null;
        $('.dice-container').removeClass('dice_wait');
        return throwDice(w.n, w.fn);
    }
    if (canReRoll(byAI)) return reRoll();
    if (!humanMayAct(byAI) || !readyToMove()) return;
    const p = players[who];
    if (onHawaii(p)) return tryToStay(); //in Hawaii a throw is a try to stay
    rolled = true;
    moveThrow = { stuck: p.stuck };
    ++p.throws;
    STATUS_HTML('');
    rollFor(p.path? 1: 2, ([a, b]) => thrown(a, b || 0));
}

/*
Casual ('cheat') mode: a person who does not like their throw secretly clicks the dice again before moving, and
throws afresh, as if the throw had not been (nothing shows that it was) (moveThrow: the turn's throw, and whether they were stuck before it)
*/
let moveThrow = null;
function canReRoll(byAI)
{
    return options.casual && !byAI && !aiLevel(players[who]) && moveThrow && rolled && !moved && !busy && !waitRoll && !queue.length && !gameOver;
}

function reRoll()
{
    const p = players[who];
    p.stuck = moveThrow.stuck;
    moveThrow = null;
    target = null;
    targetNear = [];
    $('.sq').removeClass('target target_near');
    rolled = false;
    --p.throws;
    //in secret: the throw's line goes from the message area and History, as if it had not been
    historyLines.pop();
    $('#divStatus .log_line').last().remove();
    refreshHistory();
    rollClicked();
}

//Hawaii: the throw (the dice clicked) stays with 7 or less (2 hearts); more leaves by that throw
function tryToStay()
{
    const p = players[who];
    if (!onHawaii(p) || !readyToMove()) return;
    rolled = true;
    moveThrow = { stuck: p.stuck };
    ++p.throws;
    STATUS_HTML('');
    rollFor(2, ([a, b]) =>
    {
        if (a + b <= 7)
        {
            moved = true;
            setScore(p, 'hearts', p.hearts + 2);
            return `Threw ${a} + ${b} = ${a + b}: ${playerName(p)} stays in Hawaii, +2 &#x2665;.`;
        }
        return `Threw ${a} + ${b} = ${a + b}: too much to stay. ` + aim(p, a + b);
    });
}

function thrown(a, b)
{
    const p = players[who], n = a + b;
    let s = `Threw ${b? `${a} + ${b} = ${n}`: n}. `;
    if (p.stuck)
    {
        const out = (p.stuck === 'hospital')? (n <= 5): ((n === 7) || (n === 11) || (a === b));
        if (!out) return s + `Still in ${OUTER[p.at][INDEX_NAME]}.`;
        s += `Out of ${OUTER[p.at][INDEX_NAME]}! `;
        p.stuck = '';
    }
    return s + aim(p, n);
}

//n steps ahead glows, to be clicked (a computer player clicks it itself); the way there is shown. Casual mode: a person
//may also click 1 square short of it or past it (targetNear), in secret: they do not glow
let targetNear = [];
function aim(p, n)
{
    target = walk(p, n);
    target.n = n;
    $('.sq').removeClass('target target_near');
    $('#' + cellId(target)).addClass('target');
    targetNear = (options.casual && !aiLevel(p))? [n - 1, n + 1].filter((k) => k >= 1).map((k) => Object.assign(walk(p, k), { n: k })): [];
    const way = [{ at: p.at, path: p.path, step: p.step }];
    for (let k = 1; k <= n; ++k) way.push(walk(p, k));
    focusOn(way);
    return aiLevel(p)? `${playerName(p)} moves to the glowing square.`: 'Click the glowing square to move there.';
}

//where n steps take a player: { at, path, step, passPay, done (completed the path) }
function walk(p, n)
{
    if (p.path)
    {
        const squares = PATHS[p.path].squares, step = p.step + n;
        if (step < squares.length) return { at: p.at, path: p.path, step, passPay: false, done: false };
        const j = PATHS[p.path].exit + step - squares.length;
        return { at: j % OUTER_COUNT, path: '', step: -1, passPay: j >= OUTER_COUNT, done: true };
    }
    const j = p.at + n;
    return { at: j % OUTER_COUNT, path: '', step: -1, passPay: j >= OUTER_COUNT, done: false };
}

function squareClicked(id, byAI)
{
    if (!target || busy || !humanMayAct(byAI)) return;
    const to = [target, ...targetNear].find((t) => cellId(t) === id);
    if (!to) return;
    const p = players[who], from = p.path,
        start = { at: p.at, path: p.path, step: p.step },
        route = []; //the squares on the way, the token walking over them (as in Hotels)
    for (let k = 1; k < (to.n || 0); ++k) route.push(walk(start, k));
    target = null;
    targetNear = [];
    $('.sq').removeClass('target target_near');
    moved = true;
    busy = true;
    showButtons();
    walkRoute(p, route, () =>
    {
        busy = false;
        Object.assign(p, { at: to.at, path: to.path, step: to.step });
        if (!p.path) p.doubleHearts = '';
        STATUS_HTML(arrive(p, to.passPay, to.done? from: '', null));
        afterAction();
    }, to);
}

/*
Money changing hands, shown as in Hotels: in the top panel the payer (or the Bank) on the left, bank notes going
across, the payee on the right, the amount and what for (one after another, PAY_MS each; the game does not wait);
and the amount floating up from the token(s). from / to: a player, or null for the Bank.
*/
let PAY_MS = 2400, FLOAT_MS = 1800, payQueue = Promise.resolve();
const NOTES = [5000, 1000, 500, 100, 50]; //bank notes: Hotels' pictures, ../hotels/images/note-<value>.svg

function showPayment(from, to, amount, what)
{
    amount = Math.round(amount);
    if (amount <= 0) return;
    if (from) floatLabel(from, `-${money(amount)}`, 'float_loss');
    if (to) floatLabel(to, `+${money(amount)}`, 'float_gain');
    if (PAY_MS <= 0) return;
    const face = (p) => p? `<div class="pay_face">${tokenImg(p, 'pay_token')}<div style="color:${PLAYER_COLORS[p.id]}">${PLAYERS[p.id]}</div></div>`:
        '<div class="pay_face"><div class="pay_bank">&#x1F3E6;</div><div>Bank</div></div>';
    let notes = '', shown = 0, left = amount;
    for (const value of NOTES) for (; (left >= value) && (shown < 7); left -= value, ++shown)
        notes += `<img class="pay_note" src="../hotels/images/note-${value}.svg" alt="" style="animation-delay: ${shown * 0.11 * PAY_MS / 2400}s; top: ${8 + ((shown % 3) * 14)}px;">`;
    payQueue = payQueue.then(() => new Promise((resolve) =>
    {
        const show = $(`<div class="pay_show" style="--pay: ${PAY_MS}ms;">${face(from)}
<div class="pay_lane">${notes}<div class="pay_amount">${money(amount)}</div><div class="pay_what">${what}</div></div>${face(to)}</div>`);
        $('#divMid').append(show);
        setTimeout(() => { show.remove(); resolve(); }, PAY_MS);
    }));
}

//a label floating up from a player's token, e.g. money gained or lost
function floatLabel(p, s, cls)
{
    if (FLOAT_MS <= 0) return;
    const sq = $('#' + cellId(p)), board = $('#divBoard');
    if (!sq.length) return;
    const x = sq.offset().left - board.offset().left + sq.outerWidth() / 2, y = sq.offset().top - board.offset().top + sq.outerHeight() / 2;
    const label = $(`<div class="float_label ${cls || ''}" style="left: ${x}px; top: ${y}px; animation-duration: ${FLOAT_MS}ms;">${s}</div>`);
    board.append(label);
    setTimeout(() => label.remove(), FLOAT_MS);
}

//confetti over the page (as in Hotels): a double salary, a win
function throwConfetti()
{
    if (FLOAT_MS <= 0) return;
    const div = $('<div class="confetti"></div>'), colours = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'];
    for (let i = 0; i < 80; ++i)
        div.append(`<span style="left: ${Math.random() * 100}%; background: ${colours[i % colours.length]}; animation-delay: ${Math.random() * 1500}ms;
--dx: ${Math.random() * 300 - 150}px; --turn: ${Math.random() * 1440 - 720}deg;"></span>`);
    $('body').append(div);
    setTimeout(() => div.remove(), 6000);
}

/*
Speech bubbles over tokens, as in Hotels: emoji saying how the player took what just happened (money flying away and
a tear, a star and a grin...). A bubble stays until that player's next bubble or next turn; 'fumes': it keeps rocking.
*/
let BUBBLE_MS = 1, bubbles = {}; //{ player id: { html, fumes, since } }; BUBBLE_MS 0 (tests): none
const MOOD = {
    paid: '<span class="bubble_cash">$$</span> &#x1F604;',
    payday: '<span class="bubble_cash">$$</span> &#x1F911;',
    payBig: '<span class="bubble_fly">&#x1F4B8;</span><span class="bubble_fly">&#x1F4B8;</span> &#x1F622;',
    paySmall: '<span class="bubble_fly">&#x1F4B8;</span> &#x1F605;',
    bankrupt: '<span class="bubble_fly">&#x1F4B8;</span><span class="bubble_fly">&#x1F4B8;</span> &#x1F62D;',
    hospital: '&#x1F691; &#x1F915;', unemployment: '&#x1F4C9; &#x1F629;', bumper: '&#x1F608;',
    fame: '&#x2B50; &#x1F60E;', hearts: '&#x2764;&#xFE0F; &#x1F60D;', loseHearts: '&#x1F494; &#x1F62D;', loseFame: '&#x1F631;',
    halved: '&#x1F629;', skip: '&#x1F634;', again: '&#x1F3B2; &#x1F603;', hawaii: '&#x1F3DD;&#xFE0F; &#x1F60E;',
    looking: '&#x1F697; &#x1F612;', car: '&#x1F697; &#x1F60D;', paris: '&#x1F5FC; &#x1F60D;', charity: '&#x1F397;&#xFE0F; &#x1F607;',
    horses: '&#x1F40E; &#x1F60E;', cards: '&#x1F0CF; &#x1F60F;', won: '&#x1F3C6; &#x1F973;', cannot: '&#x1F6AB; &#x1F61E;',
    joined: '&#x1F44B; &#x1F600;'
};

function tokenBubble(p, html, fumes)
{
    if ((BUBBLE_MS <= 0) || !p) return;
    bubbles[p.id] = { html, fumes: !!fumes, since: Date.now() };
    drawBubbles();
}

//a career's emblem with a face: entering it, completing it
function careerMood(name, face)
{
    return artHtml(theme_(name).icon, 'bubble_icon') + ' ' + face;
}

/*
Each bubble goes above its token, or under it where there is no room above; always wholly on the board and in the
window (a known trap since Hotels: tokens at the board's edges), its tail moved along to point at the token.
*/
function drawBubbles()
{
    const board = $('#divBoard');
    board.children('.token_bubble').remove();
    if (!board.length) return;
    const boardX = board.offset().left, win = $(window),
        minX = Math.max(4, win.scrollLeft() - boardX + 4), maxX = Math.min(board.innerWidth(), win.scrollLeft() + win.width() - boardX - 20) - 4,
        minY = Math.max(0, win.scrollTop() + $('#divTop').outerHeight() - board.offset().top + 4); //not under the top panel
    for (const p of players)
    {
        const b = bubbles[p.id], img = b && $(`#${cellId(p)} img.token[alt="${PLAYERS[p.id]}"]`);
        if (!img || !img.length) continue;
        const at = boardXY(img[0]), w = img[0].offsetWidth, h = img[0].offsetHeight,
            look = b.fumes? '': ' token_bubble_calm', delay = b.fumes? '': ` animation-delay: ${b.since - Date.now()}ms;`,
            div = $(`<div class="token_bubble${look}" style="${delay}">${b.html}</div>`).appendTo(board),
            bw = div.outerWidth(), bh = div.outerHeight(), cx = at.x + w / 2,
            above = (at.y - bh - 16 >= minY),
            left = Math.max(minX, Math.min(cx - bw / 2, maxX - bw));
        div.toggleClass('token_bubble_below', !above).css({ left, top: above? at.y - bh - 16: at.y + h + 16,
            '--tail': `${Math.max(14, Math.min(bw - 14, cx - left))}px` });
    }
}

//the page scrolled: bubbles kept clear of the top panel
let bubbleScroll = null;
$(window).on('scroll resize', () =>
{
    clearTimeout(bubbleScroll);
    bubbleScroll = setTimeout(() => { if (Object.keys(bubbles).length) drawBubbles(); }, 120);
});

/*
Trails of each player's last moves, until their next turn (Hotels' dust, Cluedo's routes): small footprints on the
squares walked over; a dotted line in the player's colour for a jump (a card, sent away, starting afresh), by Pay Day
when it passed Pay Day, with shoeprints taking off and landing.
*/
let trails = {}; //{ player id: { steps: [positions], jumps: [[positions]] } }
function trailOf(p)
{
    return trails[p.id] || (trails[p.id] = { steps: [], jumps: [] });
}

function posOf(p)
{
    return { at: p.at, path: p.path, step: p.step };
}

//the player has just jumped from 'from' to where they are now
function addJump(p, from, viaPay)
{
    if (cellId(from) === cellId(p)) return;
    trailOf(p).jumps.push(viaPay? [from, { at: PAYDAY, path: '', step: -1 }, posOf(p)]: [from, posOf(p)]);
}

function drawTrails()
{
    const board = $('#divBoard');
    board.children('.trails').remove();
    if (!board.length || !players.length) return;
    const centre = (c) =>
    {
        const el = $('#' + cellId(c))[0];
        if (!el) return null;
        const at = boardXY(el);
        return { x: at.x + el.offsetWidth / 2, y: at.y + el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight };
    };
    const shoe = (q, kind, size) => `<image href="../cluedo/images/token-shoeprints${kind}.png" x="${q.x - size / 2}" y="${q.y - size / 2}" width="${size}" height="${size}"/>`;
    let s = '';
    const count = {};
    players.forEach((p) =>
    {
        const t = trails[p.id], colour = PLAYER_COLORS[p.id];
        if (!t) return;
        for (const jump of t.jumps)
        {
            const points = jump.map(centre).filter(Boolean);
            if (points.length < 2) continue;
            const d = points.map((q, k) => `${k? 'L': 'M'}${Math.round(q.x)},${Math.round(q.y)}`).join(' ');
            s += `<path class="trail_halo" d="${d}"/><path class="trail_jump" d="${d}" style="stroke: ${colour};"/>` +
                shoe(points[0], '-jumping', 34) + shoe(points[points.length - 1], '-landing', 34);
        }
        t.steps.forEach((c, i) =>
        {
            const q = centre(c), id = cellId(c), next = centre(t.steps[i + 1] || posOf(p));
            if (!q) return;
            const k = count[id] = (count[id] || 0) + 1, x = q.x + q.w / 2 - 16 - (k - 1) * 14, y = q.y + q.h / 2 - 16,
                turn = next? Math.round(Math.atan2(next.y - q.y, next.x - q.x) * 180 / Math.PI + 90): 0; //the toes towards the next square
            s += `<circle cx="${x}" cy="${y}" r="11" style="fill: ${colour};" class="trail_dot"/><g transform="rotate(${turn} ${x} ${y})">${shoe({ x, y }, '', 20)}</g>`;
        });
    });
    board.append(`<svg class="trails" width="${board[0].offsetWidth}" height="${board[0].offsetHeight}">${s}</svg>`);
}

//where an element is on the board, as laid out (not as an animation has it for the moment)
function boardXY(el)
{
    const board = $('#divBoard')[0];
    let x = 0, y = 0;
    for (; el && (el !== board); el = el.offsetParent) x += el.offsetLeft, y += el.offsetTop;
    return { x, y };
}

//cash in from the bank, and out to the bank (or another player): with the payment shown
function gain(p, amount, what)
{
    p.cash += amount;
    cashTally(p);
    showPayment(null, p, amount, what);
    if (amount > 0) tokenBubble(p, (what === 'double salary')? MOOD.payday: MOOD.paid);
}

function spend(p, amount, what, to)
{
    p.cash -= amount;
    if (to) to.cash += amount;
    cashTally(p);
    if (to) cashTally(to);
    showPayment(p, to || null, amount, what);
    if (amount > 0) tokenBubble(p, (amount >= 1000)? MOOD.payBig: MOOD.paySmall);
    if (to && (amount > 0)) tokenBubble(to, MOOD.paid);
}

//'Find Me!': scroll to the token of the player whose turn it is, and make it jump
//scroll to the token of the current player, or of the player given (index into players)
function findMe(k)
{
    const p = players[k ?? who];
    if (!p) return;
    const sq = $('#' + cellId(p));
    if (!sq.length) return;
    $('html, body').animate({ scrollTop: Math.max(0, sq.offset().top - $('#divTop').outerHeight() - 80) }, 300);
    p.hop = true;
    drawTokens();
}

/*
The board scrolls (when need be) to show the given squares (positions { at, path, step }) below the top panel: the
first one (the token) above all. A computer player's next action waits for it (focusUntil).
*/
let FOCUS_MS = 900, focusUntil = 0;
function focusOn(cells)
{
    if (FOCUS_MS <= 0) return;
    const boxes = cells.map((c) => $('#' + cellId(c))).filter((sq) => sq.length).map((sq) =>
        ({ top: sq.offset().top, left: sq.offset().left, bottom: sq.offset().top + sq.outerHeight(), right: sq.offset().left + sq.outerWidth() }));
    if (!boxes.length) return;
    const box = boxes.reduce((a, b) => ({ top: Math.min(a.top, b.top), left: Math.min(a.left, b.left),
            bottom: Math.max(a.bottom, b.bottom), right: Math.max(a.right, b.right) })),
        win = $(window), topPanel = $('#divTop').outerHeight() + 10, margin = 20,
        viewTop = win.scrollTop() + topPanel, viewBottom = win.scrollTop() + win.height(),
        viewLeft = win.scrollLeft(), viewRight = win.scrollLeft() + win.width();
    //the scroll that shows the range [from, to] in a view of size 'size' (the first square, 'first', if it cannot all be shown)
    const fit = (from, to, first, size, now, offset) =>
    {
        if ((from >= now + offset) && (to <= now + offset + size)) return now;
        if (to - from + 2 * margin <= size) return Math.max(0, (from + to) / 2 - size / 2 - offset);
        return Math.max(0, first - margin - offset);
    };
    const y = fit(box.top, box.bottom, boxes[0].top, viewBottom - viewTop, win.scrollTop(), topPanel),
        x = fit(box.left, box.right, boxes[0].left, viewRight - viewLeft, win.scrollLeft(), 0);
    if ((Math.abs(y - win.scrollTop()) < 2) && (Math.abs(x - win.scrollLeft()) < 2)) return;
    $('html, body').stop().animate({ scrollTop: y, scrollLeft: x }, FOCUS_MS / 2);
    focusUntil = Date.now() + FOCUS_MS;
}

//the player's square and where the next throw may take them (1 die in a career, 2 on the track)
function aheadOf(p)
{
    const cells = [{ at: p.at, path: p.path, step: p.step }];
    for (let n = 1; n <= (p.path? 6: 12); ++n) cells.push(walk(p, n));
    return cells;
}

//the token goes over the squares of route one by one (WALK_MS each, as Hotels' pace), then done(); the page follows
//it, keeping the squares still to go (to the destination 'to') in view
let WALK_MS = 450;
function walkRoute(p, route, done, to)
{
    if ((WALK_MS <= 0) || !route.length)
    {
        trailOf(p).steps.push(posOf(p), ...route.map(posOf));
        return done();
    }
    const run = gameRun;
    let k = 0;
    const step = () =>
    {
        if (run !== gameRun) return;
        trailOf(p).steps.push(posOf(p)); //a footprint on the square it leaves
        if (k >= route.length) return done();
        Object.assign(p, { at: route[k].at, path: route[k].path, step: route[k].step });
        focusOn(route.slice(k).concat(to? [to]: []));
        ++k;
        p.hop = 'step';
        drawTokens();
        setTimeout(step, WALK_MS);
    };
    step();
}

/*
The player has got to where they are now: Pay Day on the way, completing a path, bumping, then what the square says.
passPay: passed (or landed on) Pay Day; done: the career path just completed, if any; card: the Opportunity card
that brought them (to an entrance), if any.
*/
function arrive(p, passPay, done, card)
{
    const lines = []; //each on a line of its own
    if (passPay)
    {
        const pay = p.salary * ((p.at === PAYDAY)? 2: 1);
        gain(p, pay, (p.at === PAYDAY)? 'double salary': 'salary');
        if (p.at === PAYDAY) throwConfetti();
        lines.push((p.at === PAYDAY)? `Landed on Pay Day: double salary, ${money(pay)}!`: `Passed Pay Day: salary ${money(pay)}.`);
    }
    if (done) lines.push(completed(p, done));
    let s = landedText(p) + bump(p);
    const what = p.path? pathEffect(p, PATHS[p.path].squares[p.step][INDEX_EFFECT], p.path): outerEffect(p, card);
    lines.push(s + (what? ` ${playerName(p)} ${what}.`: ''));
    return lines.join('<br>');
}

//completing a path: occupation record, Experience cards (MAX_EXPERIENCE_DRAW); College: a pay rise and a degree to choose
function completed(p, name)
{
    const done = PATHS[name].onExit || {};
    let s = `Completed ${name}! `;
    p.record[name] = (p.record[name] || 0) + 1;
    tokenBubble(p, careerMood(name, '&#x1F973;'));
    p.doubleHearts = '';
    if (!done.noExperience) s += `${PLAYERS[p.id]} ${drawExp(p, Math.min(p.record[name], MAX_EXPERIENCE_DRAW))}. `;
    if (done.salary)
    {
        setScore(p, 'salary', p.salary + done.salary);
        s += `Salary up ${money(done.salary)}. `;
    }
    if (done.degree)
    {
        const choice = availableDegrees();
        if (choice.length > 1)
        {
            queue.push({ kind: 'degree' });
            s += 'Choose your degree (buttons above). ';
        }
        else
        {
            p.degree = choice[0];
            s += `${p.degree} degree. `;
        }
    }
    return s;
}

//special degrees nobody has yet, else the plain College degree
function availableDegrees()
{
    const free = Object.keys(DEGREES).filter((d) => !players.some((p) => p.degree === d));
    return free.length? free: [PLAIN_DEGREE];
}

function landedText(p)
{
    if (p.path)
    {
        const sq = PATHS[p.path].squares[p.step];
        return `${p.path}: <i>${sq[INDEX_STORY]}</i> &ndash; <b>${sq[INDEX_REWARD]}</b>.`;
    }
    const sq = OUTER[p.at];
    if (sq[INDEX_KIND] === 'entry') return `Landed on: <b>${sq[INDEX_NAME]}</b>.`; //entering is for the next turn
    return `<b>${sq[INDEX_NAME]}</b>` + ((sq[INDEX_KIND] === 'opp')? '.': `: ${sq[INDEX_PRINT]}`);
}

//landing on an opponent sends them to Unemployment, except in Hospital and Unemployment
function bump(p)
{
    if (!p.path && ((p.at === HOSPITAL) || (p.at === UNEMPLOYMENT))) return '';
    let s = '';
    players.forEach((q) =>
    {
        if ((q !== p) && (cellId(q) === cellId(p))) s += ` Bumped ${playerName(q)} to Unemployment!`, sendTo(q, 'unemployment'), tokenBubble(p, MOOD.bumper);
    });
    return s;
}

//off to Hospital or Unemployment, out of any career path (no credit for it)
function sendTo(p, where)
{
    const from = posOf(p);
    Object.assign(p, { at: (where === 'hospital')? HOSPITAL: UNEMPLOYMENT, path: '', step: -1, stuck: where, doubleHearts: '', hop: true });
    addJump(p, from, false);
    focusOn([p]);
    tokenBubble(p, MOOD[where]);
    return `goes to ${(where === 'hospital')? 'Hospital': 'Unemployment'}`;
}

function payBank(p, amount, what)
{
    const paid = Math.min(p.cash, Math.max(0, Math.round(amount)));
    spend(p, paid, what.replace(/<[^>]*>/g, ''));
    return `pays ${money(paid)} ${what}` + ((paid < amount)? ' (all the cash there is)': '');
}

//a payment that must be made in full (taxes, rent: a share of salary, not of cash): short of cash is bankruptcy
function mustPay(p, amount, what)
{
    amount = Math.round(amount);
    if (amount <= p.cash) return payBank(p, amount, what);
    const had = p.cash;
    spend(p, had, what);
    queue.push({ kind: 'bankrupt' });
    return `owes ${money(amount)} ${what} but has only ${money(had)}: <b>bankrupt</b>`;
}

/*
Bankrupt (as in Hotels): start afresh at Pay Day with the starting cash and salary (everything else given up:
scores, careers, degree, cards; the Success Formula stays), or leave the game.
*/
function startAfresh(p)
{
    returnCards(p);
    const from = posOf(p);
    Object.assign(p, { cash: options.cash, at: PAYDAY, path: '', step: -1, stuck: '', skip: 0, doubleHearts: '', degree: '', record: {}, lean: null });
    cashTally(p);
    setScore(p, 'salary', options.salary);
    setScore(p, 'fame', 0);
    setScore(p, 'hearts', 0);
    addJump(p, from, false);
    tokenBubble(p, MOOD.bankrupt, true);
    return `${playerName(p)} starts afresh at Pay Day with ${money(options.cash)}.`;
}

function returnCards(p)
{
    oppDeck.push(...p.opp);
    expDeck.push(...p.exp);
    p.opp = [];
    p.exp = [];
}

function leaveGame(p)
{
    returnCards(p);
    const i = players.indexOf(p), name = playerName(p);
    closeSheets();
    players.splice(i, 1);
    if (players.length === 1)
    {
        gameOver = true;
        revealAll = true;
        forgetSavedGame();
        return `${name} leaves the game. <div class="winner">&#x1F3C6; ${playerName(players[0])} is the last one in the game, and wins!</div>`;
    }
    who = i % players.length;
    startTurn(); //the next player's turn
    return `(${name} has left the game.)`;
}

function addScore(p, what, n)
{
    setScore(p, what, Math.max(0, p[what] + n));
}

//what a path square does (its effect in board.js); returns what happened, for the status line
function pathEffect(p, eff, name)
{
    const did = [];
    if (eff.f) addScore(p, 'fame', eff.f), tokenBubble(p, MOOD.fame), did.push(`scores ${eff.f} &#x2605;`);
    if (eff.h)
    {
        const h = eff.h * ((p.doubleHearts === name)? 2: 1);
        addScore(p, 'hearts', h);
        tokenBubble(p, MOOD.hearts);
        did.push(`scores ${h} &#x2665;` + ((h > eff.h)? ' (doubled)': ''));
    }
    if (eff.cash) gain(p, eff.cash, name), did.push(`collects ${money(eff.cash)}`);
    if (eff.salary) setScore(p, 'salary', p.salary + eff.salary), did.push(`now earns ${money(p.salary)}`);
    if (eff.half === 'salary') setScore(p, 'salary', Math.floor(p.salary / 2)), did.push(`now earns ${money(p.salary)}`);
    if (eff.half === 'cash') did.push(payBank(p, Math.floor(p.cash / 2), 'in fines'));
    if (eff.half) tokenBubble(p, MOOD.halved);
    if (eff.half === 'fame') setScore(p, 'fame', Math.floor(p.fame / 2)), did.push(`is down to ${p.fame} &#x2605;`);
    if (eff.lose) tokenBubble(p, (eff.lose === 'hearts')? MOOD.loseHearts: MOOD.loseFame, true);
    if (eff.lose === 'hearts') setScore(p, 'hearts', 0), did.push('loses all &#x2665;');
    if (eff.lose === 'fame') setScore(p, 'fame', 0), did.push('loses all &#x2605;');
    if (eff.lose === 'cash') did.push(payBank(p, p.cash, 'in fines'));
    if (eff.exp) tokenBubble(p, MOOD.cards), did.push(drawExp(p, eff.exp));
    if (eff.opp) tokenBubble(p, MOOD.cards), did.push(drawOpp(p, eff.opp));
    if (eff.loseTurn) p.skip = 1, tokenBubble(p, MOOD.skip), did.push('loses the next turn');
    if (eff.again) again = true, tokenBubble(p, MOOD.again), did.push('throws again');
    if (eff.goTo) did.push(sendTo(p, eff.goTo));
    if (eff.fine) queue.push({ kind: 'fine', amount: eff.fine[0], or: eff.fine[1] });
    if (eff.die) rollFor(1, ([v]) => (gain(p, eff.die * v, name), `Rolled ${v}: ${playerName(p)} collects ${money(eff.die * v)}.`), `${money(eff.die)} x the die`);
    return did.join(', ');
}

//what an outer square does
function outerEffect(p, card)
{
    const [kind, name] = OUTER[p.at];
    switch (kind)
    {
    case 'opp': return drawOpp(p, 1);
    case 'tax':
    {
        const rate = (p.salary <= 3000)? 10: (p.salary < 10000)? 50: 90;
        return mustPay(p, p.salary * rate / 100, `in taxes (${rate}% of salary)`);
    }
    case 'rent': return mustPay(p, Math.floor(p.salary / 4), 'rent');
    case 'inflation': return payBank(p, Math.floor(p.cash / 4), 'to inflation');
    case 'shop':
        rollFor(1, ([v]) => `Rolled ${v}: ${playerName(p)} ` + payBank(p, Math.floor(p.cash * v / 10), `shopping (${v * 10}% of cash)`) + '.', 'the shopping (10% of your cash x the die)');
        return '';
    case 'hawaii': addScore(p, 'hearts', 4); tokenBubble(p, MOOD.hawaii); return 'scores 4 &#x2665;';
    case 'auto': case 'hobby': case 'vegas': case 'paris': case 'charity':
        queue.push({ kind });
        return '';
    case 'entry': return offerEntry(p, name, card);
    }
    return '';
}

//landed on a career's entrance: whether to enter is for the start of the player's next turn (entryAtStart); a card
//that brought them there (all expense paid...) is kept for it
function offerEntry(p, name, card)
{
    if ((name === 'College') && p.degree)
    {
        again = true;
        return 'is a graduate: throws again';
    }
    p.entryCard = card || null;
    return `may enter ${name} at the start of their next turn`;
}

//start of a turn on a career's entrance: the choice to enter (then 1 die along it) or not (then 2 dice); or why not
function entryAtStart(p)
{
    const [kind, name] = OUTER[p.at];
    if (p.path || p.stuck || (kind !== 'entry') || ((name === 'College') && p.degree)) return '';
    const card = p.entryCard || null, ways = entryWays(p, name, card);
    p.entryCard = null;
    if (!ways.length) return tokenBubble(p, MOOD.cannot), `${playerName(p)} cannot meet ${name}'s entrance requirements.`;
    queue.push({ kind: 'enter', name, card, ways });
    return `${playerName(p)} is at the entrance of <b>${name}</b>: enter it?`;
}

//ways into a career: free ones (card, experience, degree) if any, else paying the fee
function entryWays(p, name, card)
{
    const path = PATHS[name], free = [];
    if ((name === 'College') && p.degree) return [];
    if (card && (card[3] === 'free')) free.push({ how: 'card', label: 'Enter free (Opportunity card)' });
    if (p.record[name]) free.push({ how: 'experience', label: `Enter free (${name} experience)` });
    if (degreeAdmits(p.degree, name)) free.push({ how: 'degree', label: `Enter free (${p.degree} degree)` });
    if (free.length) return free.slice(0, 1);
    return (p.cash >= path.fee)? [{ how: 'fee', label: `Pay ${money(path.fee)} and enter` }]: [];
}

/*
Choices waiting for the player (queue), shown as buttons: each { kind, ... }; opts: [{ label, act }], made fresh
each time from the player's state; act() does it and returns what happened.
*/
function choiceButtons(p)
{
    const q = queue[0];
    q.opts = choiceOptions(q, p);
    return (q.prompt? `<span class="prompt">${q.prompt}</span> `: '') + (q.input || '') +
        q.opts.map((o, k) => `<button onclick="choose(${k});"${o.main? ' class="button_final"': ''}>${o.label}</button>`).join(' ');
}

function choose(k, byAI)
{
    const q = queue[0], o = q && q.opts && q.opts[k];
    if (!o || busy || gameOver || !humanMayAct(byAI)) return;
    queue.shift();
    appendStatus(o.act());
    afterAction();
}

//how many $1,000s / units the player typed in (a computer player: aiAmount), within 0..max
let aiAmount = null;
function typed(max)
{
    const n = (aiAmount !== null)? aiAmount: parseInt($('#inpAmount').val());
    aiAmount = null;
    return Math.max(0, Math.min(max, n || 0));
}

function choiceOptions(q, p)
{
    const no = (label) => ({ label: label || 'No thanks', act: () => '' }), opts = [];
    const name = playerName(p);
    q.prompt = '';
    q.input = '';
    switch (q.kind)
    {
    case 'degree':
        q.prompt = 'Your degree:';
        return availableDegrees().map((d) => ({ label: degreeText(d), act: () => (p.degree = d, `${name} graduates with a ${d} degree.`) }));
    case 'enter':
        q.prompt = `Enter ${q.name}?`;
        for (const w of q.ways) opts.push({ label: w.label, main: true, act: () =>
        {
            if (w.how === 'fee') spend(p, PATHS[q.name].fee, `into ${q.name}`);
            Object.assign(p, { path: q.name, step: -1, doubleHearts: (q.card && (q.card[3] === 'doubleHearts'))? q.name: '' });
            $('#dice2').hide();
            tokenBubble(p, careerMood(q.name, '&#x1F603;'));
            const why = { card: 'Opportunity card', experience: `previous ${q.name} experience`, degree: `${p.degree} degree` }[w.how];
            return `${name} enters ${q.name}` + ((w.how === 'fee')? `, paying ${money(PATHS[q.name].fee)}`: ` free (${why})`) +
                (aiLevel(p)? '.': ': roll 1 die to move along it.');
        } });
        return [...opts, { label: "Don't enter", act: () => `${name} stays out of ${q.name}` + (aiLevel(p)? '.': ': roll 2 dice.') }];
    case 'fine':
        q.prompt = `Fine ${money(q.amount)}, or go to Unemployment:`;
        if (p.cash >= q.amount) opts.push({ label: `Pay ${money(q.amount)}`, act: () => (spend(p, q.amount, 'fine'), `${name} pays the fine.`) });
        opts.push({ label: 'Go to Unemployment', act: () => `${name} ${sendTo(p, q.or)}.` });
        return opts;
    case 'auto':
    {
        const max = Math.floor(Math.min(p.salary, p.cash) / 1000);
        q.prompt = 'Auto show: spend up to 1 year\'s salary on a car, 1 &#x2665; per $1,000';
        if (max)
        {
            q.input = `$<input type="number" id="inpAmount" min="1" max="${max}" value="${max}" class="amount">,000 `;
            opts.push({ label: 'Buy', act: () =>
            {
                const k = typed(max);
                if (!k) return `${name} ${justLooking(p)}.`;
                spend(p, k * 1000, 'a car');
                addScore(p, 'hearts', k);
                tokenBubble(p, MOOD.car);
                return `${name} spends ${money(k * 1000)} on a car: +${k} &#x2665;.`;
            } });
        }
        opts.push({ label: 'Just looking (lose 1 &#x2665;)', act: () => `${name} ${justLooking(p)}.` });
        return opts;
    }
    case 'hobby':
        q.prompt = 'Race horses: $3,000 each, 1 &#x2605; x a die for each';
        for (const n of [1, 2]) if (p.cash >= 3000 * n) opts.push({ label: `Buy ${n} horse${(n > 1)? 's': ''}`, act: () =>
        {
            spend(p, 3000 * n, 'race horses');
            tokenBubble(p, MOOD.horses);
            rollFor(n, (v) =>
            {
                const stars = v.reduce((a, b) => a + b, 0);
                addScore(p, 'fame', stars);
                return `${name}'s horse${(n > 1)? 's': ''} rolled ${v.join(' and ')}: +${stars} &#x2605;.`;
            }, `the horse${(n > 1)? 's (a die each)': ''}`);
            return `${name} buys ${n} horse${(n > 1)? 's': ''} for ${money(3000 * n)}.`;
        } });
        return [...opts, no()];
    case 'vegas':
    {
        const max = Math.floor(p.cash / 3000);
        q.prompt = 'Las Vegas: for each $3,000 you bet, throw a die and win $1,000 x the die (no house limit)';
        if (max)
        {
            q.input = `bets of $3,000: <input type="number" id="inpAmount" min="1" max="${max}" value="1" class="amount"> `;
            opts.push({ label: 'Bet', act: () =>
            {
                const k = typed(max) || 1;
                spend(p, 3000 * k, 'bets');
                //a throw for each bet, one after the other
                const bet = (n) => rollFor(1, ([v]) =>
                {
                    gain(p, 1000 * v, 'Las Vegas');
                    if (n < k) bet(n + 1);
                    return `Bet ${n} of ${k}: threw ${v}, ${name} wins ${money(1000 * v)}.`;
                }, `bet ${n} of ${k}`);
                bet(1);
                return `${name} bets ${money(3000 * k)} (${k} &times; $3,000).`;
            } });
        }
        return [...opts, no()];
    }
    case 'bankrupt':
        q.prompt = 'Bankrupt:';
        return [{ label: 'Start afresh at Pay Day', main: true, act: () => startAfresh(p) }, { label: 'Leave the game', act: () => leaveGame(p) }];
    case 'paris': case 'charity':
    {
        const levels = (q.kind === 'paris')? [[2000, 4], [8000, 8], [16000, 12]]: [[4000, 4], [8000, 10], [12000, 16]],
            what = (q.kind === 'paris')? 'hearts': 'fame', sign = (q.kind === 'paris')? '&#x2665;': '&#x2605;';
        q.prompt = (q.kind === 'paris')? 'Paris weekend:': 'Charity:';
        for (const [cost, score] of levels) if (p.cash >= cost) opts.push({ label: `${(q.kind === 'paris')? 'Pay': 'Donate'} ${money(cost)}: ${score} ${sign}`, act: () =>
        {
            spend(p, cost, (q.kind === 'paris')? 'Paris weekend': 'charity');
            addScore(p, what, score);
            tokenBubble(p, MOOD[q.kind]);
            return `${name} ${(q.kind === 'paris')? 'pays': 'donates'} ${money(cost)}: +${score} ${sign}.`;
        } });
        return [...opts, no()];
    }
    case 'golden':
        q.prompt = 'Golden Opportunity: the occupation of your choice';
        return Object.keys(PATHS).map((n) => ({ label: n, act: () => cardMove(p, PATHS[n].entry, q.card) }));
    case 'bump':
        q.prompt = 'Send to Unemployment:';
        players.forEach((o) =>
        {
            if ((o !== p) && !o.stuck && (o.path || ((o.at !== HOSPITAL) && (o.at !== UNEMPLOYMENT))))
                opts.push({ label: PLAYERS[o.id], act: () => `${name} sends ${playerName(o)} to Unemployment: ${PLAYERS[o.id]} ${sendTo(o, 'unemployment')}.` });
        });
        return [...opts, no('Nobody')];
    }
    return [no('OK')];
}

function justLooking(p)
{
    addScore(p, 'hearts', -1);
    tokenBubble(p, MOOD.looking);
    return 'is just looking: -1 &#x2665;';
}

//Experience card: move that many, as a throw would (not while in Hawaii, nor while stuck)
function playExp(k, byAI)
{
    const p = players[who];
    if (!humanMayAct(byAI) || !expPlayable(p) || !readyToMove() || (p.exp[k] === undefined)) return;
    const n = p.exp.splice(k, 1)[0];
    expDeck.push(n);
    cardPlayed = rolled = true;
    ++p.throws;
    STATUS_HTML(`${playerName(p)} plays an Experience card: move ${n}. ` + aim(p, n));
    afterAction();
}

//Opportunity card: to the career's entrance (clockwise, Pay Day on the way pays), Hawaii, or bump an opponent
function playOpp(k, byAI)
{
    const p = players[who], card = p.opp[k];
    if (!card || !humanMayAct(byAI) || !oppPlayable(p, card)) return;
    const now = moved; //straight away, just drawn
    if (!now && !readyToMove()) return;
    p.opp.splice(k, 1);
    oppDeck.push(card);
    $('.use_now').remove(); //one card a turn: no second click
    cardPlayed = rolled = moved = oppUsed = true;
    again = false;
    if (!now) ++p.throws;
    STATUS_HTML(`${playerName(p)} plays an Opportunity card: ${card[2]}.`);
    if (card[3] === 'bump') queue.push({ kind: 'bump', card });
    else if (card[1] === 'any') queue.push({ kind: 'golden', card });
    else appendStatus(cardMove(p, (card[1] === 'Hawaii')? HAWAII: PATHS[card[1]].entry, card));
    afterAction();
}

//moved by a card to outer square 'at', leaving any career path unfinished
function cardMove(p, at, card)
{
    const passPay = at < p.at, from = posOf(p);
    Object.assign(p, { at, path: '', step: -1, doubleHearts: '', hop: true });
    addJump(p, from, passPay);
    focusOn([p]);
    return arrive(p, passPay, '', card);
}

//after anything happens: a winner? choices left? a throw again?
function afterAction()
{
    checkWin();
    if (!busy && !queue.length && again && !gameOver && (moved || (rolled && !target)))
    {
        again = false;
        rolled = moved = cardPlayed = false;
        $('#dice2').toggle(!players[who].path);
        appendStatus(`${playerName(players[who])} throws again!`);
    }
    drawTokens();
    showButtons();
}

//money points, fame and happiness all reach the Success Formula: the player whose turn it is first
function successReached(p)
{
    return (moneyPoints(p) >= p.formula.money) && (p.fame >= p.formula.fame) && (p.hearts >= p.formula.hearts);
}

function checkWin()
{
    if (gameOver || !players.length) return;
    const order = players.map((x, i) => players[(who + i) % players.length]), p = order.find(successReached);
    if (!p) return;
    gameOver = true;
    revealAll = true;
    forgetSavedGame();
    queue = [];
    target = null;
    $('.sq').removeClass('target target_near');
    const f = p.formula;
    tokenBubble(p, MOOD.won, true);
    appendStatus(`<div class="winner">&#x1F3C6; ${playerName(p)} has reached their Success Formula (${f.money} &times; $1,000 + ${f.fame} &#x2605; + ${f.hearts} &#x2665;) and wins!</div>`);
}

function nextPlayer(byAI)
{
    if (queue.length || busy || gameOver || target || !humanMayAct(byAI)) return;
    who = (who + 1) % players.length;
    startTurn();
}

/*
Saved game (as Cluedo / Hotels): the game as it stands at the start of every turn, kept in this browser; offered
back when the page is opened again. 'Export game' gives it as a file (for debugging, tutorials...), with who the
computer players are; 'Load game' puts one on.
*/
const SAVE_KEY = 'careers.savedGame', SAVE_VERSION = 1;
let turnCount = 0, lastSave = null;

function gameSnapshot()
{
    return JSON.parse(JSON.stringify({ version: SAVE_VERSION, edition: BOARD_EDITION, turnCount, who, players, oppDeck, expDeck,
        rules: { success: options.success, anyDegree: options.anyDegree, bumpCard: options.bumpCard }, ai: options.ai }));
}

function saveGame()
{
    lastSave = gameSnapshot();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(lastSave)); } catch (e) {}
}

function forgetSavedGame()
{
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

function savedGame()
{
    try
    {
        const game = JSON.parse(localStorage.getItem(SAVE_KEY));
        return validGame(game)? game: null;
    }
    catch (e)
    {
        return null;
    }
}

function validGame(game)
{
    return !!game && (game.version === SAVE_VERSION) && Array.isArray(game.players) && (game.players.length >= 2) &&
        Array.isArray(game.oppDeck) && Array.isArray(game.expDeck) && game.players.every((p) => PLAYERS[p.id] && OUTER[p.at]);
}

//saves before r118 kept a plain Opportunity card's number at [3]: move it to [4]
function fixOldCards()
{
    const fix = (c) => (c.length === 4)? [c[0], c[1], c[2], '', c[3]]: c;
    oppDeck = oppDeck.map(fix);
    players.forEach((p) => p.opp = p.opp.map(fix));
}

//put a saved game on, at the start of the turn it was saved at
function restoreGame(game)
{
    if (!validGame(game)) return false;
    closeSheets();
    game = JSON.parse(JSON.stringify(game));
    players = game.players;
    who = game.who;
    turnCount = game.turnCount - 1;
    oppDeck = game.oppDeck;
    expDeck = game.expDeck;
    fixOldCards();
    Object.assign(options, game.rules || {});
    if (game.ai) options.ai = game.ai;
    options.players = players.map((p) => p.id);
    saveOptions();
    loadOptions();
    drawPlayerChoice();
    ++gameRun;
    gameOver = false;
    revealAll = false;
    preparing = false;
    bubbles = {};
    trails = {};
    startTurn();
    appendStatus(`(Game restored: turn ${game.turnCount}.)`);
    return true;
}

function exportGame()
{
    if (!lastSave) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(lastSave, null, 1)], { type: 'application/json' }));
    link.download = `careers-turn${lastSave.turnCount}-${PLAYERS[lastSave.players[lastSave.who].id].replace(/\W+/g, '')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    appendStatus(`&#x1F4BE; Game as at the start of this turn exported as <b>${link.download}</b> (see your downloads).`);
}

//'Load game': a file picked
function importGameFile(input)
{
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
    {
        let game = null;
        try { game = JSON.parse(String(reader.result)); } catch (e) {}
        if (!restoreGame(game)) STATUS_HTML('That file is not a Careers game exported from this page.');
    };
    reader.readAsText(file);
    input.value = ''; //so that the same file can be picked again
}

$(() =>
{
    createDice();
    loadOptions(); //(before the board: its colour theme)
    drawBoard();
    drawPlayerChoice();
    const game = savedGame();
    if (!game) return newGame();
    STATUS_HTML(`A game was being played here (turn ${game.turnCount}, ${PLAYERS[game.players[game.who].id]} to play). Carry on with it?`);
    $('#divButtons').html('<button onclick="restoreGame(savedGame());" class="button_final">Yes, carry on</button> <button onclick="newGame();">No, new game</button>');
});
