//Hotels board game: rules, turn flow and page.
//Board data is in board.js, rules text in rules.js, computer players' choices in ai.js.

//timings (ms); the tests set these to 0
let DICE_ROLL_MS = 2000, //for a thrown die to come to rest, before anything is done with its value
    STEP_MS = 600, //per road space, as a token drives along
    AI_THINK_MS = 1300, //before a computer player makes each of its choices
    FLOAT_MS = 1800, //money label floating up from a token
    PAY_MS = 2400, //a payment shown in the top panel
    BUBBLE_MS = 3500, //speech bubbles over tokens: 0 for none (they stay until the player's next bubble or turn)
    SPARKLE_MS = 5000, //something on the map pointed out from the news banner
    STAMP_MS = 1700, //a stamp shown there, e.g. how the planning permission die fell
    SOUND = true, //cars sound their horns
    PALE_MAP = true, //the map starts out pale, and gets its colours back around whatever is built on it
    SHOW_RISKS = true, //before a throw, mark the entrances within 6 spaces: others' (a stay to pay) and, with any of those, own (safe)
    SWERVE_CHANCE = 0.35, //how often a car swerves round one that is in its way, leaving skid marks, rather than drive over it
    BUILD_MS = 2200, //a new building going up: bulldozer, then the building drops into place in a cloud of dust
    CLAIM_WAIT_MS = 10000, //a computer player about to throw again waits this long at a human's hotel, to be caught
    AGAIN_WAIT_MS = 4000; //and this long anywhere else, for the humans to see what it did before it goes on
const START_MONEY = 12000,
    BANK_BONUS = 2000, //for passing the Bank
    BID_STEP = 50, //bids are multiples of this
    VIVID_RINGS = [[190, 0.3], [140, 0.5], [95, 1]], //pale map: [radius, opacity] of the rings of full colour around a building
    MARK_GAP = 105, //pixels from the middle of the road to the 'buy' and 'build' icons left beside it
    DUST_GAP = 30, //and to the dust that a car leaves, on the outer side
    LOG_MAX = 200; //lines kept in the status printout
let HALF_PRICE_COMPULSORY = false, //official rule: an opponent's bare land is bought at half price. Default is the friendlier full price
    FOLLOW_TOKEN = true, //scroll the page to the token of the player whose turn it is
    AUTO_CLAIM = false, //claim hotel fees for human owners; otherwise they must click 'Claim fee' before the guest's turn passes
    revealCash = false; //debug: show everyone's cash in the Tycoons table

const TOKEN_IMAGES = ['yellow', 'red', 'brown', 'white', 'gray', 'green', 'purple', 'blue', 'pink'],
    PLAYER_BACKGROUNDS = ['yellow', 'red', 'brown', 'white', 'gray', 'green', 'purple', 'blue', 'pink'],
    DEF_PLAYERS = [false, false, false, true, true, false, false, false, false],
    ACTION_NAMES = { '': 'nothing to do here', b: 'planning permission (build)', '$': 'buy land', e: '1 free entrance', p: 'build 1 phase free' },
    BANK_ID = -1;

let diceOne, diceTwo; //movement / nights die, and planning permission die
let ignoredPlayers = {}, //{ playerId: true } for those not picked in the Players table
    playersData = [], //per player: { money, out (bankrupt), hotels: { name: { built, entrances: [road spaces], boughtTurn, completedTurn } } }
    hotelsOwners = {}, //{ hotel name: playerId }
    entrancesTaken = {}, //{ road space: hotel name }; a space has room for 1 entrance only, as no 2 may face each other
    playerPositions = []; //per player: road space (number), or id of its car park space (string) before its 1st move

let who = 0, //current player
    turnCount = 0,
    startPlayers = 2, //most players the game has had; for the Bank's rule on 3 or 4 player games
    gameOver = false,
    gameRun = 0, //goes up with each new or restored game; anything still waiting on an older one is dropped
    pendingAsk = null, //the choice being waited on
    askSeq = 0,
    askHook = null, //tests: function (playerId, question) that returns the answer, or undefined to leave it to the page
    aiPaused = false,
    pendingClaim = null, //a guest is at an entrance of a human's hotel, whose fee is to be claimed: { guestId, ownerId, hotel, claimed }; see settleStay()
    demoClaims = [], //demo page: examples of the same
    bigBells = {}, //{ guestId: true } for bells that were made big by a click on the token
    shownBuilt = {}, //{ hotel name: phases drawn }, so that only new buildings rise from the ground
    startXY = [], //per player: centre of its car park space
    actionMarks = [], //'buy' and 'build' icons left beside the road: { playerId, spot, side, kind, text }; a player's go when its next turn comes
    dustTrail = [], //road spaces that players' cars drove over on their last turn: { playerId, spot }
    menuState = null, //where the current player is in its turn while choosing what to do; saved, so that the turn can be resumed
    demoMode = false, //'?demo=1': everything built, for review; no game is played
    lastDragged = 0, //demo page: when something on the map was last dragged
    sparkles = [], //what on the map is sparkling, pointed out from the news banner: { where: CSS selector, until: time }
    stickyBubbles = {}, //{ playerId: html } speech bubbles that stay over a token until its next bubble or turn
    forfeit = false, //the player whose turn it is has declared bankrupt and starts afresh: its turn is over
    news = [], //latest news of hotels opening and growing, for the banner in the top panel
    trace = null, //demo page: the outline of a hotel's land being traced: { hotel, points: [[x, y]] }
    turnActions = [], //what the player whose turn it is has done on it, for the row of icons in the top panel; see noteAction()
    openAction = -1, //which of those has its bubble open, by a click
    audio = null, //for the cars' horns
    payQueue = Promise.resolve(), //payments being shown in the top panel, one after another
    buildStarted = {}, //{ 'hotel:phase': time } when each building last began to go up, so that redrawing the map does not cut that short
    skipRollAsk = false, //the die was clicked to throw again after a 6: the next turn starts with that throw, without asking
    sheetConfirm = false, //balance sheet: asking whether to end the game for good
    popupRules, popupDeeds, popupMyDeeds, popupHistory, popupSheet;
const POPUP_INDEX = 100; //z-index of popups: above the top panel

function randInt(max)
{
    return (Math.random() * max) | 0;
}

function formatMoney(amt)
{
    return '$' + String(amt).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

//@return ({ note value: count }) fewest notes that make up given amount
function notesFor(amount)
{
    const notes = {};
    NOTES.forEach((value) => {
        notes[value] = (amount / value) | 0;
        amount -= notes[value] * value;
    });
    return notes;
}

function sleep(ms)
{
    if (ms <= 0) return Promise.resolve();
    const run = gameRun;
    return new Promise((resolve) => {
        setTimeout(() => {
            if (run === gameRun) resolve(); //else: game was replaced meanwhile, so whoever waits is left waiting
        }, ms);
    });
}

//as sleep(), but always lets the page catch up
function breathe()
{
    const run = gameRun;
    return new Promise((resolve) => {
        setTimeout(() => {
            if (run === gameRun) resolve();
        }, 0);
    });
}

function tokenIcon(playerId)
{
    return `<img class='token_icon' src='images/token-${TOKEN_IMAGES[playerId]}.png' alt=''>`;
}

function playerString(playerId)
{
    playerId ??= who;
    return `${tokenIcon(playerId)}<font color='${PLAYER_COLORS[playerId]}'><b>${PLAYERS[playerId]}</b></font>`;
}

function stars(n)
{
    return `<span class='stars'>${'&#x2605;'.repeat(n)}</span>`;
}

////////// Game state queries //////////

function isPlaying(playerId)
{
    return !ignoredPlayers[playerId] && !playersData[playerId].out;
}

function playingIds()
{
    return PLAYERS.map((name, i) => i).filter(isPlaying);
}

function isHotel(hotel) //hotel name
{
    return (hotel !== Bank) && (hotel !== Townhall);
}

//@return playerId of owner, or -1
function owner(hotel)
{
    const ownerId = hotelsOwners[hotel];
    return (ownerId !== undefined)? ownerId: -1;
}

function isOwned(hotel)
{
    return owner(hotel) >= 0;
}

//@return live data of an owned hotel: { built, entrances, ... }; or undefined
function hotelOf(hotel)
{
    const ownerId = owner(hotel);
    return (ownerId >= 0)? playersData[ownerId].hotels[hotel]: undefined;
}

function isBuilt(hotel)
{
    const live = hotelOf(hotel);
    return !!live && (live.built > 0);
}

function ownedBySelf(hotel, playerId)
{
    playerId ??= who;
    return playersData[playerId].hotels[hotel] !== undefined;
}

function hotelsOf(playerId)
{
    return Object.keys(playersData[playerId].hotels);
}

//'main building', 'extension 2', or 'leisure facilities' (always the last phase)
function phaseName(hotel, phase)
{
    if (phase === HOTELS_DATA[hotel].build.length - 1) return 'leisure facilities';
    return (phase === 0)? 'main building': `extension ${phase}`;
}

function phaseNames(hotel, from, count)
{
    const names = [];
    for (let i = from; i < from + count; ++i)
    {
        names.push(phaseName(hotel, i));
    }
    return names.join(' + ');
}

function buildCost(hotel, from, count)
{
    let cost = 0;
    for (let i = from; i < from + count; ++i)
    {
        cost += HOTELS_DATA[hotel].build[i];
    }
    return cost;
}

function starRating(hotel, built)
{
    return (built > 0)? HOTELS_DATA[hotel].ratings[built - 1]: 0;
}

//@return ({ price, from }) what given player would pay for the land, and to whom (BANK_ID or its owner)
function landPrice(hotel)
{
    const ownerId = owner(hotel),
        { land } = HOTELS_DATA[hotel];
    if (ownerId < 0) return { price: land, from: BANK_ID };
    return { price: HALF_PRICE_COMPULSORY? land / 2: land, from: ownerId };
}

//Land can be bought as long as nothing is built on it, even from another player
function canBuyLand(playerId, hotel)
{
    return isHotel(hotel) && !ownedBySelf(hotel, playerId) && !isBuilt(hotel);
}

//Hotels of given player that still have a phase to build. Land bought this turn must wait for the next one.
function hotelsCanBuild(playerId)
{
    playerId ??= who;
    const { hotels } = playersData[playerId];
    return Object.keys(hotels).filter((name) =>
        (hotels[name].built < HOTELS_DATA[name].build.length) && (hotels[name].boughtTurn < turnCount));
}

//Hotels that given player can apply for planning permission for: not those refused it on this space
//@param denied ({ hotel: true }) optional; default: those of the turn being played
function hotelsCanApply(playerId, denied)
{
    denied = denied || (menuState? menuState.denied: undefined) || {};
    return hotelsCanBuild(playerId).filter((hotel) => !denied[hotel]);
}

//Road spaces where given hotel may still put an entrance
function freeEntranceSpots(hotel)
{
    return HOTELS_DATA[hotel].entrances.filter((spot) => entrancesTaken[spot] === undefined);
}

//Road spaces where the next entrance of given (owned) hotel may go:
//its 1st one must go on its starred spot (1st in its list); none once it has its maximum
function entranceChoices(hotel)
{
    const live = hotelOf(hotel),
        data = HOTELS_DATA[hotel];
    if (live.entrances.length >= data.maxEntrances) return [];
    if (live.entrances.length <= 0) return [data.entrances[0]];
    return freeEntranceSpots(hotel);
}

//Hotels of given player that have their main building, and room for another entrance
function hotelsNeedEntrance(playerId)
{
    playerId ??= who;
    const { hotels } = playersData[playerId];
    return Object.keys(hotels).filter((name) => (hotels[name].built > 0) && (entranceChoices(name).length > 0));
}

//Hotels of given player with all buildings up since an earlier turn: leisure facilities need no permission then
function hotelsLeisureReady(playerId)
{
    playerId ??= who;
    const { hotels } = playersData[playerId];
    return Object.keys(hotels).filter((name) =>
        (hotels[name].built === HOTELS_DATA[name].build.length - 1) && (hotels[name].completedTurn < turnCount));
}

//'L' (left/outer side of the road) or 'R'
function entranceSide(hotel, spot)
{
    return (ROAD[spot][INDEX_HOTEL_L] === hotel)? 'L': 'R';
}

//@return playerId of another player's car on given road space, or -1
function occupant(spot, exceptId)
{
    return playingIds().find((id) => (id !== exceptId) && (playerPositions[id] === spot)) ?? -1;
}

function tokenXY(playerId)
{
    const pos = playerPositions[playerId];
    return (typeof pos === 'number')? [ROAD[pos][0], ROAD[pos][1]]: startXY[playerId];
}

////////// Status printout //////////

function appendStatus(s, cls)
{
    const div = $('#divStatus')[0];
    if (!div) return;
    const line = document.createElement('div');
    line.className = 'log_line' + (cls? ` ${cls}`: '');
    line.innerHTML = s;
    div.appendChild(line);
    while (div.children.length > LOG_MAX)
    {
        div.removeChild(div.firstChild);
    }
    div.scrollTop = div.scrollHeight;
}

function showStatus(s)
{
    $('#divStatus')[0].innerHTML = '';
    appendStatus(s);
}

//a label that floats up from a player's token, e.g. money gained or lost
function floatLabel(playerId, s, cls)
{
    if (FLOAT_MS <= 0) return;
    const xy = tokenXY(playerId);
    if (!xy) return;
    const label = $(`<div class='float_label ${cls || ''}' style='left: ${xy[0]}px; top: ${xy[1] - 40}px; animation-duration: ${FLOAT_MS}ms;'>${s}</div>`);
    $('#divPlayingArea').append(label);
    setTimeout(() => label.remove(), FLOAT_MS);
}

////////// Asking for a choice: buttons for a human player, ai.js for a computer player //////////

/*
Ask given player to choose.
@param q (object) the question:
    kind: what is asked; see aiDecide() for the list
    text: shown to a human player
    options: [{ id, label, tip, cls, disabled }]
    deeds: [hotel names] title deeds to show alongside
    and whatever else the kind needs.
@return (Promise) id of the option chosen (or the amount, for a bid)
*/
function ask(playerId, q)
{
    const run = gameRun;
    q.playerId = playerId;
    q.seq = ++askSeq;
    return new Promise((resolve) => {
        q.resolve = (value) => {
            if ((pendingAsk !== q) || (run !== gameRun)) return;
            pendingAsk = null;
            clearPrompt();
            resolve(value);
        };
        pendingAsk = q;
        dispatchAsk();
    });
}

//Put the pending question to whoever is to answer it; again whenever a player is switched between human and AI
function dispatchAsk()
{
    const q = pendingAsk;
    if (!q) return;
    if (askHook)
    {
        const value = askHook(q.playerId, q);
        if (value !== undefined)
        {
            q.resolve(value);
            return;
        }
    }
    showPrompt(q);
    if (aiLevel(q.playerId) && !q.forHumans)
    {
        aiAnswer(q);
    }
}

//A human player has clicked an option
function answer(index)
{
    const q = pendingAsk;
    if (!q || (aiLevel(q.playerId) && !q.forHumans)) return;
    const option = q.options[index];
    if (!option || option.disabled) return;
    q.resolve(option.id);
}

function answerBid(pass)
{
    const q = pendingAsk;
    if (!q || (q.kind !== 'bid') || aiLevel(q.playerId)) return;
    if (pass)
    {
        q.resolve(0);
        return;
    }
    let bid = parseInt($('#inBid')[0].value, 10) || 0;
    bid -= bid % BID_STEP;
    if ((bid < q.min) || (bid > q.max))
    {
        $('#spanBidHint')[0].innerHTML = `<font color='red'>Bid ${formatMoney(q.min)} to ${formatMoney(q.max)}, or pass.</font>`;
        return;
    }
    q.resolve(bid);
}

function clearPrompt()
{
    $('#divPrompt')[0].innerHTML = '';
    $('#divPromptDeeds')[0].innerHTML = '';
    $('.dice-container').removeClass('want_dice1 want_dice2');
    $('.cell_entrance.entrance_avail').removeAttr('title');
    $('.cell_entrance').removeClass('entrance_avail entrance_hilite entrance_blink');
}

function showPrompt(q)
{
    clearPrompt();
    const div = $('#divPrompt'),
        level = q.forHumans? undefined: aiLevel(q.playerId), //forHumans: about a computer player, but for the humans to answer
        whom = playerString(q.playerId);
    if (level)
    {
        //q.announce: what it is about to throw a die for, said out loud first, for the others to cheer or to wish it ill
        div.append(q.announce? `<div class='prompt_announce'>&#x1F916; ${whom} ${q.announce}</div>
                <button id='buttCheer' class='button_free_stuff button_crowd' style='font-size: ${crowdSize(q.cheers)}px;'
                    onclick='crowd(${q.playerId},true,  "${q.shouts[0]}");'>&#x1F44F; ${q.labels[0]}</button>
                <button id='buttJeer' class='button_final button_crowd' style='font-size: ${crowdSize(q.jeers)}px;'
                    onclick='crowd(${q.playerId}, false, "${q.shouts[1]}");'>&#x1F608; ${q.labels[1]}</button>${claimButtonHtml()}`:
            `<div class='prompt_text'>&#x1F916; ${whom} (${AI_LEVELS[level]} AI) is ${AI_BUSY_WORDS[q.kind] || 'thinking'}...</div>${claimButtonHtml()}`);
        return;
    }
    let s = `<div class='prompt_text'>${whom}${q.forHumans? '': ':'} ${q.text}</div>${claimButtonHtml()}`;
    if (q.kind === 'bid')
    {
        s += `<input type='number' id='inBid' class='in_bid' min='${q.min}' max='${q.max}' step='${BID_STEP}' value='${q.min}'>
            <button onclick='answerBid();'>Bid</button>
            <button class='button_final' onclick='answerBid(true);'>Pass</button>
            <span id='spanBidHint'>You have ${formatMoney(q.max)}.</span>`;
    }
    else
    {
        let buttons = '';
        q.options.forEach((option, i) => {
            const hilite = (option.spot !== undefined)? ` onmouseenter='hiliteSlot(${option.spot}, "${option.side}", true);' onmouseleave='hiliteSlot(${option.spot}, "${option.side}", false);'`: '',
                //option.show: the button does not choose the entrance spot, it shows where it is on the map
                click = option.show? `showSlot(${option.spot}, "${option.side}");`: `answer(${i});`,
                button = `<button class='${option.cls || ''}' ${option.disabled? 'disabled': ''} onclick='${click}'${hilite}>${option.label}</button>`,
                //option.stack: one of a row of choices that each take in the ones before; later ones lie under earlier ones
                stack = (option.stack !== undefined)? ` class='stack_item ${(option.stack > 0)? 'stack_under': ''}' style='z-index: ${30 - option.stack};'`: '';
            buttons += (option.tip || stack)? `<span${stack} data-tooltip='${option.tip || ''}' data-tooltip-position='bottom'>${button}</span>`: button;
        });
        //q.box: the buttons go in a box headed by the name of the hotel that they are about
        s += q.box? `<div class='prompt_box' style='border-color: ${HOTEL_SITES[q.box].colour};'>
                <div class='prompt_box_title' style='background: ${HOTEL_SITES[q.box].colour};'>${q.box} Hotel ${stars(starRating(q.box, hotelOf(q.box).built))}</div>
                ${buttons}</div>`: buttons;
    }
    div.append(s);
    if (q.deeds)
    {
        $('#divPromptDeeds')[0].innerHTML = q.deeds.map((hotel) => deedHtml(hotel)).join('');
    }
    if ((q.kind === 'roll') || (q.kind === 'rollNights'))
    {
        //the glow goes on the dice's container, not on the die: a CSS filter on the die itself flattens its 3D cube,
        //which then shows edge on (unseen and unclickable) after some throws
        $('.dice-container').addClass('want_dice1');
    }
    else if (q.kind === 'permission')
    {
        $('.dice-container').addClass('want_dice2');
    }
    else if ((q.kind === 'menu') && q.again)
    {
        $('.dice-container').addClass('want_dice1'); //may throw again at once, by a click on the die
    }
    else if (q.kind === 'entranceSpot')
    {
        q.options.forEach((option) => {
            if (option.spot !== undefined) $(`#ent${option.spot}${option.side}`).addClass('entrance_avail').attr('title', 'Add entrance here');
        });
    }
}

//Scroll the map to given entrance spot, and blink it for a while
function showSlot(spot, side)
{
    const slot = $(`#ent${spot}${side}`);
    if (!slot[0]) return;
    slot[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    slot.addClass('entrance_blink');
    setTimeout(() => slot.removeClass('entrance_blink'), 4000);
}

function hiliteSlot(spot, side, on)
{
    $(`#ent${spot}${side}`).toggleClass('entrance_hilite', on);
}

//Throw a die, and wait for it to come to rest
async function rollDie(dice)
{
    if (openAction >= 0) //a bubble left open on one of this turn's action icons: out of the way
    {
        openAction = -1;
        drawTurnActions();
    }
    dice.roll();
    await sleep(DICE_ROLL_MS);
    return dice.val;
}

//A speech bubble over a player's token: a face (emoji) and maybe a picture, saying how it took what just happened.
//It stays up until that player's next bubble or next turn.
//@param fumes (bool) it keeps rocking: left fuming
function tokenBubble(playerId, html, fumes)
{
    if (BUBBLE_MS <= 0) return;
    stickyBubbles[playerId] = { html: html, fumes: !!fumes, since: Date.now() };
    drawTokenMarks();
}

//'Cheer' and 'Jeer' buttons, while a computer player is about to throw for something: the crowd has its say
//How big the Cheer or Jeer button is (its font size, in pixels) after given number of votes: it grows with each, up to a point
function crowdSize(votes)
{
    return Math.min(24 + ((votes || 0) * 4), 56);
}

//Each click is a vote: the button grows, and the cheer (or boo) floats up from it, and from the computer player's token too
function crowd(playerId, cheer, shout)
{
    const q = pendingAsk,
        button = $(cheer? '#buttCheer': '#buttJeer');
    if (q && q.announce)
    {
        const key = cheer? 'cheers': 'jeers';
        q[key] = (q[key] || 0) + 1;
        button.css('font-size', `${crowdSize(q[key])}px`);
        const float = $(`<span class='crowd_float ${cheer? 'float_gain': 'float_loss'}' style='left: ${20 + randInt(60)}%;'>${shout}</span>`);
        button.append(float);
        setTimeout(() => float.remove(), 1200);
    }
    floatLabel(playerId, shout, cheer? 'float_gain': 'float_loss');
}

//Picture for a speech bubble: something that was not to be had, crossed out
function crossedOut(image)
{
    return `<span class='crossed_out'><img src='images/${image}.png' alt=''></span>`;
}

/*
The news banner at the foot of the message area: hotels opening and growing, scrolling by.
@param text (HTML)
@param where (string) optional: CSS selector of what it is about on the map (a building, an entrance, a hotel's name),
    for a click on the item to go there and make it sparkle
*/
function pushNews(text, where)
{
    news.push({ text, where });
    if (news.length > 6)
    {
        news.shift();
    }
    drawNews();
}

function drawNews()
{
    const div = $('#divNews')[0];
    if (!div) return;
    if (news.length <= 0)
    {
        div.innerHTML = '';
        return;
    }
    //the newest first; the slower, the more there is to read. (An item may be plain text, from an older saved game)
    const items = news.map((item, i) => `<span class='news_item' onclick='newsClicked(${i});'>${item.text || item}</span>`)
        .reverse().join('<span class="news_gap">&#x2726;</span>');
    div.innerHTML = `<div class='news_roll' style='animation-duration: ${8 + (news.length * 7)}s;'>&#x1F4F0; ${items}</div>`;
}

//An item of news has been clicked: the map goes to what it is about, which sparkles for a while
function newsClicked(index)
{
    const item = news[index];
    if (!item || !item.where) return;
    sparkle(item.where);
}

//Scroll the map to what given CSS selector finds, and make it sparkle for a few seconds; also when the map is drawn again meanwhile
function sparkle(where)
{
    const first = $(where)[0];
    if (!first) return;
    first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    sparkles.push({ where, until: Date.now() + SPARKLE_MS });
    drawTokenMarks();
    setTimeout(drawTokenMarks, SPARKLE_MS + 50);
}

//Whose turn it is, and what the space under its token (which hides it) has to offer
function drawWho()
{
    const pos = playerPositions[who],
        action = (typeof pos === 'number')? ROAD[pos][INDEX_ACTION]: '',
        icons = {
            '$': `<img src='images/buy.png' alt=''> Buy land`,
            b: `<img src='images/build.png' alt=''> Planning permission`,
            e: `<img src='images/open.png' alt=''> 1 free entrance`,
            p: `<img src='images/build.png' alt=''> Build 1 phase free`
        };
    $('#divWho')[0].innerHTML = `${playerString(who)}'s turn ${icons[action]? `<span class='who_spot' title='What the space under the token has to offer'>on: ${icons[action]}</span>`: ''}`;
}

//All that given player owns goes: hotels knocked down, entrances gone, title deeds back with the Bank
function knockDownAll(playerId)
{
    hotelsOf(playerId).forEach((hotel) => {
        playersData[playerId].hotels[hotel].entrances.forEach((spot) => delete entrancesTaken[spot]);
        delete hotelsOwners[hotel];
        shownBuilt[hotel] = 0;
    });
    playersData[playerId].hotels = {};
}

/*
A new entrance, for all to see: in the top panel a red carpet rolls out to the hotel (taking its turn with the payments
shown there), and on the map the entrance drops into its spot and blinks.
*/
function showNewEntrance(playerId, hotel, spot, side)
{
    const slot = $(`#ent${spot}${side}`);
    if (PAY_MS > 0)
    {
        slot.addClass('entrance_new');
        setTimeout(() => slot.removeClass('entrance_new'), 2600);
        showSlot(spot, side);
        payQueue = payQueue.then(() => new Promise((resolve) => {
            const show = $(`<div class='pay_show carpet_show' style='--pay: ${PAY_MS}ms;'>
                    <div class='pay_face'><img src='images/token-${TOKEN_IMAGES[playerId]}.png' alt=''><div style='color: ${PLAYER_COLORS[playerId]};'>${PLAYERS[playerId]}</div></div>
                    <div class='pay_lane'><div class='carpet'></div><img class='carpet_door' src='images/open.png' alt=''>
                        <div class='pay_what'>New entrance for <b>${hotel} Hotel</b>, on space ${spot}</div></div>
                    <div class='pay_face'>${buildingArt(HOTEL_SITES[hotel], 0, 1.1).svg}<div>${hotel} ${stars(starRating(hotel, hotelOf(hotel).built))}</div></div>
                </div>`);
            $('#divMid').append(show);
            setTimeout(() => {
                show.remove();
                resolve();
            }, PAY_MS);
        }));
    }
}

//A die has been clicked: same as the button that asks for that throw
function onDiceClicked(id)
{
    const q = pendingAsk;
    if (!q || aiLevel(q.playerId)) return;
    const wanted = ((q.kind === 'roll') || (q.kind === 'rollNights'))? 'dice1': ((q.kind === 'permission')? 'dice2': '');
    if (id === wanted)
    {
        q.resolve('roll');
    }
    else if ((id === 'dice1') && (q.kind === 'menu') && q.again)
    {
        //'Throw again (you threw a 6)': a click on the die ends this turn's choices and throws at once
        skipRollAsk = true;
        q.resolve('end');
    }
}

function toggleAiPause()
{
    aiPaused = !aiPaused;
    $('#buttPause')[0].innerHTML = aiPaused? 'Resume AI &#x25B6;': 'Pause AI &#x23F8;';
}

////////// Money //////////

function addMoney(playerId, amount)
{
    playersData[playerId].money += amount;
    floatLabel(playerId, `${(amount >= 0)? '+': '-'}${formatMoney(Math.abs(amount))}`, (amount >= 0)? 'float_gain': 'float_loss');
}

/*
Show a payment in the top panel, over the question: the payer big on the left, the payee on the right, bank notes going
across, and the amount. One after another if several come at once; the game does not wait for them.
@param fromId, toId (int) players, or BANK_ID
@param what (string) plain text: what it is for
*/
function showPayment(fromId, toId, amount, what)
{
    if ((PAY_MS <= 0) || (amount <= 0)) return;
    const face = (id) => (id === BANK_ID)?
            `<div class='pay_face'>${buildingArt(PLACES.Bank, 0, 1.15).svg}<div>Bank</div></div>`:
            `<div class='pay_face'><img src='images/token-${TOKEN_IMAGES[id]}.png' alt=''><div style='color: ${PLAYER_COLORS[id]};'>${PLAYERS[id]}</div></div>`,
        counts = notesFor(amount);
    let notes = '',
        shown = 0;
    NOTES.forEach((value) => {
        for (let i = 0; (i < counts[value]) && (shown < 7); ++i, ++shown)
        {
            notes += `<img class='pay_note' src='images/note-${value}.svg' alt='' style='animation-delay: ${shown * 0.11 * PAY_MS / 2400}s; top: ${12 + ((shown % 3) * 16)}px;'>`;
        }
    });
    payQueue = payQueue.then(() => new Promise((resolve) => {
        const show = $(`<div class='pay_show' style='--pay: ${PAY_MS}ms;'>${face(fromId)}
                <div class='pay_lane'>${notes}<div class='pay_amount'>${formatMoney(amount)}</div><div class='pay_what'>${what}</div></div>
                ${face(toId)}</div>`);
        $('#divMid').append(show);
        setTimeout(() => {
            show.remove();
            resolve();
        }, PAY_MS);
    }));
}

//Out of the game once without money, hotels and land
function checkBankrupt(playerId)
{
    const data = playersData[playerId];
    if (data.out || (data.money > 0) || (hotelsOf(playerId).length > 0)) return false;
    data.out = true;
    liftToken(playerId);
    appendStatus(`&#x1F4B8; ${playerString(playerId)} has no money, no hotels and no land left: <b>bankrupt</b>, and out of the game!`, 'log_bad');
    refresh();
    return true;
}

/*
A player declares bankrupt by choice (owner's rule): all hotels are knocked down and the title deeds go back to the Bank;
then either a fresh start from the car park with the starting money (the turn is over), or out of the game.
A gamble for early on: go for broke, and if the die doubles the price, start again while there is time to catch up.
@param creditorId (int) optional: the player who is owed money; gets whatever cash there is
@return (Promise) 'restart', 'retire', or '' if not gone through with
*/
async function declareBankruptcy(playerId, creditorId)
{
    const data = playersData[playerId],
        choice = await ask(playerId, {
            kind: 'bankrupt',
            text: `declare <b>bankrupt</b>? All your hotels are knocked down, and your title deeds and cash go${(creditorId !== undefined)? ` (the cash to ${PLAYERS[creditorId]})`: ''}.`,
            options: [
                { id: 'restart', label: `Restart: from the car park, with ${formatMoney(START_MONEY)}`, tip: 'Your turn is over; you throw again when it comes round' },
                { id: 'retire', label: 'Retire: leave the game', cls: 'button_final' },
                { id: '', label: 'Cancel', cls: 'button_minor' }
            ]
        });
    if (!choice) return '';
    if ((creditorId !== undefined) && (data.money > 0))
    {
        addMoney(creditorId, data.money);
        showPayment(playerId, creditorId, data.money, 'all that was left');
    }
    knockDownAll(playerId);
    pendingClaim = null;
    liftToken(playerId);
    if (choice === 'restart')
    {
        data.money = START_MONEY;
        placeToken(playerId, `_s${playerId}`);
        forfeit = true;
        appendStatus(`&#x1F4B8; ${playerString(playerId)} declares <b>bankrupt</b> and starts afresh from the car park with ${formatMoney(START_MONEY)}.`, 'log_bad');
        tokenBubble(playerId, '&#x1F4B8; &#x1F605;');
    }
    else
    {
        data.money = 0;
        data.out = true;
        appendStatus(`&#x1F4B8; ${playerString(playerId)} declares <b>bankrupt</b> and retires from the game.`, 'log_bad');
    }
    showStamp('BANKRUPT', 'stamp_bad');
    refresh();
    return choice;
}

//'Declare Bankrupt' button: for a human player, while choosing what to do on a space
function declareBankruptClicked()
{
    const q = pendingAsk;
    if (demoMode || gameOver) return;
    if (!q || (q.kind !== 'menu') || aiLevel(q.playerId))
    {
        appendStatus('You can declare bankrupt on your own turn, after moving: when choosing what to do on the space.', 'log_bad');
        return;
    }
    q.resolve('bankrupt');
}

/*
A human player cannot pay a bill: raise the money by auction, or declare bankrupt instead?
@return (Promise of bool) whether bankrupt was declared (and gone through with)
*/
async function bankruptInstead(playerId, amount, creditorId)
{
    if (aiLevel(playerId)) return false;
    const choice = await ask(playerId, {
        kind: 'short',
        text: `you are ${formatMoney(amount - playersData[playerId].money)} short. What now?`,
        options: [
            { id: 'auction', label: (hotelsOf(playerId).length > 0)? 'Raise it: auction a hotel': 'Pay what there is' },
            { id: 'bankrupt', label: 'Declare bankrupt...', cls: 'button_final' }
        ]
    });
    return (choice === 'bankrupt') && !!(await declareBankruptcy(playerId, creditorId));
}

/*
Given player pays the amount to another player, or to the Bank (BANK_ID).
If short, own hotels are auctioned off 1 by 1 until there is enough or none are left; then all that is left is paid.
@return (Promise of bool) whether paid in full
*/
async function pay(fromId, toId, amount, what)
{
    const data = playersData[fromId];
    if (data.money < amount)
    {
        appendStatus(`${playerString(fromId)} has only ${formatMoney(data.money)} for a bill of ${formatMoney(amount)}!`, 'log_bad');
        if (await bankruptInstead(fromId, amount, (toId === BANK_ID)? undefined: toId)) return false;
        await raiseFunds(fromId, amount);
    }
    const paid = Math.min(data.money, amount),
        payee = (toId === BANK_ID)? 'the Bank': playerString(toId);
    addMoney(fromId, -paid);
    if (toId !== BANK_ID)
    {
        addMoney(toId, paid);
        tokenBubble(toId, `<span class='bubble_cash'>$$</span> &#x1F604;`); //money coming in
        tokenBubble(fromId, `<span class='bubble_fly'>&#x1F4B8;</span><span class='bubble_fly'>&#x1F4B8;</span> &#x1F622;`); //and flying away
    }
    showPayment(fromId, toId, paid, what);
    appendStatus(`${playerString(fromId)} pays ${payee} <span class='money_loss'>${formatMoney(paid)}</span> for ${what}${(paid < amount)? `; ${formatMoney(amount - paid)} short`: ''}.`);
    checkBankrupt(fromId);
    refresh();
    return paid === amount;
}

/*
Auction off hotels of given player until there is enough money, or no hotel is left.
@param siteHotel (string) optional: stop as soon as this one is sold
@return (Promise of bool) whether siteHotel was sold
*/
async function raiseFunds(playerId, amount, siteHotel)
{
    const data = playersData[playerId];
    while ((data.money < amount) && (hotelsOf(playerId).length > 0))
    {
        const list = hotelsOf(playerId);
        let hotel = list[0];
        if (list.length > 1)
        {
            hotel = await ask(playerId, {
                kind: 'sellWhich',
                forced: true,
                text: `You are ${formatMoney(amount - data.money)} short, and must sell a hotel to the highest bidder. Which one?`,
                options: list.map((name) => ({ id: name, label: hotelSummary(name) })),
                deeds: list
            });
        }
        await auction(playerId, hotel);
        if (hotel === siteHotel) return true;
    }
    return false;
}

/*
Sell given hotel as 1 lot (land, buildings and entrances) to the highest bidder. There is no minimum price.
If no one bids, the hotel is knocked down and its title deed goes back to the Bank.
*/
async function auction(sellerId, hotel)
{
    const live = playersData[sellerId].hotels[hotel],
        passed = {};
    let high = 0,
        highBidder = -1;
    appendStatus(`&#x1F528; <b>Auction</b>: ${playerString(sellerId)} puts up ${hotelSummary(hotel)}. No minimum price.`, 'log_auction');
    for (;;)
    {
        const bidders = playingIds().filter((id) => (id !== sellerId) && (id !== highBidder) && !passed[id]);
        if (bidders.length <= 0) break;
        //in turn order, from the seller onwards
        bidders.sort((a, b) => ((a - sellerId + PLAYERS.length) % PLAYERS.length) - ((b - sellerId + PLAYERS.length) % PLAYERS.length));
        for (const bidder of bidders)
        {
            if (!isPlaying(bidder)) continue;
            const min = high + BID_STEP,
                max = playersData[bidder].money - (playersData[bidder].money % BID_STEP);
            let bid = 0;
            if (max >= min)
            {
                bid = await ask(bidder, {
                    kind: 'bid', hotel, sellerId, high, highBidder, min, max,
                    text: `bid for ${hotelSummary(hotel)}? ${(highBidder >= 0)? `Highest bid so far: ${formatMoney(high)} by ${playerString(highBidder)}.`: 'No bid yet.'}`,
                    deeds: [hotel]
                });
            }
            if ((bid >= min) && (bid <= max))
            {
                high = bid;
                highBidder = bidder;
                appendStatus(`${playerString(bidder)} bids <b>${formatMoney(bid)}</b>.`);
            }
            else
            {
                passed[bidder] = true;
                appendStatus(`${playerString(bidder)} ${(max >= min)? 'passes': 'cannot bid'}.`);
            }
        }
    }
    delete playersData[sellerId].hotels[hotel];
    if (highBidder < 0)
    {
        delete hotelsOwners[hotel];
        live.entrances.forEach((spot) => delete entrancesTaken[spot]);
        shownBuilt[hotel] = 0;
        appendStatus(`No one bids: ${hotel} Hotel is knocked down, and its title deed is back with the Bank.`, 'log_bad');
        noteAction({ kind: 'auction', hotel, tag: 'NIL', text: `${PLAYERS[sellerId]} put <b>${hotel} Hotel</b> up for auction; no one bid, and it was knocked down` });
    }
    else
    {
        live.boughtTurn = turnCount;
        playersData[highBidder].hotels[hotel] = live;
        hotelsOwners[hotel] = highBidder;
        addMoney(highBidder, -high);
        addMoney(sellerId, high);
        showPayment(highBidder, sellerId, high, `${hotel} Hotel, at auction`);
        appendStatus(`&#x1F528; Sold! ${hotel} Hotel goes to ${playerString(highBidder)} for <b>${formatMoney(high)}</b>.`, 'log_auction');
        noteAction({
            kind: 'auction', hotel, amount: (sellerId === who)? high: undefined,
            text: `${PLAYERS[sellerId]} sold <b>${hotel} Hotel</b> at auction to ${PLAYERS[highBidder]} for <b>${formatMoney(high)}</b>`
        });
    }
    checkBankrupt(sellerId);
    refresh();
}

////////// Moving //////////

function liftToken(playerId)
{
    const pos = playerPositions[playerId];
    if (pos === undefined) return;
    const cell = $(`#cell_played${pos}`);
    cell.removeClass(`cell_player_${playerId} shimmer pulsate`);
    cell[0].innerHTML = '';
    $(`#cell${pos}`).removeClass('cell_occupied');
    playerPositions[playerId] = undefined;
}

//The player's token rides in its car, which faces the way the road goes
function placeToken(playerId, pos)
{
    playerPositions[playerId] = pos;
    const cell = $(`#cell_played${pos}`),
        car = CARS[playerId],
        goesLeft = (typeof pos !== 'number') || (ROAD[(pos + 1) % ROAD.length][0] < ROAD[pos][0]);
    cell.addClass(`cell_player_${playerId}`);
    cell[0].innerHTML = `<div class='car ${goesLeft? 'car_left': ''}' title="${PLAYERS[playerId]}'s ${car.name}">${carSvg(car)}</div>`;
    $(`#cell${pos}`).addClass('cell_occupied');
    if (playerId === who)
    {
        cell.addClass('shimmer');
    }
    drawTokenMarks();
}

/*
What goes around the tokens: a circling swirl on that of the player whose turn it is, and a bell on that of a guest
whose hotel fee is waiting to be claimed (on the demo page: on each car that stands at an entrance of someone else's hotel).
*/
function drawTokenMarks()
{
    $('.token_swirl, .claim_bell, .token_bubble_stay').remove();
    //what a clicked item of news pointed out: sparkling until its time is up
    $('.sparkle_now').removeClass('sparkle_now');
    sparkles = sparkles.filter((item) => item.until > Date.now());
    sparkles.forEach((item) => $(item.where).addClass('sparkle_now'));
    Object.keys(stickyBubbles).forEach((id) => {
        const xy = tokenXY(Number(id));
        if (xy && isPlaying(Number(id)))
        {
            //it pops up once: a redraw puts it back as far into that as it was
            const bubble = stickyBubbles[id],
                look = bubble.fumes? '': ` token_bubble_calm' data-since='${bubble.since}`,
                delay = bubble.fumes? '': ` animation-delay: ${bubble.since - Date.now()}ms;`;
            $('#divPlayingArea').append(`<div class='token_bubble token_bubble_stay${look}' style='left: ${xy[0]}px; top: ${xy[1] - 52}px;${delay}'>${bubble.html}</div>`);
        }
    });
    $('.building_wobble').removeClass('building_wobble').removeAttr('data-claim');
    $('.entrance_visited').removeClass('entrance_visited').removeAttr('data-claim');
    if (!gameOver && (playerPositions[who] !== undefined))
    {
        $(`#cell_played${playerPositions[who]}`).append(`<div class='token_swirl'></div>`);
    }
    const claims = demoMode? demoClaims: ((pendingClaim && !pendingClaim.claimed)? [pendingClaim]: []);
    claims.forEach((claim, i) => {
        $(`#cell_played${playerPositions[claim.guestId]}`).append(
            `<div class='claim_bell ${bigBells[claim.guestId]? 'claim_bell_big': ''}' onclick='bellClicked(event, ${i});'
                title='${PLAYERS[claim.guestId]} is at an entrance of ${claim.hotel} Hotel. ${PLAYERS[claim.ownerId]}: click the bell to claim the fee'>&#x1F6CE;</div>`);
        //the entrance that the guest stands at sparkles, and one of the hotel's buildings or its facility (picked at random)
        //wobbles now and then; a click on either claims the fee too
        const live = hotelOf(claim.hotel),
            spot = playerPositions[claim.guestId];
        if (!live || (live.built <= 0)) return;
        if ((claim.wobble === undefined) || (claim.wobble >= live.built))
        {
            claim.wobble = randInt(live.built);
        }
        $(`.building[data-hotel="${claim.hotel}"][data-phase="${claim.wobble}"] .building_art`).addClass('building_wobble').attr('data-claim', i);
        $(`#ent${spot}${entranceSide(claim.hotel, spot)}`).addClass('entrance_visited').attr('data-claim', i);
    });
}

//The bell on a guest's token has been clicked: same as the 'Claim fee' button
function bellClicked(event, index)
{
    event.stopPropagation(); //not a click on the road space beneath
    bigBells = {};
    if (demoMode)
    {
        demoClaim(index);
        drawTokenMarks();
    }
    else
    {
        claimFee();
    }
}

function passBank(playerId)
{
    if ((startPlayers >= 3) && (playingIds().length <= 2))
    {
        appendStatus(`${playerString(playerId)} passes the Bank; nothing is paid out now that only 2 players are left.`);
        honk(playerId);
        noteAction({ kind: 'bank', tag: 'NIL', text: 'passed the <b>Bank</b>; nothing is paid out now that only 2 players are left' });
        return;
    }
    addMoney(playerId, BANK_BONUS);
    showPayment(BANK_ID, playerId, BANK_BONUS, 'passing the Bank');
    honk(playerId);
    noteAction({ kind: 'bank', amount: BANK_BONUS, text: `passed the <b>Bank</b> and collected <b>${formatMoney(BANK_BONUS)}</b>` });
    appendStatus(`&#x1F3E6; ${playerString(playerId)} passes the Bank and collects <span class='money_gain'>${formatMoney(BANK_BONUS)}</span>.`);
    refresh();
}

/*
Drive the token of given player forward by the number thrown, space by space.
Cars may not share a space: if the last one is taken, the car goes on to the next free one.
@return (Promise of bool) whether the Town Hall was passed
*/
async function driveToken(playerId, steps)
{
    let pos = (typeof playerPositions[playerId] === 'number')? playerPositions[playerId]: -1,
        passedTownhall = false,
        bumped = false;
    liftToken(playerId);
    if (pos >= 0)
    {
        addDust(playerId, pos);
    }
    for (let step = 1; ; ++step)
    {
        pos = (pos + 1) % ROAD.length;
        if (pos === BANK_LINE)
        {
            passBank(playerId);
        }
        if (pos === TOWNHALL_LINE)
        {
            passedTownhall = true;
            honk(playerId);
            noteAction({ kind: 'townhall', text: 'passed the <b>Town Hall</b>: may buy 1 entrance for each hotel that has its main building' });
            appendStatus(`&#x1F3DB; ${playerString(playerId)} passes the Town Hall: may buy 1 entrance for each hotel that has its main building.`);
        }
        const taken = occupant(pos, playerId);
        if (taken < 0)
        {
            placeToken(playerId, pos);
            if (step >= steps) break;
            await sleep(STEP_MS);
            liftToken(playerId);
            addDust(playerId, pos);
        }
        else
        {
            if ((step >= steps) && !bumped)
            {
                bumped = true;
                appendStatus(`Cars may not share a space: ${playerString(playerId)} moves on past ${playerString(taken)} to the next free one.`);
            }
            //the space is taken: the car is seen going by, drawn over the one that stands there, for as long as on any other space
            //Now and then it swerves round the other car instead, fast, and leaves skid marks there rather than dust.
            const swerves = (Math.random() < SWERVE_CHANCE);
            if (STEP_MS > 0)
            {
                const passing = $(`<div class='token_passing ${swerves? 'token_swerve': ''}' style='left: ${ROAD[pos][0]}px; top: ${ROAD[pos][1]}px;
                    animation-duration: ${STEP_MS}ms; background-image: url(images/token-${TOKEN_IMAGES[playerId]}.png);'><div class='car'>${carSvg(CARS[playerId])}</div></div>`);
                $('#divPlayingArea').append(passing);
                await sleep(STEP_MS);
                passing.remove();
            }
            addDust(playerId, pos, swerves);
        }
    }
    followToken(playerId);
    return passedTownhall;
}

//A puff of dust, in the colour of the player's car, on a road space that the car has left.
//A visual history: it stays until that player's next turn.
//@param skid (bool) skid marks instead: it swerved round another car there
function addDust(playerId, spot, skid)
{
    if (!dustTrail.some((dust) => (dust.playerId === playerId) && (dust.spot === spot)))
    {
        dustTrail.push(skid? { playerId, spot, skid: true }: { playerId, spot });
    }
    drawTrail();
}

/*
Before the throw: mark what the next 6 spaces hold for given player.
    Free things ('1 free entrance', 'build 1 phase free'): rainbow sparkle.
    And, if the option is on: entrances of other players' hotels, where a stay is to be paid: dark swirl;
    with any of those ahead, entrances of its own hotels, where it is safe: green swirl.
*/
function drawAhead(playerId)
{
    const from = (typeof playerPositions[playerId] === 'number')? playerPositions[playerId]: -1,
        marks = [];
    let danger = false;
    for (let step = 1; step <= 6; ++step)
    {
        const spot = (from + step) % ROAD.length,
            action = ROAD[spot][INDEX_ACTION],
            hotel = entrancesTaken[spot],
            ownerId = (hotel !== undefined)? owner(hotel): -1;
        if ((action === 'e') || (action === 'p'))
        {
            marks.push([spot, 'ahead_free', `${step} away: ${ACTION_NAMES[action]}`]);
        }
        if ((ownerId >= 0) && isPlaying(ownerId) && isBuilt(hotel))
        {
            if (ownerId === playerId)
            {
                marks.push([spot, 'ahead_safe', `${step} away: an entrance of your own ${hotel} Hotel. Safe`]);
            }
            else
            {
                danger = true;
                marks.push([spot, 'ahead_danger', `${step} away: an entrance of ${PLAYERS[ownerId]}'s ${hotel} Hotel: ${formatMoney(HOTELS_DATA[hotel].rent[hotelOf(hotel).built - 1][0])} a night`]);
            }
        }
    }
    $('#divAhead')[0].innerHTML = marks
        .filter(([spot, cls]) => (cls === 'ahead_free') || (SHOW_RISKS && ((cls === 'ahead_danger') || danger)))
        .map(([spot, cls, tip]) => `<div class='ahead ${cls}' title="${tip}" style='left: ${ROAD[spot][0]}px; top: ${ROAD[spot][1]}px;'></div>`).join('');
}

function clearAhead()
{
    $('#divAhead')[0].innerHTML = '';
}

//Centre of the roadside at given road space, gap pixels from the middle of the road
function roadsideXY(spot, side, gap)
{
    const info = ROAD[spot],
        rad = (info[INDEX_ANGLE] + 90) * Math.PI / 180,
        out = ((side === 'L')? 1: -1) * gap;
    return [info[0] + (out * Math.cos(rad)), info[1] + (out * Math.sin(rad))];
}

/*
Leave an icon beside the road where the current player stands, on the side of given hotel: what was bought or built there.
@param kind 'buy' or 'build'
@param text (HTML) what happened, shown in a bubble when the mouse is over the icon
@param more (object) optional: more about it for the row of this turn's actions in the top panel; see noteAction()
*/
function addMark(playerId, kind, hotel, text, more)
{
    const spot = playerPositions[playerId];
    if (typeof spot !== 'number') return;
    actionMarks.push({
        playerId, spot, kind, hotel,
        side: (ROAD[spot][INDEX_HOTEL_R] === hotel)? 'R': 'L',
        text: `Turn ${turnCount}: ${text}`
    });
    drawTrail();
    noteAction(Object.assign({ kind, hotel, text }, more));
}

/*
Add to the row of icons in the top panel that tells what the player whose turn it is has done on it.
@param action (object):
    kind: 'roll', 'bank', 'townhall', 'stay', 'buy', 'build', 'entrance', 'auction', or 'missed' (something free not taken; image: its picture)
    text: (HTML) what happened, shown in a bubble
    amount: optional: money gained (or lost, if negative)
    tag: optional: word stamped on the icon: 'FREE', 'DENIED', '2x'
    and what the kind needs for its picture and for showing it again on the map: val, hotel, phase, count, spot, side
*/
function noteAction(action)
{
    if (demoMode) return;
    action.playerId = who;
    turnActions.push(action);
    drawTurnActions();
}

function turnActionIcon(action)
{
    const site = HOTEL_SITES[action.hotel];
    switch (action.kind)
    {
    case 'roll': return `<span class='ta_die'>${String.fromCodePoint(0x2680 + action.val - 1)}</span>`;
    case 'bank': return buildingArt(PLACES.Bank, 0, 0.42).svg;
    case 'townhall': return buildingArt(PLACES['Town Hall'], 0, 0.38).svg;
    case 'buy': return `<img src='images/buy.png' alt='buy'>`;
    case 'entrance': return `<img src='images/open.png' alt='entrance'>`;
    case 'stay': return `<span class='ta_emoji'>&#x1F6CE;</span>
        <span class='ta_stay_nights ta_stay_crescent'>&#x1F319;</span>
        <span class='ta_stay_nights'>${action.nights}</span>`;
    case 'auction': return `<span class='ta_emoji'>&#x1F528;</span>`;
    case 'missed': return crossedOut(action.image); //something free that could not be taken
    case 'build': {
        //the last of the buildings that went up (or the 1st of those refused), as on the map but small
        const phase = action.phase + ((action.tag === 'DENIED')? 0: action.count - 1);
        return (phase === HOTELS_DATA[action.hotel].build.length - 1)? leisureSvg(0.6, site.leisure): buildingArt(site, phase, 0.36).svg;
    }
    default: return '';
    }
}

function drawTurnActions()
{
    $('#divTurnActions')[0].innerHTML = turnActions.map((action, i) => {
        const money = action.amount? `<span class='ta_money ${(action.amount > 0)? 'ta_in': 'ta_out'}'>${(action.amount > 0)? '&#x25B2;': '&#x25BC;'} ${formatMoney(Math.abs(action.amount))}</span>`: '',
            tag = action.tag? `<span class='ta_tag ${(action.tag === 'DENIED')? 'ta_denied': ''}'>${action.tag}</span>`: '';
        return `<div class='ta_item ${(i === openAction)? 'ta_open': ''}' onclick='replayAction(${i});'>
                <div class='ta_icon'>${turnActionIcon(action)}</div>${tag}${money}
                <div class='hotel_label action_tip ta_tip'>${playerString(action.playerId)}<br><small>${action.text}</small></div>
            </div>`;
    }).join('');
}

/*
An icon in the row of this turn's actions has been clicked: its bubble stays open (for where there is no mouse to hold
over it), and the map goes to where it happened and shows it again.
*/
function replayAction(index)
{
    const action = turnActions[index],
        go = (el) => {
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        };
    openAction = (openAction === index)? -1: index;
    drawTurnActions();
    if (!action || (openAction < 0)) return;
    switch (action.kind)
    {
    case 'build':
        if ((action.tag !== 'DENIED') && hotelOf(action.hotel) && (BUILD_MS > 0))
        {
            for (let phase = action.phase; phase < Math.min(action.phase + action.count, hotelOf(action.hotel).built); ++phase)
            {
                buildStarted[`${action.hotel}:${phase}`] = Date.now(); //goes up again
            }
            refresh();
        }
        go($(`.building[data-hotel="${action.hotel}"][data-phase="${action.phase}"]`)[0] || $(`.hotel_label[data-hotel="${action.hotel}"]`)[0]);
        break;
    case 'buy': {
        const label = $(`.hotel_label[data-hotel="${action.hotel}"]`);
        go(label[0]);
        label.addClass('label_flash');
        setTimeout(() => label.removeClass('label_flash'), 3000);
        break;
    }
    case 'entrance':
    case 'stay':
        showSlot(action.spot, action.side);
        break;
    case 'bank':
    case 'townhall':
        go($(`.building[data-place="${(action.kind === 'bank')? 'Bank': 'Town Hall'}"]`)[0]);
        honk(action.playerId);
        break;
    default:
        whereAmI(action.playerId);
    }
}

//A big stamp over the top panel, e.g. how the planning permission die fell. Takes its turn with the payments shown there.
function showStamp(text, cls)
{
    if (PAY_MS <= 0) return;
    payQueue = payQueue.then(() => new Promise((resolve) => {
        const show = $(`<div class='pay_show stamp_show' style='--pay: ${STAMP_MS}ms;'><div class='stamp ${cls}'>${text}</div></div>`);
        $('#divMid').append(show);
        setTimeout(() => {
            show.remove();
            resolve();
        }, STAMP_MS);
    }));
}

//A car sounds its horn, as it passes the Bank or the Town Hall
function honk(playerId)
{
    floatLabel(playerId, '&#x1F4EF; HONK!', 'float_honk');
    if (!SOUND || (FLOAT_MS <= 0)) return;
    try
    {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        [[392, 0], [311, 0.2]].forEach(([pitch, at]) => {
            const tone = audio.createOscillator(),
                gain = audio.createGain();
            tone.type = 'square';
            tone.frequency.value = pitch;
            gain.gain.value = 0.06;
            tone.connect(gain);
            gain.connect(audio.destination);
            tone.start(audio.currentTime + at);
            tone.stop(audio.currentTime + at + 0.16);
        });
    }
    catch (e)
    {
        //no sound in this browser, or not yet allowed to make any: the label will do
    }
}

//Given player's turn has come round again: what it left behind on its last one goes
function clearTrail(playerId)
{
    actionMarks = actionMarks.filter((mark) => mark.playerId !== playerId);
    dustTrail = dustTrail.filter((dust) => dust.playerId !== playerId);
    drawTrail();
}

//Dust and action icons on the map
function drawTrail()
{
    const count = {};
    let s = '';
    dustTrail.forEach((dust) => {
        //towards the outer side of the road; a little further for each player's dust already on that space
        const nth = count[dust.spot] || 0,
            [x, y] = roadsideXY(dust.spot, 'L', DUST_GAP - (nth * 14));
        count[dust.spot] = nth + 1;
        if (dust.skid) //where it swerved round another car: 2 tyre marks, curving out and back
        {
            const turn = ROAD[dust.spot][INDEX_ANGLE];
            s += `<svg class='skid' style='left: ${ROAD[dust.spot][0]}px; top: ${ROAD[dust.spot][1]}px; transform: rotate(${turn}deg);' viewBox='0 0 120 70'>
                    <path d='M4,52 Q30,50 44,22 Q60,-2 78,22 Q92,48 116,50' fill='none' stroke='#111c' stroke-width='5' stroke-linecap='round' stroke-dasharray='14 3'/>
                    <path d='M4,64 Q34,62 50,34 Q60,16 72,34 Q88,60 116,62' fill='none' stroke='${CARS[dust.playerId].colour}' stroke-width='5' stroke-linecap='round' stroke-dasharray='14 3'/>
                    <path d='M4,64 Q34,62 50,34 Q60,16 72,34 Q88,60 116,62' fill='none' stroke='#0008' stroke-width='5' stroke-linecap='round' stroke-dasharray='14 3'/>
                </svg>`;
            return;
        }
        s += `<svg class='dust' style='left: ${x}px; top: ${y}px;' viewBox='0 0 60 40'>
                <path d='M12,34 a10,10 0 0 1 -2,-19 a13,13 0 0 1 22,-7 a11,11 0 0 1 19,8 a9,9 0 0 1 -3,18 z'
                    fill='${CARS[dust.playerId].colour}' stroke='#000' stroke-width='2.5' stroke-linejoin='round'/>
                <path d='M17,24 q5,-6 11,0 M33,19 q5,-5 10,0' fill='none' stroke='#0009' stroke-width='2' stroke-linecap='round'/>
            </svg>`;
    });
    actionMarks.forEach((mark) => {
        const key = `${mark.spot}${mark.side}`,
            [x, y] = roadsideXY(mark.spot, mark.side, MARK_GAP + ((count[key] || 0) * 40)),
            colour = HOTEL_SITES[mark.hotel]? HOTEL_SITES[mark.hotel].colour: '#555';
        count[key] = (count[key] || 0) + 1;
        s += `<div class='action_mark' style='left: ${x}px; top: ${y}px; border-color: ${PLAYER_COLORS[mark.playerId]};'>
                <img src='images/${mark.kind}.png' alt='${mark.kind}'>
                <div class='hotel_label action_tip' style='border-color: ${colour};'>${playerString(mark.playerId)}<br><small>${mark.text}</small></div>
            </div>`;
    });
    $('#divTrail')[0].innerHTML = s;
}

function followToken(playerId)
{
    if (!FOLLOW_TOKEN || (STEP_MS <= 0)) return;
    const cell = $(`#cell_played${playerPositions[playerId]}`)[0];
    if (cell) cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

/*
Arrived at an entrance of another player's hotel. 'Keep your eyes open': it is for the owner to claim the fee.
    Human guest: the fee is claimed for the owner, there and then.
    Computer owner: claims at once too, but forgets now and then (forgetsFee in ai.js).
    Computer guest of a human owner: the owner must catch it, with the 'Claim fee' button, before the turn passes.
*/
async function settleStay(playerId)
{
    const pos = playerPositions[playerId],
        hotel = entrancesTaken[pos];
    if (hotel === undefined) return;
    const ownerId = owner(hotel);
    if ((ownerId < 0) || (ownerId === playerId) || !isPlaying(ownerId)) return;
    appendStatus(`&#x1F6CE; ${playerString(playerId)} drives up to an entrance of ${playerString(ownerId)}'s ${hotel} Hotel ${stars(starRating(hotel, hotelOf(hotel).built))}.`);
    if (aiLevel(ownerId))
    {
        if (Math.random() < AI_TRAITS[aiLevel(ownerId)].forgetsFee)
        {
            appendStatus(`&#x1F634; ${playerString(ownerId)} is not paying attention and forgets to claim the fee: ${playerString(playerId)} stays for free!`, 'log_good');
            noteAction({ kind: 'stay', hotel, spot: pos, side: entranceSide(hotel, pos), tag: 'FREE', text: `stayed at <b>${hotel} Hotel</b> for free: ${PLAYERS[ownerId]} forgot to claim the fee` });
            return;
        }
    }
    else if (!AUTO_CLAIM)
    {
        pendingClaim = { guestId: playerId, ownerId, hotel, claimed: false };
        bigBells = {};
        appendStatus(`&#x1F6CE; ${playerString(ownerId)}: click <b>Claim fee</b> before ${playerString(playerId)}'s turn passes, or the stay is free.`, 'log_info');
        drawTokenMarks();
        return;
    }
    await chargeStay(playerId, ownerId, hotel);
}

//The guest throws for the number of nights, and pays the owner
async function chargeStay(playerId, ownerId, hotel)
{
    const { built } = hotelOf(hotel),
        rating = starRating(hotel, built);
    await ask(playerId, {
        kind: 'rollNights',
        text: `You are a guest of ${playerString(ownerId)}'s ${hotel} Hotel ${stars(rating)}. Throw the die for the number of nights.`,
        announce: `has to pay for a stay at ${PLAYERS[ownerId]}'s <b>${hotel} Hotel</b> ${stars(rating)}, and throws for the number of nights:
            from <b>${formatMoney(HOTELS_DATA[hotel].rent[built - 1][0])}</b> for 1 to <b>${formatMoney(HOTELS_DATA[hotel].rent[built - 1][5])}</b> for 6...`,
        options: [{ id: 'roll', label: 'Throw for the nights &#x1F3B2;' }],
        labels: ['One!', 'Six!'],
        shouts: ['&#x1F44F; One!', '&#x1F608; Six!'],
        deeds: [hotel]
    });
    const nights = await rollDie(diceOne),
        cost = HOTELS_DATA[hotel].rent[built - 1][nights - 1];
    appendStatus(`${nights} night${(nights > 1)? 's': ''} at ${hotel} Hotel: ${formatMoney(cost)}.`);
    const spot = playerPositions[playerId];
    await pay(playerId, ownerId, cost, `${nights} night${(nights > 1)? 's': ''} at ${hotel} Hotel`);
    noteAction({
        kind: 'stay', hotel, spot, side: entranceSide(hotel, spot), amount: -cost,
        nights,
        text: `stayed ${nights} night${(nights > 1)? 's': ''} at ${PLAYERS[ownerId]}'s <b>${hotel} Hotel</b> ${stars(rating)}, for <b>${formatMoney(cost)}</b>`
    });
}

//'Claim fee' button: a human owner has caught the computer player that is at an entrance of their hotel
function claimFee()
{
    const claim = pendingClaim;
    if (!claim || claim.claimed) return;
    claim.claimed = true;
    appendStatus(`&#x1F440; ${playerString(claim.ownerId)} claims the fee for ${claim.hotel} Hotel from ${playerString(claim.guestId)}!`, 'log_good');
    $('#buttClaim').remove();
    drawTokenMarks();
    if (pendingAsk && (pendingAsk.kind === 'review'))
    {
        pendingAsk.resolve('claim');
    }
    else if (pendingAsk && (pendingAsk.kind === 'menu') && !aiLevel(pendingAsk.playerId))
    {
        pendingAsk.resolve('claimed'); //a human guest, choosing what to do: pays first
    }
}

function claimButtonHtml()
{
    const claim = pendingClaim;
    if (!claim || claim.claimed) return '';
    return `<button id='buttClaim' class='button_claim' onclick='claimFee();'>&#x1F440; ${PLAYERS[claim.ownerId]}: claim fee for ${claim.hotel}!</button>`;
}

//If the fee has been claimed, the guest pays up now
async function settleClaim()
{
    const claim = pendingClaim;
    if (!claim || !claim.claimed) return;
    pendingClaim = null;
    if (isPlaying(claim.guestId) && isPlaying(claim.ownerId) && (owner(claim.hotel) === claim.ownerId) && isBuilt(claim.hotel))
    {
        await chargeStay(claim.guestId, claim.ownerId, claim.hotel);
    }
}

//The turn passes (or the same player throws again): a fee not claimed by now is lost
function dropClaim()
{
    const claim = pendingClaim;
    pendingClaim = null;
    if (claim && !claim.claimed)
    {
        appendStatus(`&#x1F634; No one claimed the fee for ${claim.hotel} Hotel: ${playerString(claim.guestId)} stayed for free.`, 'log_info');
        tokenBubble(claim.guestId, '&#x1F61C;', true); //got away with it: a cheeky face, until its next bubble or turn
        const spot = playerPositions[claim.guestId];
        if (typeof spot === 'number')
        {
            noteAction({ kind: 'stay', hotel: claim.hotel, spot, side: entranceSide(claim.hotel, spot), tag: 'FREE', text: `stayed at <b>${claim.hotel} Hotel</b> for free: no one claimed the fee` });
        }
    }
    drawTokenMarks();
}

//Demo page: one of the example 'Claim fee' buttons has been clicked. Tells what would happen in a game.
function demoClaim(index)
{
    const claim = demoClaims[index],
        live = hotelOf(claim.hotel),
        fees = HOTELS_DATA[claim.hotel].rent[live.built - 1];
    appendStatus(`&#x1F440; ${playerString(claim.ownerId)} claims the fee for <b>${claim.hotel} Hotel</b> from ${playerString(claim.guestId)}.
        In a game, ${PLAYERS[claim.guestId]} would now have to throw the die for the number of nights and pay before doing anything else:
        ${formatMoney(fees[0])} for 1 night, up to ${formatMoney(fees[5])} for 6.
        The button and the bell on the car show from the moment the car stops at the entrance until that player's turn passes;
        after that, the stay was free.`, 'log_good');
}

function anyHumanPlaying()
{
    return playingIds().some((id) => !aiLevel(id));
}

/*
A computer player has done all it wants to on its turn. With human players in the game it does not just go on:
    turn over: it waits for a human to click 'Next Player', so that they can look over what it did, and claim a fee;
    throwing again after a 6, while at an entrance of a human player's hotel: it waits CLAIM_WAIT_MS to be caught.
*/
async function aiTurnEnd(playerId, again)
{
    await settleClaim();
    if (!anyHumanPlaying() || !isPlaying(playerId)) return;
    if (again)
    {
        if (!pendingClaim)
        {
            appendStatus(`${playerString(playerId)} threw a 6, and throws again in a moment.`);
            await sleep(AGAIN_WAIT_MS);
            return;
        }
        appendStatus(`${playerString(playerId)} threw a 6 and is about to throw again: ${Math.round(CLAIM_WAIT_MS / 1000)} seconds to claim the fee!`, 'log_bad');
        for (let waited = 0; (waited < CLAIM_WAIT_MS) && pendingClaim && !pendingClaim.claimed; waited += 250)
        {
            await sleep(250);
        }
        await settleClaim();
        return;
    }
    while (isPlaying(playerId))
    {
        //did it do anything, beyond driving to where the throw took it?
        const idle = !turnActions.some((action) => ['buy', 'build', 'entrance', 'auction', 'stay'].indexOf(action.kind) >= 0),
            choice = await ask(playerId, {
            kind: 'review', forHumans: true,
            text: idle? 'has finished: nothing done this turn but drive.': 'has finished. Look over what it did, then go on.',
            options: [{ id: 'next', label: 'Next Player &#x27A1;', cls: 'button_final' }]
        });
        if (choice !== 'claim') return;
        await settleClaim();
    }
}

////////// What a player can do on a turn //////////

//'2/5 entrances': how many given (owned) hotel has, of how many it can have
function entranceCount(hotel)
{
    return `${hotelOf(hotel).entrances.length}/${HOTELS_DATA[hotel].maxEntrances} entrances`;
}

function hotelSummary(hotel)
{
    const live = hotelOf(hotel);
    if (!live || (live.built <= 0)) return `<b>${hotel}</b> (bare land)`;
    const count = HOTELS_DATA[hotel].build.length;
    return `<b>${hotel} Hotel</b> ${stars(starRating(hotel, live.built))} (${live.built}/${count} built, ${live.entrances.length} entrance${(live.entrances.length !== 1)? 's': ''})`;
}

function buyLand(playerId, hotel)
{
    const data = playersData[playerId],
        { price, from } = landPrice(hotel);
    if (!canBuyLand(playerId, hotel) || (data.money < price)) return false;
    //its other hotels, for the bubble of this purchase's icon in the row of the turn's actions
    const others = hotelsOf(playerId).map((name) => `${name} ${stars(starRating(name, data.hotels[name].built)) }`).join(', ');
    if (from !== BANK_ID)
    {
        delete playersData[from].hotels[hotel];
        addMoney(from, price);
        tokenBubble(from, `${crossedOut('buy')} &#x1F620;`); //its land taken from under it
    }
    addMoney(playerId, -price);
    showPayment(playerId, from, price, `the land of ${hotel} Hotel`);
    data.hotels[hotel] = { built: 0, entrances: [], boughtTurn: turnCount };
    hotelsOwners[hotel] = playerId;
    appendStatus(`&#x1F4DC; ${playerString(playerId)} buys the land of <b>${hotel} Hotel</b> ${(from !== BANK_ID)? `from ${playerString(from)} by compulsory purchase `: ''}for <span class='money_loss'>${formatMoney(price)}</span>.`);
    addMark(playerId, 'buy', hotel, `bought the land of <b>${hotel} Hotel</b> ${(from !== BANK_ID)? `from ${PLAYERS[from]} `: ''}for <b>${formatMoney(price)}</b>`, {
        amount: -price,
        text: `bought the land of <b>${hotel} Hotel</b> ${(from !== BANK_ID)? `from ${PLAYERS[from]} `: ''}for <b>${formatMoney(price)}</b>`
            + `<br>${others? `Other hotels: ${others}`: 'Its 1st title deed'}`
    });
    pushNews(`${PLAYERS[playerId]} ${(from !== BANK_ID)? `takes the land of <b>${hotel}</b> from ${PLAYERS[from]}`: `buys the land of <b>${hotel}</b>`}`,
        `.hotel_label[data-hotel="${hotel}"]`);
    refresh();
    return true;
}

//Put up the next phases of a hotel (payment is not done here). how: what it cost, in words
//paid: what was paid for it; tag: optional word for its icon in the row of this turn's actions ('FREE', '2x')
function construct(playerId, hotel, count, how, paid, tag)
{
    const live = playersData[playerId].hotels[hotel],
        from = live.built;
    live.built += count;
    if ((live.built >= HOTELS_DATA[hotel].build.length - 1) && (live.completedTurn === undefined))
    {
        live.completedTurn = turnCount;
    }
    appendStatus(`&#x1F3D7; ${playerString(playerId)} builds ${phaseNames(hotel, from, count)} of <b>${hotel} Hotel</b>: now ${stars(starRating(hotel, live.built))}.`, 'log_good');
    addMark(playerId, 'build', hotel, `built ${phaseNames(hotel, from, count)}<br>of <b>${hotel} Hotel</b>, ${how}`,
        { phase: from, count, amount: -(paid || 0), tag });
    const rating = stars(starRating(hotel, live.built));
    pushNews((from <= 0)? `&#x1F3E8; <b>${hotel} Hotel</b> opens its doors! ${rating} (${PLAYERS[playerId]})`:
        `<b>${hotel} Hotel</b> grows: ${phaseNames(hotel, from, count)}. Now ${rating}`,
        //the buildings that have just gone up
        Array.from({ length: count }, (none, i) => `.building[data-hotel="${hotel}"][data-phase="${from + i}"] .building_art`).join(', '));
    refresh();
    if (BUILD_MS > 0) //the hotel may be far from the token: the map goes to where the building is going up
    {
        const site = $(`.building[data-hotel="${hotel}"][data-phase="${from}"]`)[0];
        if (site) site.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}

/*
Planning permission: declare what to build on 1 hotel, then throw the permission die.
@return (Promise of bool) false if the player backed out before throwing
*/
async function applyToBuild(playerId, denied)
{
    const list = hotelsCanApply(playerId, denied),
        data = playersData[playerId],
        left1 = (bill) => (data.money >= bill)? formatMoney(data.money - bill): `${formatMoney(bill - data.money)} SHORT`,
        cancel = { id: '', label: 'Cancel', cls: 'button_final', tip: 'Drop the application, and go back to what else can be done on this space' },
        back = { id: 'back', label: 'Back', cls: 'button_minor', tip: 'Back to the list of your hotels' };
    let hotel, live, count;
    for (;;) //until what to build is chosen: 'Back' from the buildings of a hotel returns to the list of hotels
    {
        hotel = list[0];
        if (list.length > 1)
        {
            hotel = await ask(playerId, {
                kind: 'buildWhich',
                text: 'On which of your hotels do you want to build?',
                options: list.map((name) => {
                    const { built } = data.hotels[name],
                        costs = HOTELS_DATA[name].build;
                    return {
                        id: name,
                        label: hotelSummary(name),
                        tip: `Piggybank: ${formatMoney(data.money)}. Building here: from ${formatMoney(costs[built])} for the ${phaseName(name, built)}, to ${formatMoney(buildCost(name, built, costs.length - built))} for all that is left`
                    };
                }).concat([cancel]),
                deeds: list
            });
            if (!hotel) return false;
        }
        live = data.hotels[hotel];
        const left = HOTELS_DATA[hotel].build.length - live.built,
            options = [];
        for (let n = 1; n <= left; ++n)
        {
            //each choice takes in the ones before it: the 2nd button comes out from under the 1st, and so on,
            //and names only what it adds, with the price of the lot
            //colour under the mouse, by the worst case of the die doubling the price: green if cash is left over after that,
            //orange if it takes the very last of it, red if there is not enough
            const cost = buildCost(hotel, live.built, n);
            options.push({
                id: n,
                stack: n - 1,
                cls: (data.money > cost * 2)? 'afford_spare': ((data.money === cost * 2)? 'afford_exact': 'afford_short'),
                label: `${(n > 1)? '+ ': ''}${phaseName(hotel, live.built + n - 1)}: ${formatMoney(cost)}`,
                tip: `Piggybank: ${formatMoney(data.money)}. Left after paying: ${left1(cost)}. Left if the die doubles the price: ${left1(cost * 2)}`
            });
        }
        count = await ask(playerId, {
            kind: 'buildHowMany', hotel,
            box: hotel,
            text: `What do you apply to build at <b>${hotel} Hotel</b>? Buildings go up in the order of the title deed. If permission is granted, you must build and pay; you may then apply again.`,
            options: options.concat((list.length > 1)? [back, cancel]: [cancel]),
            deeds: [hotel]
        });
        if (!count) return false;
        if (count !== 'back') break;
    }

    const baseCost = buildCost(hotel, live.built, count);
    appendStatus(`${playerString(playerId)} applies to build ${phaseNames(hotel, live.built, count)} at ${hotel} Hotel, at ${formatMoney(baseCost)}.`);
    await ask(playerId, {
        kind: 'permission',
        text: 'Throw the planning permission die.',
        announce: `applies to build <b>${phaseNames(hotel, live.built, count)}</b> at <b>${hotel} Hotel</b> for <b>${formatMoney(baseCost)}</b>
            (${formatMoney(baseCost * 2)} if doubled; piggybank ${formatMoney(data.money)}), and throws the permission die...`,
        labels: ['Free!', 'Double!!'],
        shouts: ['&#x1F44F; Free!', '&#x1F608; Double!!'],
        options: [{ id: 'roll', label: 'Throw the permission die' }]
    });
    const val = await rollDie(diceTwo);
    let cost = baseCost;
    if (val === 3)
    {
        appendStatus(`&#x1F534; Planning permission <b>denied</b>. No more applications for ${hotel} Hotel on this space; try again on another build space.`, 'log_bad');
        denied[hotel] = true;
        addMark(playerId, 'build', hotel, `planning permission <b>denied</b> for<br>${phaseNames(hotel, live.built, count)} of <b>${hotel} Hotel</b>`,
            { phase: live.built, count, tag: 'DENIED' });
        showStamp('DENIED', 'stamp_bad');
        tokenBubble(playerId, `${crossedOut('build')} &#x1F624;`, true); //left fuming until its next turn
        return true;
    }
    if (val === 1)
    {
        cost = baseCost * 2;
        appendStatus(`<b>2x</b>: permission granted, at <b>double</b> the price: ${formatMoney(cost)}!`, 'log_bad');
        showStamp('GRANTED<br><small>at 2x the price!</small>', 'stamp_warn');
        tokenBubble(playerId, '&#x1F631;');
    }
    else if (val === 6)
    {
        cost = 0;
        appendStatus('<b>H</b>: permission granted, and it is all <b>free of charge</b>!', 'log_good');
        showStamp('FREE!', 'stamp_free');
        throwConfetti();
        tokenBubble(playerId, '&#x1F973;');
    }
    else
    {
        appendStatus(`&#x1F7E2; Planning permission <b>granted</b>, at ${formatMoney(cost)}.`);
        showStamp('GRANTED', 'stamp_good');
    }
    if (data.money < cost)
    {
        appendStatus(`${playerString(playerId)} has only ${formatMoney(data.money)}, and must raise the rest by auction. Selling this very site cancels the building plan.`, 'log_bad');
        if (await bankruptInstead(playerId, cost)) return true; //went for broke, and lost
        if (await raiseFunds(playerId, cost, hotel))
        {
            appendStatus(`The site is sold, so nothing is built and nothing is owed for it.`);
            return true;
        }
    }
    if (cost > 0)
    {
        addMoney(playerId, -cost);
        showPayment(playerId, BANK_ID, cost, `building at ${hotel} Hotel${(val === 1)? ', at double price': ''}`);
        appendStatus(`${playerString(playerId)} pays the Bank <span class='money_loss'>${formatMoney(cost)}</span>.`);
    }
    construct(playerId, hotel, count,
        (cost <= 0)? `<span class='tip_free'>free of charge</span>`: ((val === 1)? `<span class='tip_double'>for ${formatMoney(cost)} (double price)</span>`: `for ${formatMoney(cost)}`),
        cost, (cost <= 0)? 'FREE': ((val === 1)? '2x': undefined));
    return true;
}

//'Build 1 phase free' space
async function takeFreePhase(playerId)
{
    const list = hotelsCanBuild(playerId);
    let hotel = list[0];
    if (list.length > 1)
    {
        hotel = await ask(playerId, {
            kind: 'phaseWhich',
            text: 'Which hotel gets its next phase free?',
            options: list.map((name) => {
                const { built } = playersData[playerId].hotels[name];
                return { id: name, label: `${name}: ${phaseName(name, built)} (worth ${formatMoney(HOTELS_DATA[name].build[built])})` };
            }).concat([{ id: '', label: 'Back', cls: 'button_final' }]),
            deeds: list
        });
        if (!hotel) return false;
    }
    appendStatus(`&#x1F381; Free phase for ${playerString(playerId)}!`, 'log_good');
    showStamp('FREE!', 'stamp_free');
    throwConfetti();
    tokenBubble(playerId, `<img src='images/build.png' alt=''> &#x1F601;`);
    construct(playerId, hotel, 1, 'as the free phase', 0, 'FREE');
    return true;
}

/*
Add an entrance to a hotel of given player, on a free road space that borders its land.
@param hotel (string) which hotel; or undefined to let the player choose among those that can take one
@param cost (int) 0 if free
@return (Promise of bool) false if the player backed out
*/
async function takeEntrance(playerId, hotel, cost)
{
    const cancel = { id: -1, label: 'Cancel', cls: 'button_final', tip: 'No entrance now; back to what else can be done on this space' },
        back = { id: -2, label: 'Back', cls: 'button_minor', tip: 'Back to the list of your hotels' },
        list = (hotel === undefined)? hotelsNeedEntrance(playerId): [hotel];
    let spot, isFirst;
    for (;;) //until a spot is chosen: 'Back' from the spots of a hotel returns to the list of hotels
    {
        hotel = list[0];
        if (list.length > 1)
        {
            hotel = await ask(playerId, {
                kind: 'entranceWhich',
                text: 'Which hotel gets the entrance?',
                options: list.map((name) => ({ id: name, label: `<b>${name}</b>: ${entranceCount(name)}` })).concat([{ id: '', label: 'Cancel', cls: 'button_final' }]),
                deeds: list
            });
            if (!hotel) return false;
        }
        const spots = entranceChoices(hotel),
            chosen = hotel,
            side = (s) => entranceSide(chosen, s);
        isFirst = (playersData[playerId].hotels[hotel].entrances.length <= 0);
        //no choice for the 1st entrance: it goes on the hotel's starred spot. For the others, the spot is clicked on the map;
        //the buttons only show where each one is (option.show)
        spot = isFirst? spots[0]: await ask(playerId, {
            kind: 'entranceSpot', hotel,
            box: hotel,
            text: `Where does the new entrance of <b>${hotel} Hotel</b> go? Click a glowing spot on the map. The buttons show where they are.`,
            options: spots.map((s) => ({
                id: s, spot: s, side: side(s), show: true,
                label: `&#x1F4CD; Space ${s}`,
                tip: `Show this spot on the map (by ${ROAD[s][INDEX_HOTEL_L]} and ${ROAD[s][INDEX_HOTEL_R]}); click it there to add the entrance`
            })).concat((list.length > 1)? [back, cancel]: [cancel])
        });
        if (spot === -1) return false;
        if (spot !== -2) break;
    }

    playersData[playerId].hotels[hotel].entrances.push(spot);
    entrancesTaken[spot] = hotel;
    if (cost > 0)
    {
        addMoney(playerId, -cost);
        showPayment(playerId, BANK_ID, cost, `an entrance of ${hotel} Hotel`);
    }
    else
    {
        showStamp('FREE!', 'stamp_free');
        throwConfetti();
        tokenBubble(playerId, `<img src='images/open.png' alt=''> &#x1F601;`);
    }
    showNewEntrance(playerId, hotel, spot, entranceSide(hotel, spot));
    pushNews(`A new entrance for <b>${hotel} Hotel</b>, on space ${spot} (${PLAYERS[playerId]})`, `#ent${spot}${entranceSide(hotel, spot)}`);
    noteAction({
        kind: 'entrance', hotel, spot, side: entranceSide(hotel, spot), amount: -cost, tag: (cost > 0)? undefined: 'FREE',
        text: `opened ${isFirst? 'the 1st entrance': 'an entrance'} of <b>${hotel} Hotel</b> on ${isFirst? 'its starred ': ''}space ${spot}${(cost > 0)? `, for <b>${formatMoney(cost)}</b>`: ', free'}`
    });
    appendStatus(`&#x1F6AA; ${playerString(playerId)} opens ${isFirst? 'the 1st entrance': 'an entrance'} of <b>${hotel} Hotel</b> on ${isFirst? 'its starred ': ''}space ${spot}${(cost > 0)? `, for <span class='money_loss'>${formatMoney(cost)}</span>`: ', free'}.`, 'log_good');
    refresh();
    return true;
}

//After moving (and paying for any stay): the player takes what the space and the hotels offer, in any order, then ends the turn
//@param state ({ again, passedTownhall, actionUsed, entranceBought }) how far the turn has got; kept up to date, as it is saved with the game
async function turnMenu(playerId, state)
{
    const data = playersData[playerId],
        pos = playerPositions[playerId],
        info = ROAD[pos],
        action = info[INDEX_ACTION],
        { again, passedTownhall, entranceBought } = state;
    state.denied = state.denied || {}; //hotels refused planning permission on this space: no more applications for those
    menuState = state;
    if (!state.arrived)
    {
        //just arrived on a space with something free that it cannot use: a long face
        state.arrived = true;
        if ((action === 'e') && (hotelsNeedEntrance(playerId).length <= 0))
        {
            tokenBubble(playerId, `${crossedOut('open')} &#x1F62D;`);
            noteAction({ kind: 'missed', image: 'open', text: 'landed on <b>1 free entrance</b>, with no hotel that could take one' });
        }
        else if ((action === 'p') && (hotelsCanBuild(playerId).length <= 0))
        {
            tokenBubble(playerId, `${crossedOut('build')} &#x1F62D;`);
            noteAction({ kind: 'missed', image: 'build', text: 'landed on <b>Build 1 phase free</b>, with nothing to build' });
        }
    }
    for (;;)
    {
        await settleClaim(); //a computer player caught at a human's hotel pays before it does anything more
        if (!isPlaying(playerId) || forfeit) return;
        const options = [],
            deeds = [];
        if (!state.actionUsed)
        {
            if (action === '$')
            {
                [info[INDEX_HOTEL_L], info[INDEX_HOTEL_R]].forEach((hotel) => {
                    if (!canBuyLand(playerId, hotel)) return;
                    const { price, from } = landPrice(hotel);
                    options.push({
                        id: `buy:${hotel}`,
                        label: `Buy ${hotel} land @ ${formatMoney(price)}${(from !== BANK_ID)? ` from ${PLAYERS[from]}`: ''}`,
                        tip: `Piggybank: ${formatMoney(data.money)}; after buying: ${(data.money >= price)? formatMoney(data.money - price): `${formatMoney(price - data.money)} short`}. `
                            + ((from !== BANK_ID)? 'Compulsory purchase: nothing is built on it yet, so its owner has no say': 'Bought from the Bank'),
                        disabled: data.money < price
                    });
                    deeds.push(hotel);
                });
            }
            else if ((action === 'b') && (hotelsCanApply(playerId, state.denied).length > 0))
            {
                //as often as the player likes, a building at a time or several; until a hotel is refused
                options.push({
                    id: 'build',
                    label: `Apply for planning permission${state.applied? ' again': ''} &#x1F6A7;`,
                    tip: 'Choose what to build, then throw the permission die. You may apply as often as you like; a hotel that is refused is out for this turn'
                });
            }
            else if ((action === 'e') && (hotelsNeedEntrance(playerId).length > 0))
            {
                const takers = hotelsNeedEntrance(playerId);
                options.push({
                    id: 'freeEntrance',
                    label: `Take 1 free entrance${(takers.length === 1)? ` for ${takers[0]} (${entranceCount(takers[0])})`: ''}`,
                    cls: 'button_free_stuff'
                });
            }
            else if ((action === 'p') && (hotelsCanBuild(playerId).length > 0))
            {
                options.push({ id: 'freePhase', label: 'Build 1 phase free', cls: 'button_free_stuff' });
            }
        }
        if (passedTownhall)
        {
            hotelsNeedEntrance(playerId).forEach((hotel) => {
                if (entranceBought[hotel]) return;
                const cost = HOTELS_DATA[hotel].entrance;
                options.push({
                    id: `entrance:${hotel}`,
                    label: `Buy an entrance for ${hotel} (${entranceCount(hotel)}) @ ${formatMoney(cost)}`,
                    cls: 'button_free_stuff',
                    tip: `You passed the Town Hall: 1 entrance for each of your hotels. Piggybank: ${formatMoney(data.money)}; after buying: ${formatMoney(Math.max(0, data.money - cost))}`,
                    disabled: data.money < cost
                });
            });
        }
        hotelsLeisureReady(playerId).forEach((hotel) => {
            const { build } = HOTELS_DATA[hotel],
                cost = build[build.length - 1];
            options.push({
                id: `leisure:${hotel}`,
                label: `Add leisure facilities to ${hotel} @ ${formatMoney(cost)}`,
                tip: 'All buildings are up, so no planning permission is needed',
                disabled: data.money < cost
            });
        });
        if (hotelsOf(playerId).length > 0)
        {
            options.push({ id: 'sell', label: 'Sell a hotel by auction', cls: 'button_minor', tip: 'Sold as 1 lot to the highest bidder. No minimum price!' });
        }
        options.push({ id: 'end', label: again? 'Throw again &#x1F3B2; (you threw a 6)': 'End turn &#x27A1;', cls: 'button_final' });

        const choice = await ask(playerId, {
            kind: 'menu', pos, again, options, deeds,
            text: `on space ${pos} (${ACTION_NAMES[action]}). ${(options.length > 1)? 'What would you like to do?': 'Nothing more to do here.'}`
        });
        const hotel = choice.substring(choice.indexOf(':') + 1);
        if (choice === 'end')
        {
            return;
        }
        if (choice === 'claimed') //caught at a hotel: back to the top, where the fee is settled
        {
            continue;
        }
        if (choice === 'bankrupt') //'Declare Bankrupt' button
        {
            await declareBankruptcy(playerId);
            continue; //out of the loop at its top, if it was gone through with
        }
        if (choice.startsWith('sell:')) //'Sell Hotel' on a title deed
        {
            if (ownedBySelf(hotel, playerId))
            {
                await auction(playerId, hotel);
            }
            continue;
        }
        if (choice.startsWith('buy:'))
        {
            buyLand(playerId, hotel); //the land on the other side of the road may be bought as well
        }
        else if (choice === 'build')
        {
            if (await applyToBuild(playerId, state.denied))
            {
                state.applied = true;
            }
        }
        else if (choice === 'freeEntrance')
        {
            state.actionUsed = await takeEntrance(playerId, undefined, 0);
        }
        else if (choice === 'freePhase')
        {
            state.actionUsed = await takeFreePhase(playerId);
        }
        else if (choice.startsWith('entrance:'))
        {
            entranceBought[hotel] = await takeEntrance(playerId, hotel, HOTELS_DATA[hotel].entrance);
        }
        else if (choice.startsWith('leisure:'))
        {
            const { build } = HOTELS_DATA[hotel],
                cost = build[build.length - 1];
            if (data.money >= cost)
            {
                addMoney(playerId, -cost);
                showPayment(playerId, BANK_ID, cost, `leisure facilities of ${hotel} Hotel`);
                appendStatus(`${playerString(playerId)} pays the Bank <span class='money_loss'>${formatMoney(cost)}</span>.`);
                construct(playerId, hotel, 1, `for ${formatMoney(cost)}`, cost);
            }
        }
        else if (choice === 'sell')
        {
            const list = hotelsOf(playerId),
                sold = await ask(playerId, {
                    kind: 'sellWhich',
                    text: 'Which hotel do you put up for auction? There is no minimum price, and if no one bids it is knocked down!',
                    options: list.map((name) => ({ id: name, label: hotelSummary(name) })).concat([{ id: '', label: 'Back', cls: 'button_final' }]),
                    deeds: list
                });
            if (sold)
            {
                await auction(playerId, sold);
            }
        }
    }
}

////////// Turns //////////

function beginTurn(playerId)
{
    $('td').removeClass('shimmer pulsate');
    $(`#cell_played${playerPositions[playerId]}`).addClass('shimmer');
    const cell = $('#divWho');
    drawWho();
    cell.addClass('pulsate_once');
    setTimeout(() => cell.removeClass('pulsate_once'), 1000);
    appendStatus(`Turn ${turnCount}: ${playerString(playerId)}`, 'log_turn');
    refresh();
    followToken(playerId);
}

/*
A turn of given player, and further ones for as long as a 6 is thrown.
@param resume (object) optional: state of a turn saved while the player was choosing what to do; it goes on from there
*/
async function playTurn(playerId, resume)
{
    if (!resume)
    {
        clearTrail(playerId); //where it went and what it did on its last turn has been on show for a round
        delete stickyBubbles[playerId]; //and it has fumed long enough
        turnActions = [];
        openAction = -1;
        drawTurnActions();
    }
    forfeit = false;
    for (let again = true; again && isPlaying(playerId) && (playingIds().length > 1); )
    {
        let state = resume;
        resume = undefined;
        if (state)
        {
            beginTurn(playerId);
        }
        else
        {
            ++turnCount;
            saveGame();
            beginTurn(playerId);
            drawAhead(playerId); //what the next 6 spaces hold: on show from before the throw until the car has got to where it goes
            if (skipRollAsk) //the die has been clicked already, to throw again after a 6
            {
                skipRollAsk = false;
            }
            else
            {
                await ask(playerId, {
                    kind: 'roll',
                    text: 'Throw the die to move.',
                    options: [{ id: 'roll', label: 'Throw the die &#x1F3B2;' }]
                });
            }
            const val = await rollDie(diceOne);
            appendStatus(`${playerString(playerId)} throws a <b>${val}</b>.`);
            noteAction({ kind: 'roll', val, text: `threw a <b>${val}</b>${(val === 6)? ': another turn after this one': ''}` });
            const passedTownhall = await driveToken(playerId, val);
            clearAhead();
            drawWho();
            await settleStay(playerId);
            if (!isPlaying(playerId) || forfeit || (playingIds().length <= 1)) return;
            state = { again: (val === 6), passedTownhall, actionUsed: false, entranceBought: {} };
        }
        await turnMenu(playerId, state);
        again = state.again;
        menuState = null;
        if (forfeit) //declared bankrupt: the turn is over, whatever was thrown
        {
            dropClaim();
            return;
        }
        if (aiLevel(playerId))
        {
            await aiTurnEnd(playerId, again);
        }
        dropClaim();
        await breathe();
    }
}

function advancePlayer()
{
    do
    {
        who = (who + 1) % PLAYERS.length;
    } while (!isPlaying(who));
}

//@return whether the game is over: only 1 player left
function declareWinner()
{
    const left = playingIds();
    if (left.length > 1) return false;
    endGame(left[0], 'is the last Hotel Tycoon standing');
    return true;
}

//The game is over. winnerId: who has won (or undefined: no one is left); how: in what way, in words
function endGame(winnerId, how)
{
    ++gameRun; //whatever was going on is dropped
    gameOver = true;
    pendingAsk = null;
    pendingClaim = null;
    clearPrompt();
    clearAhead();
    localStorage.removeItem('savedGameHotels');
    if (winnerId !== undefined)
    {
        who = winnerId;
        $('#divWho')[0].innerHTML = `&#x1F3C6; ${playerString(who)} wins!`;
        appendStatus(`<h2>&#x1F3C6; ${playerString(who)} ${how}, and wins with ${formatMoney(playersData[who].money)} and ${hotelsOf(who).length} hotel(s)!</h2>`, 'log_good');
        $('#divPrompt')[0].innerHTML = `<button class='button_final' onclick='newGameBoard();'>New Game</button>`;
        throwConfetti();
    }
    refresh();
}

/*
What given player is worth: cash, and what its hotels cost to set up (land, buildings with leisure facilities, entrances).
@return ({ cash, land, buildings, entrances, total })
*/
function netWorth(playerId)
{
    const data = playersData[playerId],
        worth = { cash: data.money, land: 0, buildings: 0, entrances: 0 };
    hotelsOf(playerId).forEach((hotel) => {
        const live = data.hotels[hotel];
        worth.land += HOTELS_DATA[hotel].land;
        worth.buildings += buildCost(hotel, 0, live.built);
        worth.entrances += live.entrances.length * HOTELS_DATA[hotel].entrance;
    });
    worth.total = worth.cash + worth.land + worth.buildings + worth.entrances;
    return worth;
}

//Everyone in the game by net worth, richest first: [{ playerId, worth }]
function ranking()
{
    return PLAYERS.map((name, playerId) => playerId)
        .filter((playerId) => !ignoredPlayers[playerId])
        .map((playerId) => ({ playerId, worth: netWorth(playerId) }))
        .sort((a, b) => (Number(isPlaying(b.playerId)) - Number(isPlaying(a.playerId))) || (b.worth.total - a.worth.total));
}

function balanceSheetHtml()
{
    const rows = ranking(),
        most = Math.max(1, ...rows.map((row) => row.worth.total)),
        parts = [['cash', 'Cash'], ['land', 'Land'], ['buildings', 'Buildings and facilities'], ['entrances', 'Entrances']],
        leader = rows[0],
        tie = rows.filter((row) => isPlaying(row.playerId) && (row.worth.total === leader.worth.total)).length > 1;
    let s = `<div class='sheet'>
        <div class='sheet_key'>${parts.map(([key, label]) => `<span class='sheet_part sheet_${key}'></span> ${label}`).join(' &nbsp; ')}</div>
        <table class='sheet_table'><tr><th></th><th>Tycoon</th>${parts.map(([key, label]) => `<th>${label}</th>`).join('')}<th>Net worth</th><th></th></tr>`;
    rows.forEach((row, i) => {
        const { worth, playerId } = row,
            out = !isPlaying(playerId);
        s += `<tr class='${out? 'balance_out': ''}'>
            <td>${out? '': i + 1}</td><td>${playerString(playerId)}</td>
            ${parts.map(([key]) => `<td class='sheet_number'>${formatMoney(worth[key])}</td>`).join('')}
            <td class='sheet_number'><b>${out? 'bankrupt': formatMoney(worth.total)}</b></td>
            <td class='sheet_bar'>${out? '': parts.map(([key, label]) =>
                `<span class='sheet_part sheet_${key}' title='${label}: ${formatMoney(worth[key])}' style='width: ${(300 * worth[key] / most).toFixed(1)}px;'></span>`).join('')}</td></tr>`;
    });
    s += `</table>
        <div class='sheet_note'>Hotels are counted at what they cost to set up. This shows everyone's cash, which the Tycoons table keeps hidden.</div>`;
    if (!gameOver && !demoMode && (playingIds().length > 1))
    {
        s += sheetConfirm?
            `<div class='sheet_end'>End the game now, with <b>${PLAYERS[leader.playerId]}</b> as the winner${tie? ' (it is a tie at the top: the first listed)': ''}?
                <button class='button_free_stuff' onclick='declareRichest();'>Yes, end it</button>
                <button class='button_final' onclick='sheetConfirm = false; showBalanceSheet();'>No, play on</button></div>`:
            `<div class='sheet_end'><span data-tooltip-position='top' data-tooltip='End the game by agreement: the tycoon with the highest net worth wins'>
                <button onclick='sheetConfirm = true; showBalanceSheet();'>&#x1F3C6; Declare winner: ${PLAYERS[leader.playerId]}</button></span></div>`;
    }
    return s + '</div>';
}

//'Balance sheet' button: popup with everyone's net worth, and a way to end the game by it
function showBalanceSheet()
{
    const html = balanceSheetHtml();
    if (!popupSheet)
    {
        popupSheet = new WinBox({
            title: 'Balance sheet',
            index: POPUP_INDEX,
            x: 'center', y: '290px', width: '1120px', height: '420px',
            html,
            onclose: function() {
                sheetConfirm = false;
                this.minimize();
                return true;
            }
        });
    }
    else
    {
        popupSheet.body.innerHTML = html;
        popupSheet.restore();
        popupSheet.focus();
    }
}

//'Yes, end it' in the balance sheet: the game ends by agreement, and the richest wins
function declareRichest()
{
    sheetConfirm = false;
    if (gameOver || demoMode || (playingIds().length < 2)) return;
    const leader = ranking()[0];
    appendStatus(`The game is ended by agreement. Net worth: ${ranking().filter((row) => isPlaying(row.playerId))
        .map((row) => `${PLAYERS[row.playerId]} ${formatMoney(row.worth.total)}`).join(', ')}.`, 'log_auction');
    revealCash = true;
    endGame(leader.playerId, `has the highest net worth, ${formatMoney(leader.worth.total)}`);
    showBalanceSheet();
}

//@param resume (object) optional: see playTurn()
async function runGame(resume)
{
    const run = gameRun;
    while ((run === gameRun) && !gameOver)
    {
        await playTurn(who, resume);
        resume = undefined;
        if (run !== gameRun) return;
        if (declareWinner()) return;
        advancePlayer();
        await breathe();
    }
}

//'End turn' as a button of its own, next to the dice
function nextPlayer()
{
    const q = pendingAsk;
    if (q && (q.kind === 'review')) //a computer player's turn, waiting to be looked over
    {
        q.resolve('next');
        return;
    }
    if (!q || (q.kind !== 'menu') || aiLevel(q.playerId)) return;
    q.resolve('end');
}

function throwConfetti()
{
    if (FLOAT_MS <= 0) return;
    const div = $(`<div class='confetti'></div>`),
        colours = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'];
    for (let i = 0; i < 80; ++i)
    {
        div.append(`<span style='left: ${randInt(100)}%; background: ${colours[i % colours.length]};
            animation-delay: ${randInt(1500)}ms; --dx: ${randInt(300) - 150}px; --turn: ${randInt(1440) - 720}deg;'></span>`);
    }
    $('body').append(div);
    setTimeout(() => div.remove(), 6000);
}

////////// Drawing //////////

//What a stay costs at given hotel as it stands, in plain text: shown when the mouse is over its buildings
function ratesTip(hotel)
{
    const live = hotelOf(hotel),
        data = HOTELS_DATA[hotel],
        fees = data.rent[live.built - 1].map((fee, i) => `${i + 1}: ${formatMoney(fee)}`);
    return `${hotel} Hotel, ${'★'.repeat(starRating(hotel, live.built))} (${PLAYERS[owner(hotel)]})&#10;`
        + `Stay, by nights:&#10;${fees.slice(0, 3).join('   ')}&#10;${fees.slice(3).join('   ')}&#10;`
        + `${live.entrances.length} of ${data.maxEntrances} entrances`;
}

//Hotel names, 'sold' signs, buildings and entrances on the map, from the state of the game
function drawHotels()
{
    let s = '',
        vivid = '';
    /*
    The map starts out pale (#divPale washes its colours out); where something is built, its full colours come back:
    rings of the map as it is, one inside the other and stronger towards the middle, so that the colour fades in softly.
    The more a hotel is built up, the more of its land is in colour.
    */
    const bloom = (x, y, size) => {
        VIVID_RINGS.forEach(([radius, opacity]) => {
            const r = radius * size;
            vivid += `<div class='vivid_ring' style='left: ${x - r}px; top: ${y - r}px; width: ${2 * r}px; height: ${2 * r}px;
                opacity: ${opacity}; background-position: ${r - x}px ${r - y}px;'></div>`;
        });
    };
    Object.keys(PLACES).forEach((name) => {
        const place = PLACES[name],
            [x, y] = place.plot,
            art = buildingArt(place, 0, BUILDING_SCALE);
        bloom(x, y, 0.7);
        s += `<div class='hotel_label place_label' data-place='${name}' style='left: ${place.label[0]}px; top: ${place.label[1]}px;'>${name}</div>
            <div class='building' data-place='${name}' style='left: ${x}px; top: ${y}px; z-index: ${10 + ((y / 10) | 0)};'>
                <div class='building_art' title='${name}' style='left: ${art.left}px; top: ${art.top}px;'>${art.svg}</div></div>`;
    });
    Object.keys(HOTEL_SITES).forEach((hotel) => {
        const site = HOTEL_SITES[hotel],
            data = HOTELS_DATA[hotel],
            ownerId = owner(hotel),
            live = hotelOf(hotel),
            built = live? live.built: 0,
            shown = shownBuilt[hotel] || 0;
        //coloured as in the Tycoons table: white for bare (or no one's) land, orange once built, green once it has an entrance
        s += `<div class='hotel_label ${(built <= 0)? '': ((live.entrances.length > 0)? 'balance_open': 'balance_built')}' style='left: ${site.label[0]}px; top: ${site.label[1]}px; border-color: ${site.colour};' data-hotel='${hotel}' onclick='labelClicked("${hotel}");'
                title='${(built > 0)? `A stay costs from ${formatMoney(data.rent[built - 1][0])} (1 night) to ${formatMoney(data.rent[built - 1][5])} (6 nights)`: `Bare land: nothing to pay here. Land costs ${formatMoney(data.land)}`}'>
                ${hotel}${(built > 0)? ` ${stars(starRating(hotel, built))}`: ''}<br>
                <small>${(ownerId >= 0)? playerString(ownerId): ''}${(built <= 0)? ` land ${formatMoney(data.land)}`: ''}</small>
            </div>`;
        if ((ownerId >= 0) && (built <= 0))
        {
            const [x, y] = site.plots[0];
            s += `<div class='land_sign' style='left: ${x}px; top: ${y}px; z-index: ${10 + ((y / 10) | 0)};'>
                    <div class='land_sign_board' style='border-color: ${PLAYER_COLORS[ownerId]};'>${tokenIcon(ownerId)}SOLD</div>
                </div>`;
        }
        for (let phase = 0; phase < built; ++phase)
        {
            const [x, y] = site.plots[phase],
                isLeisure = (phase === data.build.length - 1),
                //bloomed = site.outline? undefined: bloom(x, y, 1), //a hotel whose land has been traced gets its land in colour instead
                bloomed = ((site.outline) && (built >= data.build.length))? undefined: bloom(x, y, 1),
                //a building's size and turn (site.sizes, site.turn) are seen to by buildingArt(); leisure facilities take the size only
                scale = BUILDING_SCALE * 0.8 * ((site.sizes && (typeof site.sizes[phase] === 'number'))? site.sizes[phase]: 1),
                art = isLeisure? { svg: leisureSvg(scale, site.leisure), left: -42 * scale, top: -26 * scale }:
                    buildingArt(site, phase, BUILDING_SCALE),
                flag = (phase === 0)? `<div class='building_flag' style='background: ${PLAYER_COLORS[ownerId]};'></div>`: '',
                key = `${hotel}:${phase}`;
            //a new one goes up for all to see: a bulldozer at work on the plot, then the building drops into place and
            //squashes down in a cloud of dust. The map may be drawn again meanwhile; --t carries on from where that had got to
            if (phase >= shown)
            {
                buildStarted[key] = Date.now();
            }
            const elapsed = Date.now() - (buildStarted[key] || 0),
                going = (BUILD_MS > 0) && (elapsed < BUILD_MS),
                works = going? `<img class='build_dozer' src='images/build.png' alt=''><div class='build_dust'><span></span><span></span><span></span></div>`: '';
            //the element itself is a point at the plot (the centre of the footprint, on the ground); the picture hangs off it
            s += `<div class='building ${isLeisure? 'building_leisure': ''} ${going? 'building_new': ''}' data-hotel='${hotel}' data-phase='${phase}'
                    style='left: ${x}px; top: ${y}px; z-index: ${10 + ((y / 10) | 0)}; --t: ${-elapsed}ms; --build: ${BUILD_MS}ms;'>
                    <div class='building_art' title='${ratesTip(hotel)}' style='left: ${art.left}px; top: ${art.top}px;'>${flag}${art.svg}</div>${works}</div>`;
        }
        /*if (site.outline && (built > 0))
        {
            //the whole of its land, within the outline traced on the demo page: half in colour with the main building, all once complete
            vivid += `<div class='vivid_land' data-hotel='${hotel}' style='opacity: ${(0.5 + (0.5 * built / data.build.length)).toFixed(2)};
                clip-path: polygon(${site.outline.map((p) => `${p[0]}px ${p[1]}px`).join(', ')});'></div>`;
        }
        */
        if (site.outline && (built >= data.build.length))
        {
            //all of hotel's outlined land is completely lit only when all (include facilities) is complete;
            //else only spotlights on the buildings
            vivid += `<div class='vivid_land' data-hotel='${hotel}' style='opacity: 1;
                clip-path: polygon(${site.outline.map((p) => `${p[0]}px ${p[1]}px`).join(', ')});'></div>`;
        }
        shownBuilt[hotel] = built;
    });

    //all public roads and places
    vivid += `<div class='vivid_land' style='opacity: 1;
        clip-path: polygon(${ROAD_OUTLINE.map((p) => `${p[0]}px ${p[1]}px`).join(', ')});'></div>`;

    $('#divBuildings')[0].innerHTML = s;
    $('#divVivid')[0].innerHTML = PALE_MAP? vivid: '';
    $('#divPlayingArea').toggleClass('pale_map', PALE_MAP);

    $('.cell_entrance').each((i, slot) => {
        const spot = parseInt(slot.getAttribute('data-spot'), 10),
            hotel = slot.getAttribute('data-hotel'),
            //demo page: every spot of every hotel shows as an entrance, both sides of the road at once (which no game
            //allows), so that each can be seen and dragged into place
            has = demoMode? isOwned(hotel): ((entrancesTaken[spot] === hotel) && isOwned(hotel)),
            had = slot.classList.contains('entrance_built');
        //a bought entrance fills its whole spot, yellow edged in blue whoever owns it: that shows up best on the map
        //(.entrance_built in hotels.css); its owner is told by the ring round the door on it, and by this tip
        slot.title = has? `Entrance of ${hotel} Hotel (${PLAYERS[owner(hotel)]}): a stay is due from whoever stops on this space`: '';
        if (has === had)
        {
            if (has) slot.firstElementChild.style.borderColor = PLAYER_COLORS[owner(hotel)]; //may have changed hands
            return;
        }
        slot.classList.toggle('entrance_built', has);
        //the door, upright whatever way the spot is turned; and on a hotel's starred spot a star at one end,
        //as the entrance covers the star that is on the map
        const upright = `transform: rotate(${-Number(slot.getAttribute('data-angle'))}deg);`,
            star = (HOTELS_DATA[hotel].entrances[0] === spot)? `<img class='entrance_star' src='images/star.png' alt='starred spot' style='${upright}'>`: '';
        slot.innerHTML = has? `<img class='entrance_icon' src='images/open.png' alt='entrance'
            style='${upright} border-color: ${PLAYER_COLORS[owner(hotel)]};'>${star}`: '';
    });
}

function cashHtml(amount)
{
    const notes = notesFor(amount);
    let s = '',
        tilt = -14;
    NOTES.forEach((value) => {
        const count = notes[value];
        if (count <= 0) return;
        let stack = '';
        for (let i = 0; i < Math.min(count, 5); ++i)
        {
            stack += `<img src='images/note-${value}.svg' alt='${value}' style='left: ${i * 5}px; top: ${i * 4}px;'>`;
        }
        s += `<div class='cash_stack' style='transform: rotate(${tilt}deg);'>${stack}<span class='cash_count'>&times;${count}</span></div>`;
        tilt += 7;
    });
    return `<div class='cash_fan'>${s || '<i>no cash</i>'}</div>`;
}

//Small title deed, for the assets panel
function miniDeedHtml(hotel)
{
    const live = hotelOf(hotel),
        data = HOTELS_DATA[hotel],
        count = data.build.length,
        rating = starRating(hotel, live.built);
    let pips = '';
    for (let i = 0; i < count; ++i)
    {
        pips += `<span class='deed_pip ${(i < live.built)? 'deed_pip_on': ''} ${(i === count - 1)? 'deed_pip_leisure': ''}'></span>`;
    }
    return `<div class='deed_mini' style='border-color: ${HOTEL_SITES[hotel].colour};' onclick='showDeeds("${hotel}", ${owner(hotel)});'>
            <div class='deed_mini_title' style='background: ${HOTEL_SITES[hotel].colour};'>${hotel}</div>
            <div>${pips}</div>
            <div>${(rating > 0)? stars(rating): 'bare land'}</div>
            <div>&#x1F6AA; ${live.entrances.length}/${data.maxEntrances}</div>
            <div>${(rating > 0)? `${formatMoney(data.rent[live.built - 1][0])}/night`: '&nbsp;'}</div>
        </div>`;
}

//Full title deed of a hotel, with what is built ticked off
//@param withSell (bool) with a button to sell the hotel
function deedHtml(hotel, withSell)
{
    const data = HOTELS_DATA[hotel],
        ownerId = owner(hotel),
        live = hotelOf(hotel),
        built = live? live.built: 0;
    let rows = '';
    data.build.forEach((cost, i) => {
        rows += `<tr class='${(i < built)? 'deed_done': ''}'>
            <td>${(i < built)? '&#x2714;': ''}</td>
            <td class='deed_phase'>${phaseName(hotel, i)}</td>
            <td>${formatMoney(cost)}</td>
            <td>${stars(data.ratings[i])}</td>
            ${data.rent[i].map((fee) => `<td>${fee}</td>`).join('')}</tr>`;
    });
    return `<div class='deed' style='border-color: ${HOTEL_SITES[hotel].colour};'>
        <div class='deed_title' style='background: ${HOTEL_SITES[hotel].colour};'>${hotel} Hotel</div>
        <div class='deed_owner'>Title Deed &middot; ${(ownerId >= 0)? `owner: ${playerString(ownerId)}`: 'for sale by the Bank'}</div>
        <table class='deed_costs'>
            <tr><td>Cost of the land</td><td>${formatMoney(data.land)}</td>
                <td>Compulsory purchase</td><td>${formatMoney(HALF_PRICE_COMPULSORY? data.land / 2: data.land)}</td></tr>
            <tr><td>Each entrance</td><td>${formatMoney(data.entrance)}</td>
                <td>Entrances</td><td>${live? live.entrances.length: 0} of ${data.maxEntrances}</td></tr>
        </table>
        <table class='deed_table'>
            <tr><th></th><th>Build</th><th>Cost</th><th>Rating</th><th colspan='6'>Hotel stay, for 1 to 6 nights</th></tr>
            ${rows}
        </table>
        ${withSell? `<div class='deed_sell'><span data-tooltip='To raise money. The whole hotel goes to the highest bidder: no minimum price, and if no one bids it is knocked down!' data-tooltip-position='top'>
            <button class='button_final' onclick='sellFromDeed("${hotel}");'>Sell Hotel (auction)</button></span></div>`: ''}</div>`;
}

//'Sell Hotel' on a title deed in its owner's popup: a way to raise money, e.g. to buy other land
function sellFromDeed(hotel)
{
    const q = pendingAsk,
        ownerId = owner(hotel);
    if (!q || (q.kind !== 'menu') || (q.playerId !== ownerId) || aiLevel(ownerId))
    {
        appendStatus('A hotel can be sold by its owner on their own turn, after moving: when choosing what to do on the space.', 'log_bad');
        return;
    }
    if (popupMyDeeds) popupMyDeeds.minimize();
    q.resolve(`sell:${hotel}`);
}

//A hotel's name on the map has been clicked
function labelClicked(hotel)
{
    if (Date.now() - lastDragged < 400) return; //that was the end of a drag, on the demo page
    showDeeds(hotel);
}

//Demo page: buildings and hotel names can be dragged to where they belong; the numbers to put in board.js are printed
/*
Demo page: tracing the outline of a hotel's land, for the pale map to bring back the colour of just that land.
'Trace land of' starts it: buildings and road spaces go, the map shows in full colour, and every click on it adds a corner.
'Done' closes the outline, keeps it for this page, and prints its line for HOTEL_SITES in board.js.
*/
function drawTraceBar()
{
    const span = $('#spanTrace')[0];
    if (!span) return;
    span.innerHTML = trace?
        `<span class='trace_bar'>Tracing <b>${trace.hotel}</b>: click round the edge of its land, corner by corner (${trace.points.length} so far).
            <button onclick='traceUndo();' ${trace.points.length? '': 'disabled'}>Undo</button>
            <button class='button_free_stuff' onclick='traceDone();' ${(trace.points.length >= 3)? '': 'disabled'}>Done</button>
            <button class='button_final' onclick='traceCancel();'>Cancel</button></span>`:
        `<select id='selTrace'>${Object.keys(HOTEL_SITES).map((hotel) => `<option value='${hotel}'>${hotel}${HOTEL_SITES[hotel].outline? ' (traced)': ''}</option>`).join('')}</select>
            <button onclick='traceStart();'>Trace land outline</button>`;
    $('#divPlayingArea').toggleClass('tracing', !!trace);
    //outlines already there, thin; and the one being traced, with its corners
    let s = '';
    Object.keys(HOTEL_SITES).forEach((hotel) => {
        const { outline, colour } = HOTEL_SITES[hotel];
        if (outline && demoMode && !(trace && (trace.hotel === hotel)))
        {
            s += `<polygon points='${outline.map((p) => p.join(',')).join(' ')}' fill='none' stroke='#000' stroke-width='5'/>
                <polygon points='${outline.map((p) => p.join(',')).join(' ')}' fill='none' stroke='${colour}' stroke-width='3' stroke-dasharray='10 6'/>`;
        }
    });
    if (trace)
    {
        s += `<polyline points='${trace.points.map((p) => p.join(',')).join(' ')}' fill='#ffff0044' stroke='#000' stroke-width='3'/>`
            + trace.points.map((p, i) => `<circle cx='${p[0]}' cy='${p[1]}' r='${(i === 0)? 9: 6}' fill='${(i === 0)? '#00e676': '#ffea00'}' stroke='#000' stroke-width='2'/>`).join('');
    }
    $('#svgTrace')[0].innerHTML = s;
}

function traceStart()
{
    trace = { hotel: $('#selTrace')[0].value, points: [] };
    drawTraceBar();
}

function traceUndo()
{
    trace.points.pop();
    drawTraceBar();
}

function traceCancel()
{
    trace = null;
    drawTraceBar();
}

function traceDone()
{
    const { hotel, points } = trace;
    if (points.length < 3) return;
    HOTEL_SITES[hotel].outline = points;
    trace = null;
    appendStatus(`Outline of the land of <b>${hotel}</b>, for its entry in HOTEL_SITES in board.js:<br>
        <b class='log_changed'>outline: [${points.map((p) => `[${p.join(', ')}]`).join(', ')}],</b>`, 'log_info');
    refresh();
    drawTraceBar();
}

function setupDemoDrag()
{
    let drag = null;
    //(not about dragging) tracing a land's outline: a click on the map adds a corner
    $('#divPlayingArea').on('click', (e) => {
        if (!trace) return;
        const at = $('#divPlayingArea').offset();
        trace.points.push([Math.round(e.pageX - at.left), Math.round(e.pageY - at.top)]);
        drawTraceBar();
    });
    //(not about dragging) a wobbling building or a sparkling entrance of a hotel with a guest: a click claims the fee
    $('#divPlayingArea').on('click', '.building_wobble, .entrance_visited', (e) => {
        if (Date.now() - lastDragged < 400) return;
        bellClicked(e, Number(e.currentTarget.getAttribute('data-claim')));
    });
    $('#divPlayingArea').on('mousedown', '.building_art, .hotel_label, .cell_entrance', (e) => {
        if (!demoMode) return;
        const el = e.currentTarget.classList.contains('building_art')? e.currentTarget.parentNode: e.currentTarget;
        drag = { el, x: e.pageX, y: e.pageY, left: parseFloat(el.style.left), top: parseFloat(el.style.top), moved: false };
        e.preventDefault();
    });
    $(document).on('mousemove', (e) => {
        if (!drag) return;
        drag.moved = true;
        drag.el.style.left = `${drag.left + e.pageX - drag.x}px`;
        drag.el.style.top = `${drag.top + e.pageY - drag.y}px`;
    });
    $(document).on('mouseup', () => {
        const done = drag;
        drag = null;
        if (!done || !done.moved) return;
        const hotel = done.el.getAttribute('data-hotel'),
            place = done.el.getAttribute('data-place'),
            xy = [Math.round(parseFloat(done.el.style.left)), Math.round(parseFloat(done.el.style.top))];
        lastDragged = Date.now();
        if (done.el.classList.contains('cell_entrance'))
        {
            const key = `${done.el.getAttribute('data-spot')}${done.el.getAttribute('data-side')}`;
            ENTRANCE_SPOTS[key] = xy.concat((ENTRANCE_SPOTS[key] || []).slice(2));
            appendStatus(`Entrance spot of <b>${hotel}</b> at space ${done.el.getAttribute('data-spot')}, for ENTRANCE_SPOTS in board.js:<br>
                <b class='log_changed'>'${key}': [${ENTRANCE_SPOTS[key].join(', ')}],</b>
                <br>(a 3rd number turns it: it is at ${done.el.getAttribute('data-angle')} degrees now)`, 'log_info');
            return;
        }
        if (place)
        {
            PLACES[place][done.el.classList.contains('hotel_label')? 'label': 'plot'] = xy;
            appendStatus(`<b>${place}</b> (in PLACES): label: [${PLACES[place].label.join(', ')}], plot: [${PLACES[place].plot.join(', ')}],`, 'log_info');
            return;
        }
        if (done.el.classList.contains('hotel_label'))
        {
            HOTEL_SITES[hotel].label = xy;
            printSites(hotel, 'label');
            return;
        }
        const phase = Number(done.el.getAttribute('data-phase'));
        HOTEL_SITES[hotel].plots[phase] = xy;
        printSites(hotel, phase);
    });
}

/*
Print the positions of given hotel (or of all) in the History window, as they go into HOTEL_SITES in board.js.
@param changed 'label', or the number of a plot: what has just been moved, to be shown in bold
*/
function printSites(hotel, changed)
{
    const bold = (s, isIt) => isIt? `<b class='log_changed'>${s}</b>`: s;
    (hotel? [hotel]: Object.keys(HOTEL_SITES)).forEach((name) => {
        const site = HOTEL_SITES[name];
        appendStatus(`<b>${name}</b>: label: ${bold(`[${site.label.join(', ')}]`, changed === 'label')},<br>
            plots: [${site.plots.map((p, i) => bold(`[${p.join(', ')}]`, changed === i)).join(', ')}],`, 'log_info');
    });
}

/*
Popup with title deeds, given hotel's first.
@param playerId (int) optional: only the deeds of this player, in a popup of their own; else all 8, whoever owns them
*/
function showDeeds(hotel, playerId)
{
    const mine = (playerId !== undefined),
        names = mine? hotelsOf(playerId): Object.keys(HOTELS_DATA),
        order = hotel? [hotel].concat(names.filter((name) => name !== hotel)): names,
        html = `<div class='deeds_popup'>${order.map((name) => deedHtml(name, mine)).join('') || '<i>no title deeds yet</i>'}</div>`,
        title = mine? `Title Deeds of ${PLAYERS[playerId]}`: 'All Title Deeds';
    let popup = mine? popupMyDeeds: popupDeeds;
    if (!popup)
    {
        popup = new WinBox({
            title,
            index: POPUP_INDEX,
            x: mine? 'right': 'center', y: '280px', width: '640px', height: `${Math.max(300, window.innerHeight - 320)}px`,
            html,
            onclose: function() {
                this.minimize();
                return true;
            }
        });
        if (mine) popupMyDeeds = popup; else popupDeeds = popup;
    }
    else
    {
        popup.setTitle(title);
        popup.body.innerHTML = html;
        popup.restore();
        popup.focus();
    }
    popup.body.scrollTop = 0;
}

//The status printout lives in a popup of its own, at the right of the screen
function showHistory()
{
    if (!popupHistory)
    {
        popupHistory = new WinBox({
            title: 'History',
            index: POPUP_INDEX,
            x: 'right', y: '300px', width: '440px', height: `${Math.max(200, Math.min(340, window.innerHeight - 320))}px`,
            mount: $('#divStatus')[0],
            onclose: function() {
                this.minimize();
                return true;
            }
        });
    }
    else
    {
        popupHistory.restore();
        popupHistory.focus();
    }
}

//'Save' button: the game is saved at the start of every turn anyway; this also keeps how far the current turn has got
function saveNow()
{
    const q = pendingAsk;
    if (demoMode || gameOver) return;
    if (!q || (q.playerId !== who) || ((q.kind !== 'roll') && (q.kind !== 'menu')))
    {
        appendStatus('Cannot save in the middle of this. Save before the throw, or when choosing what to do on a space.', 'log_bad');
        return;
    }
    saveGame();
    appendStatus('&#x1F4BE; Game saved.', 'log_good');
}

//Top right: cash and title deeds of the current player
function drawAssets()
{
    const data = playersData[who],
        hotels = hotelsOf(who),
        shown = cashShown(who);
    $('#divMyAssets')[0].innerHTML = `<div class='assets_title'>${playerString(who)}: <b>${shown? formatMoney(data.money): 'cash kept to itself'}</b></div>
        ${shown? cashHtml(data.money): `<div class='cash_fan'><i>&#x1F4BC; a computer player does not show its cash</i></div>`}
        <div class='deeds_row'>${hotels.map((hotel) => miniDeedHtml(hotel)).join('') || '<i>no title deeds yet</i>'}</div>`;
}

/*
Whether the page shows how much cash given player has. Players are not to know one another's solvency:
only that of the player whose turn it is shows, a computer player's too. 'Reveal' (for debugging) shows all.
*/
function cashShown(playerId)
{
    return revealCash || (playerId === who);
}

function toggleRevealCash()
{
    revealCash = !revealCash;
    refresh();
}

//Bottom: everyone's hotels, and the cash of those who may show it
function printBalances()
{
    let s = `<table class="balances"><tr><th>Tycoon</th>
        <th>Cash <button class='button_minor button_small' onclick='toggleRevealCash();'>${revealCash? 'Hide': 'Reveal'}</button></th>
        <th>Hotels: rating, phases built, entrances.
            <span class='balance_hotel'>bare land</span> <span class='balance_hotel balance_built'>built, no entrance</span> <span class='balance_hotel balance_open'>has an entrance</span></th></tr>`;
    PLAYERS.forEach((name, i) => {
        if (ignoredPlayers[i]) return;
        const data = playersData[i],
            level = aiLevel(i),
            hotels = hotelsOf(i).map((hotel) => {
                const live = data.hotels[hotel],
                    state = (live.built <= 0)? '': ((live.entrances.length > 0)? 'balance_open': 'balance_built');
                return `<span class='balance_hotel ${state}' style='border-color: ${HOTEL_SITES[hotel].colour};' onclick='showDeeds("${hotel}", ${i});'>${hotelSummary(hotel)}</span>`;
            });
        s += `<tr id='balance${i}' class='${data.out? 'balance_out': ''} ${(i === who)? 'balance_who': ''}'>
            <td>${playerString(i)}${level? ` <small>&#x1F916; ${AI_LEVELS[level]}</small>`: ''}</td>
            <td>${data.out? 'bankrupt': (cashShown(i)? formatMoney(data.money): '&#x1F4BC; ?')}</td>
            <td>${hotels.join(' ') || '-'}</td></tr>`;
    });
    $('#divBalances')[0].innerHTML = s + '</table>';
}

function refresh()
{
    drawHotels();
    drawTokenMarks(); //after the hotels: it marks buildings and entrances that were just drawn
    drawAssets();
    printBalances();
    if (popupSheet && !popupSheet.min) //the balance sheet, if it is open, keeps up
    {
        popupSheet.body.innerHTML = balanceSheetHtml();
    }
}

//Draw the road spaces, entrance spots and car park (once per game)
function drawBoard()
{
    let s = `<div id='divPale'></div><div id='divVivid'></div><div id='divBuildings'></div><div id='divTrail'></div><div id='divAhead'></div>
        <svg id='svgTrace' width='${HOTEL_MAP_SIZE[0]}' height='${HOTEL_MAP_SIZE[1]}'></svg>`;
    ROAD.forEach((info, i) => {
        const x = info[0] - 40,
            y = info[1] - 40,
            angle = info[INDEX_ANGLE],
            rad = (angle + 90) * Math.PI / 180,
            //distances of the entrance spots from the road, as tuned by hand for each stretch of it
            gapL = ((i > 15) || (i <= 3))? 50: 80,
            gapR = ((i >= 4) && (i <= 15))? 40: ((info[INDEX_ENTRANCE_L] !== 0)? 50: 80);
        s += `<div id='cell${i}_container' class='cell_container' onclick='cellClicked(${i});' style='left: ${x}px; top: ${y}px;'>
                <table class='cell'><tr><td id='cell${i}' class='cell'>
                    <table class='cell'><tr><td id='cell_played${i}' class='cell'></td></tr></table>
                </td></tr></table>
            </div>`;
        [['L', INDEX_HOTEL_L, gapL], ['R', INDEX_HOTEL_R, -gapR]].forEach(([side, hotelAt, gap]) => {
            const hotel = info[hotelAt];
            if (!isHotel(hotel) || (HOTELS_DATA[hotel].entrances.indexOf(i) < 0)) return;
            //where it goes is worked out from the road space, unless ENTRANCE_SPOTS in board.js says otherwise: [left, top, angle]
            const at = ENTRANCE_SPOTS[`${i}${side}`] || [],
                left = (at[0] !== undefined)? at[0]: Math.round(x + (gap * Math.cos(rad))),
                top = (at[1] !== undefined)? at[1]: Math.round(y + (gap * Math.sin(rad))),
                turned = (at[2] !== undefined)? at[2]: angle;
            s += `<div id='ent${i}${side}' class='cell_container cell_entrance cell_entrance${side}' data-spot='${i}' data-hotel='${hotel}' data-side='${side}' data-angle='${turned}'
                    onclick='entranceClicked(${i}, "${side}");'
                    style='left: ${left}px; top: ${top}px; transform: rotate(${turned}deg);'></div>`;
        });
    });

    //car park: where the cars wait for their 1st move
    const x0 = START_AREA[0] - CELL_WIDTH;
    let y0 = START_AREA[1] - (2.5 * CELL_WIDTH);
    for (let i = 0, col = 0; col < 2; ++col)
    {
        for (let row = 0; (row < 5) && (i < PLAYERS.length); ++row, ++i)
        {
            const left = x0 + (col * CELL_WIDTH),
                top = y0 + (row * CELL_WIDTH),
                cellId = `_s${i}`;
            startXY[i] = [left + 40, top + 40];
            s += `<div id='cell${cellId}_container' class='cell cell_container_start cell_player_starter_${i}' style='left: ${left}px; top: ${top}px;'>
                    <table class='cell'><tr><td id='cell${cellId}' class='cell'>
                        <table class='cell'><tr><td id='cell_played${cellId}' class='cell'></td></tr></table>
                    </td></tr></table>
                </div>`;
        }
        y0 += 0.5 * CELL_WIDTH;
    }
    $('#divPlayingArea')[0].innerHTML = s;
}

//A road space has been clicked: tell what it is
function cellClicked(spot)
{
    //a token with a bell on it: the bell grows to the size of the token, to be easier to see and to click (and shrinks again)
    const guest = (demoMode? demoClaims: ((pendingClaim && !pendingClaim.claimed)? [pendingClaim]: []))
        .find((claim) => playerPositions[claim.guestId] === spot);
    if (guest)
    {
        bigBells[guest.guestId] = !bigBells[guest.guestId];
        drawTokenMarks();
        return;
    }
    const info = ROAD[spot],
        sides = [info[INDEX_HOTEL_L], info[INDEX_HOTEL_R]].map((place) => isHotel(place)? `${place} Hotel`: place),
        hotel = entrancesTaken[spot];
    appendStatus(`Space ${spot}: ${ACTION_NAMES[info[INDEX_ACTION]]}. Between ${sides[0]} and ${sides[1]}.${(hotel !== undefined)? ` Entrance of ${hotelSummary(hotel)}, owner ${playerString(owner(hotel))}.`: ''}`, 'log_info');
}

//An entrance spot has been clicked: choose it, if that is being asked
function entranceClicked(spot, side)
{
    const q = pendingAsk;
    if (!q || (q.kind !== 'entranceSpot') || aiLevel(q.playerId)) return;
    const index = q.options.findIndex((option) => (option.spot === spot) && (option.side === side));
    if (index >= 0)
    {
        answer(index);
    }
}

function whereAmI(playerId)
{
    playerId ??= who;
    const cell = $(`#cell_played${playerPositions[playerId]}`);
    if (!cell[0]) return;
    cell.removeClass('shimmer').addClass('pulsate');
    cell[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    setTimeout(() => {
        cell.removeClass('pulsate');
        if (playerId === who) cell.addClass('shimmer');
    }, 5000);
}

function gotoBalances()
{
    $('#divBalances')[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

function goTop()
{
    window.scrollTo(0, 0);
}

////////// Options and players //////////

function setHalfPriceCompulsory(choice)
{
    HALF_PRICE_COMPULSORY = choice;
}

function setFollowToken(choice)
{
    FOLLOW_TOKEN = choice;
}

function setAutoClaim(choice)
{
    AUTO_CLAIM = choice;
}

function setPaleMap(choice)
{
    PALE_MAP = choice;
    localStorage.hotelsPaleMap = choice? '1': '0'; //kept with the browser, not with the game
    refresh();
}

function setShowRisks(choice)
{
    SHOW_RISKS = choice;
    localStorage.hotelsShowRisks = choice? '1': '0'; //kept with the browser, not with the game
    if (pendingAsk && (pendingAsk.kind === 'roll'))
    {
        drawAhead(pendingAsk.playerId);
    }
}

function setSound(choice)
{
    SOUND = choice;
    localStorage.hotelsSound = choice? '1': '0'; //kept with the browser, not with the game
}

function resetOptions()
{
    for (let i = 0; i < PLAYERS.length; ++i)
    {
        $(`#cb_player_${i}`)[0].checked = DEF_PLAYERS[i];
    }
    setAiPlayers({});
    HALF_PRICE_COMPULSORY = false;
    $('#option_half_price')[0].checked = false;
    FOLLOW_TOKEN = true;
    $('#option_follow_token')[0].checked = true;
    AUTO_CLAIM = false;
    $('#option_auto_claim')[0].checked = false;
    newGameBoard(true);
}

//Players table: who plays, and which of them are computer players
function setupPlayersTable()
{
    let s = '<table><tr>';
    PLAYERS.forEach((name, i) => {
        const levels = Object.keys(AI_LEVELS).map((level) => `<option value='${level}'>${AI_LEVELS[level]}</option>`).join('');
        s += `<td style='background: ${PLAYER_BACKGROUNDS[i]};'>
            <div class='player_pick'>
                <div class='player_pick_opts'>
                    <input type='checkbox' class='big_checkbox' id='cb_player_${i}' ${DEF_PLAYERS[i]? 'checked': ''} onclick='updatePlayersSelection(${i});'>
                    <span data-tooltip-position='${(i !== 0)? 'top': 'top-right'}' data-tooltip='Computer plays this player'>
                        <input type='checkbox' class='big_checkbox' id='cb_ai_${i}' onclick='updateAiSelection(${i});'>
                        <label for='cb_ai_${i}' class='player_pick_ai'>AI</label></span>
                </div>
                <label for='cb_player_${i}'><img src='images/token-${TOKEN_IMAGES[i]}.png' alt='Player ${i + 1}: ${name}' style='width: 100px;'></label>
            </div>
            <div class='player_pick_name'>${name}</div>
            <select id='sel_ai_${i}' class='player_pick_level' style='display: none;' onchange='updateAiSelection(${i});'>${levels}</select>
        </td>`;
    });
    $('#divPlayers')[0].innerHTML = s + '</tr></table>';
}

function readPlayersSelection()
{
    ignoredPlayers = {};
    for (let i = 0; i < PLAYERS.length; ++i)
    {
        if (!$(`#cb_player_${i}`)[0].checked)
        {
            ignoredPlayers[i] = true;
        }
    }
}

//A player has been ticked or unticked in the Players table: join or leave the game being played
function updatePlayersSelection(playerId)
{
    const cb = $(`#cb_player_${playerId}`)[0];
    if (gameOver)
    {
        return; //takes effect with the next New Game
    }
    if (cb.checked)
    {
        delete ignoredPlayers[playerId];
        playersData[playerId] = { money: START_MONEY, hotels: {} };
        placeToken(playerId, `_s${playerId}`);
        startPlayers = Math.max(startPlayers, playingIds().length);
        appendStatus(`${playerString(playerId)} has joined the game, with ${formatMoney(START_MONEY)}.`);
        refresh();
        return;
    }
    if (playingIds().length <= 2 && isPlaying(playerId))
    {
        cb.checked = true;
        appendStatus('Cannot remove this player: a game needs 2.', 'log_bad');
        return;
    }
    //leaving: hotels are knocked down, and their title deeds go back to the Bank
    const busy = pendingAsk && ((pendingAsk.playerId === playerId) || (who === playerId));
    hotelsOf(playerId).forEach((hotel) => {
        playersData[playerId].hotels[hotel].entrances.forEach((spot) => delete entrancesTaken[spot]);
        delete hotelsOwners[hotel];
        shownBuilt[hotel] = 0;
    });
    playersData[playerId].hotels = {};
    liftToken(playerId);
    ignoredPlayers[playerId] = true;
    appendStatus(`${playerString(playerId)} has left the game.`);
    if (busy || (who === playerId))
    {
        //whatever was going on is dropped; play goes on from the next turn
        ++gameRun;
        pendingAsk = null;
        clearPrompt();
        if (!isPlaying(who))
        {
            advancePlayer();
        }
        runGame();
    }
    refresh();
}

////////// Games: new, saved, restored //////////

function newPlayersData()
{
    playersData = PLAYERS.map(() => ({ money: START_MONEY, hotels: {} }));
    hotelsOwners = {};
    entrancesTaken = {};
    playerPositions = [];
    shownBuilt = {};
    actionMarks = [];
    dustTrail = [];
    menuState = null;
    pendingClaim = null;
    buildStarted = {};
    turnActions = [];
    openAction = -1;
    news = [];
    sparkles = [];
    stickyBubbles = {};
    forfeit = false;
    skipRollAsk = false;
    sheetConfirm = false;
    revealCash = false;
    turnCount = 0;
    gameOver = false;
}

//'?demo=1': all 9 cars on the road and every hotel fully built with all its entrances, to look the pictures over. No game is played.
function showDemo()
{
    ++gameRun;
    pendingAsk = null;
    demoMode = true;
    ignoredPlayers = {};
    newPlayersData();
    drawBoard();
    PLAYERS.forEach((name, id) => placeToken(id, (id * 3) + 2));
    Object.keys(HOTELS_DATA).forEach((hotel, i) => {
        const data = HOTELS_DATA[hotel],
            live = { built: data.build.length, entrances: [], boughtTurn: 0, completedTurn: 0 };
        playersData[i].hotels[hotel] = live;
        hotelsOwners[hotel] = i;
        data.entrances.forEach((spot) => {
            if ((entrancesTaken[spot] === undefined) && (live.entrances.length < data.maxEntrances))
            {
                entrancesTaken[spot] = hotel;
                live.entrances.push(spot);
            }
        });
    });
    playersData[0].money = 18750; //some of every note
    who = 0;
    turnCount = 1;
    addMark(0, 'buy', 'Boomerang', 'bought the land of <b>Boomerang Hotel</b> for <b>$500</b> (example)');
    addMark(0, 'build', 'Fujiyama', 'built main building<br>of <b>Fujiyama Hotel</b>, for $2,200 (example)');
    PLAYERS.forEach((name, id) => [1, 2, 3].forEach((back) => addDust(id, ((id * 3) + 2 - back + ROAD.length) % ROAD.length)));
    clearPrompt();
    //claiming a hotel fee: every car that stands at an entrance of someone else's hotel, as an example
    demoClaims = [];
    PLAYERS.forEach((name, id) => {
        const hotel = entrancesTaken[playerPositions[id]];
        if ((hotel !== undefined) && (owner(hotel) !== id) && (demoClaims.length < 3))
        {
            demoClaims.push({ guestId: id, ownerId: owner(hotel), hotel });
        }
    });
    //kept short: it all has to fit in the top panel
    $('#divWho')[0].innerHTML = `Demo <small class='demo_note'>everything built, for review. <b>Drag</b> buildings, facilities, hotel names and entrances into place;
        History prints their numbers for board.js. Remove <b>?demo=1</b> from the address to play.</small>`;
    $('#divPrompt')[0].innerHTML = `<button onclick='printSites();'>Print all positions</button>
        <span id='spanTrace'></span><br>
        ${demoClaims.map((claim, i) => `<span data-tooltip-position='bottom' data-tooltip='Example of claiming a hotel fee: the car with the bell stands at an entrance of this hotel. In a game the button shows here until that turn passes'>
            <button class='button_claim' onclick='demoClaim(${i});'>&#x1F440; ${PLAYERS[claim.ownerId]}: claim fee for ${claim.hotel}!</button></span>`).join('')}`;
    showStatus('Demo: nothing is played or saved.');
    trace = null;
    refresh();
    drawTraceBar();
}

/*
Start a new game with the players ticked in the Players table.
@param noRestore (bool) do not offer to restore the saved game
*/
function newGameBoard(noRestore)
{
    if (demoMode)
    {
        showDemo();
        return;
    }
    ++gameRun;
    pendingAsk = null;
    readPlayersSelection();
    newPlayersData();
    drawBoard();
    playingIds().forEach((id) => placeToken(id, `_s${id}`));
    startPlayers = playingIds().length;
    who = playingIds()[0];
    clearPrompt();
    showStatus(`New game for ${startPlayers} players. Everyone starts in the car park with ${formatMoney(START_MONEY)}.`);
    $('#divWho')[0].innerHTML = '';
    refresh();

    if (!noRestore && hasSavedGame())
    {
        $('#divPrompt')[0].innerHTML = `<div class='prompt_text'>Would you like to restore the saved game?</div>
            <button onclick='restoreSavedGame();'>Yes</button>
            <button class='button_final' onclick='clearPrompt(); runGame();'>No</button>`;
        return;
    }
    runGame();
}

//The game as it stands, in the form that is saved, exported and restored
function gameSnapshot()
{
    return {
        version: 2,
        playerPositions, ignoredPlayers, who, turnCount, startPlayers,
        playersData, hotelsOwners, entrancesTaken, actionMarks, dustTrail, turnActions, news,
        resume: (pendingAsk && (pendingAsk.kind === 'menu'))? menuState: null, //in the middle of a turn, choosing what to do
        HALF_PRICE_COMPULSORY, FOLLOW_TOKEN, AUTO_CLAIM
    };
}

function saveGame()
{
    if (demoMode) return;
    localStorage.savedGameHotels = JSON.stringify(gameSnapshot());
}

//'Export game' button: the game as a file to keep or pass on (for debugging, tutorials, ...); with who the computer players are
function exportGame()
{
    const q = pendingAsk;
    if (demoMode || gameOver) return;
    if (!q || (q.playerId !== who) || ((q.kind !== 'roll') && (q.kind !== 'menu')))
    {
        appendStatus('Cannot export in the middle of this. Export before the throw, or when choosing what to do on a space.', 'log_bad');
        return;
    }
    const game = Object.assign(gameSnapshot(), { aiPlayers }),
        link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(game, null, 1)], { type: 'application/json' }));
    link.download = `hotels-turn${turnCount}-${PLAYERS[who].replace(/\W+/g, '')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    appendStatus(`&#x1F4BE; Game exported as <b>${link.download}</b> (see your downloads).`, 'log_good');
}

/*
'Load game' button: put on a game from a file made by 'Export game', in place of the one being played.
@param text (string) contents of the file
@return (bool) whether it was a game
*/
function importGame(text)
{
    let game;
    try
    {
        game = JSON.parse(text);
    }
    catch (e)
    {
        game = null;
    }
    if (!game || (game.version !== 2) || !Array.isArray(game.playersData) || (game.playersData.length !== PLAYERS.length) || !game.hotelsOwners)
    {
        appendStatus('That file is not a Hotels game exported from this page.', 'log_bad');
        return false;
    }
    if (game.aiPlayers)
    {
        setAiPlayers(game.aiPlayers);
    }
    restoreSavedGame(game);
    appendStatus(`Game loaded from file: turn ${game.turnCount}, ${PLAYERS[game.who]} to play.`, 'log_info');
    return true;
}

//A file has been picked for 'Load game'
function importGameFile(input)
{
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importGame(String(reader.result));
    reader.readAsText(file);
    input.value = ''; //so that the same file can be picked again
}

function hasSavedGame()
{
    try
    {
        return JSON.parse(localStorage.savedGameHotels).version === 2;
    }
    catch (e)
    {
        return false;
    }
}

/*
Put a saved game back on the page and play on.
@param gameData (object) optional: the game, as saveGame() stores it; default: the one saved in this browser
*/
function restoreSavedGame(gameData)
{
    if (!gameData)
    {
        if (!hasSavedGame()) return;
        gameData = JSON.parse(localStorage.savedGameHotels);
    }
    if (demoMode) return;
    ++gameRun;
    pendingAsk = null;
    newPlayersData();
    ({ ignoredPlayers, who, startPlayers, playersData, hotelsOwners, entrancesTaken } = gameData);
    //a turn saved at its start is played again; one saved further on is taken up where it was
    turnCount = gameData.resume? gameData.turnCount: gameData.turnCount - 1;
    actionMarks = gameData.actionMarks || [];
    dustTrail = (gameData.dustTrail || []).filter((dust) => typeof dust === 'object');
    turnActions = gameData.resume? (gameData.turnActions || []): [];
    openAction = -1;
    drawTurnActions();
    news = gameData.news || [];
    drawNews();
    HALF_PRICE_COMPULSORY = !!gameData.HALF_PRICE_COMPULSORY;
    $('#option_half_price')[0].checked = HALF_PRICE_COMPULSORY;
    FOLLOW_TOKEN = !!gameData.FOLLOW_TOKEN;
    $('#option_follow_token')[0].checked = FOLLOW_TOKEN;
    AUTO_CLAIM = !!gameData.AUTO_CLAIM;
    $('#option_auto_claim')[0].checked = AUTO_CLAIM;

    drawBoard();
    PLAYERS.forEach((name, i) => {
        $(`#cb_player_${i}`)[0].checked = !ignoredPlayers[i];
        if (isPlaying(i))
        {
            placeToken(i, gameData.playerPositions[i]);
        }
    });
    Object.keys(hotelsOwners).forEach((hotel) => {
        shownBuilt[hotel] = hotelOf(hotel).built; //already standing: no need to rise again
    });
    clearPrompt();
    showStatus('Game restored.');
    refresh();
    drawTrail();
    if (!declareWinner())
    {
        runGame(gameData.resume || undefined);
    }
}

////////// Page //////////

function createDice()
{
    if ($('#dice1').length > 0) return;
    const div = $('.dice-container');
    div.append($(Dice.html('dice1')));
    div.append($(HotelsDice.html('dice2')));
    diceOne = new Dice('dice1', false);
    diceTwo = new HotelsDice('dice2', false);
}

function showRules()
{
    if (!popupRules)
    {
        popupRules = new WinBox({
            title: 'Rules',
            index: POPUP_INDEX,
            x: '10px',
            y: '280px',
            width: '70%',
            height: `${Math.max(300, window.innerHeight - 320)}px`,
            html: RULES,
            onclose: function() {
                this.minimize();
                return true;
            }
        });
    }
    else
    {
        popupRules.restore();
    }
}

$(document).ready(() => {
    setupPlayersTable();
    recallAiPlayers();
    createDice();
    showHistory();
    setupDemoDrag();
    SOUND = (localStorage.hotelsSound !== '0');
    $('#option_sound')[0].checked = SOUND;
    PALE_MAP = (localStorage.hotelsPaleMap !== '0');
    $('#option_pale_map')[0].checked = PALE_MAP;
    SHOW_RISKS = (localStorage.hotelsShowRisks !== '0');
    $('#option_show_risks')[0].checked = SHOW_RISKS;
    demoMode = (new URLSearchParams(window.location.search).get('demo') === '1');
    newPlayersData();
    newGameBoard();
    if (new URLSearchParams(window.location.search).get('sample') === '1')
    {
        loadSampleGame();
    }
});
