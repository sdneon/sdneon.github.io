let NUM_PLAYERS = 2,
    //Specify whether to avoid placing weapons at room entrances and blocking entry/exit; Recommended: true for easier game
    AVOID_BLOCKING_ROOM_ENTRY = true,
    //Specify whether to auto-pick Murder card when you are to get from 'player of your choice'
    AUTOPICK_CARD = true,
    //Specify whether to allowing peeking at card holder flaps anytime, or enforce locks!
    ALLOW_PEEKING_ANYTIME = false,
    //do NOT reveal clue#!! //DEBUG only, or for super easy mode X)
    SHOW_CLUE_NUM = false;
const PCS = ['big', 'medium', 'small'],
    ROW = ['top', 'middle', 'bottom'],
    COL = ['left', 'middle', 'right'];
//HTML characters
const LOCK = '&#x1F512;',
    KEY = '&#x1f511;';

let diceOne, diceTwo;
let deckSuperClues,
    deckSpareMurderCards,
    deckPlayerMurderCards, //switches for each player
    ignoredPlayers = {},
    playersData = [];

let who = 0, //current player
    lastPlayer = 0,
    bumpMode = false,
    bumpingWho = 0,
    remotePlay = false,
    curActionCard = false,
    status = 'New game';

function randInt(max)
{
    return (Math.random() * max) | 0;
}

function compareNumbers(a, b) {
  return a - b;
}

function compareNumbersBig1st(a, b) {
  return b -a;
}

function compareCardTypes(a, b) {
  return a[0] - b[0];
}

//convert to hex and pad to 6 characters if needed (by prepending '0')
function toHexChars(v, numChs)
{
    let s = v.toString(16);
    if (s.length < numChs)
        s = '0' + s;
    return s;
}

/*
    Encode (up to 8) Murder cards (IDs) for remote play.
*/
function encodeCards(cards)
{
    /*
    Each card has value [0, 26] needs min 5 bits, so use 1B for each.
    Use a simple mask since we just don't want player to read the card ID off.
    => mask: 0xAA i.e. 10101010b
    Encoded output: [masked card IDs, 2 hex digit each for total of 2 to 16 hex digits]
    */
    const cnt = cards.length;
    let code = '';
    for (let i = 0; i < cnt; ++i)
    {
        code += toHexChars(cards[i] ^ 0xAA, 2);
    }

    //console.log(`masked cards code: 0x${code}`);
    return code;
}

function decodeCards(code)
{
    const cnt = (code.length / 2) | 0,
        cards = [];
    for (let i = 0, p = 0; i < cnt; ++i, p += 2)
    {
        cards[i] = parseInt(code.substring(p, p+2), 16) ^ 0xAA;
    }
    return cards;
}

//encode mystery (card holder values) for link sharing for remote play
function encodeMystery()
{
    return encodeCards(cardHolders);
}

function decodeMystery(code)
{
    return decodeCards(code);
}

/*
    Encode who received (up to 8) Murder cards (IDs), for remote play.
    4 max from Super Clue, and 8 max from 1 from each (other) player.
    Retval:
    [player ID, 1 hex digit][mask, up to 8 hex digits][card IDs, 1 hex digit each for total of 1 to 8 hex digits]
*/
function encodeMurderCards(cards)
{
    const code = encodeCards(cards);
    return `${who.toString(16)}${code}`;
}

function decodeMurderCards(code)
{
    const playerId = parseInt(code.substring(0, 2), 16),
        cards = decodeCards(code.substring(2, code.length));
    return [playerId, cards];
}

function updateGameCode()
{
    remotePlay = false;
    $('#spanGameCode')[0].textContent = encodeMystery();
}

function copyGameLink()
{
    const link = `https://sdneon.github.io/games/cluedo/cluedo.html?mys=${encodeMystery()}`;
    navigator.clipboard.writeText(link);
}

function copyGameCode()
{
    const code = encodeMystery();
    navigator.clipboard.writeText(code);
}

function playerString(playerId)
{
    playerId ??= who;
    return `<font color='${PLAYER_COLORS[playerId]}'>${PLAYERS[playerId]}</font>`;
}

function stringCardsCode(newCardsCode)
{
    return `<span data-tooltip='Jump to Detective Notes' data-tooltip-position='right'>
            <button onclick='gotoNotes();'>(goto Notes)</button></span>
        <span data-tooltip='Copy new cards codes to share for remote play' data-tooltip-position='bottom'>
            <button onclick='navigator.clipboard.writeText("${newCardsCode}");'>Copy Cards Code: ${newCardsCode}</button></span>`;
}

function announceNewCardsRecv(info)
{
    const { numCardsTaken, newCardsCode } = info;
    appendStatus(`${playerString()} got ${numCardsTaken} Murder cards ${stringCardsCode(newCardsCode)}`);
}

function gimme5MurCards(numCards)
{
    announceNewCardsRecv(takeMurderCard(who, numCards ?? 5));
}

function claimCards()
{
    if (!remotePlay)
    {
        showStatus('&#9888;&#65039; Cannot claim cards when <i>Not</i> in remote play');
        return;
    }
    const cards = decodeCards($('#inClaimCards')[0].value);
    if (cards.length <= 0)
    {
        appendStatus(`&#9888;&#65039; Invalid cards code ${code}?! No card obtained.`);
        return;
    }
    let cnt = 0;
    createPlayerData(who);
    const deck = playerCardDecks[who];
    cards.forEach((card) => {
        if ((card < 0) || (card >= CARD_NAMES.length))
        {
            appendStatus(`&#9888;&#65039; Tried to grab <i>invalid</i> card#${card}`);
            return;
        }
        if (answers.indexOf(card) >= 0)
        {
            return; //silently abort without obviously giving away attempt to claim an answer card
        }
        if (deck.indexOf(card) >= 0)
        {
            appendStatus(`&#x270B; Already has card#${card}`, undefined, true);
            return;
        }
        ++cnt;
        deck.push(card);
        playersData[who].clues.cardsSeen[card] = true;
        deckPlayerMurderCards.append(`<div class='bg_gold'>
            <div id='player${who}_mur${card}' class='card_alone'
                style='background-image: url(images/card-${CARD_IMAGES[card]}.webp); background-repeat: no-repeat;background-size: 100%;'></div></div>`);
        deckSpareMurderCards.removeCard(card);
    });
    appendStatus(`&#x1F44C; Claimed ${cnt} card(s).`, undefined, true);
}

function removeCards()
{
    if (!remotePlay)
    {
        showStatus('&#9888;&#65039; You are not in remote play, but specified cards will still be removed.');
    }
    const cards = decodeCards($('#inClaimCards')[0].value);
    if (cards.length <= 0)
    {
        appendStatus(`&#9888;&#65039; Invalid cards code ${code}?! No card removed.`);
        return;
    }
    let cnt = 0;
    createPlayerData(who);
    const deck = playerCardDecks[who];
    cards.forEach((card) => {
        if ((card < 0) || (card >= CARD_NAMES.length))
        {
            appendStatus(`&#9888;&#65039; Tried to remove <i>invalid</i> card#${card}`);
            return;
        }
        const i = deck.indexOf(card);
        if (i < 0)
        {
            appendStatus(`&#x270B; You don't have card#${card}`, undefined, true);
            return;
        }
        ++cnt;
        deck.splice(i, 1);
    });
    appendStatus(`&#x1F44C; Removed ${cnt} card(s).`, undefined, true);
    if (cnt > 0)
    {
        refreshCardsInDetNotes();
    }
}

//@retval player ID if its token has been clicked
function playerTokenClicked(cellId)
{
    let i;
    for (i = 0; i < 9; ++i)
    {
        if (playerPositions[i] === cellId)
        {
            return i;
        }
    }
    return -1;
}

function diceString()
{
    return `<span data-tooltip='${diceOne.val}+${diceTwo.val}=${diceOne.val+diceTwo.val}' data-tooltip-position='top'>&nbsp;&nbsp;&nbsp;</span>`;
}

function movePlayerThere(playerId, cellId)
{
    const lastPos = playerPositions[playerId]; //cell ID
    if (lastPos !== undefined)
    {
        const cell = $(`#cell_played${lastPos}`);
        cell.removeClass(`cell_player_${playerId}`);
        cell[0].innerHTML = '';
        $(`#cell${lastPos}`).removeClass('cell_occupied');
    }
    playerPositions[playerId] = cellId;
    const cell = $(`#cell_played${cellId}`);
    cell.addClass(`cell_player_${playerId}`);
    cell[0].innerHTML = diceString();
    $(`#cell${cellId}`).addClass('cell_occupied');
    if (playerId === who)
    {
        $('td').removeClass('shimmer pulsate');
        cell.addClass('shimmer');
    }
}

function checkResetClueCounters()
{
    if ((Object.keys(placedClues)).length <= 3)
    {
        resetClueCounters();
    }
}

function addCardToDetNotes(card, isNew)
{
    const strClass = isNew? " class='bg_gold'": '';
    deckPlayerMurderCards.append(`<div ${strClass}><div id='player${who}_mur${card}' class='card_alone'
        style='background-image: url(images/card-${CARD_IMAGES[card]}.webp); background-repeat: no-repeat;background-size: 100%;'></div></div>`);
}

function whoHasCards()
{
    const whoHas = [];
    playerCardDecks.forEach((deck, playerId) => {
        if (playerId === who) return; //ignore self
        if (deck.length > 0)
        {
            whoHas.push(playerId);
        }
    });
    return whoHas;
}

function randomPlayerWithCard()
{
    const whoHas = whoHasCards(),
        cnt = whoHas.length;
    if (cnt <= 0)
    {
        return -1;
    }

    const index = (cnt > 1)? randInt(cnt): 0;
    return whoHas[index];
}

/*
Transfer card (at given index) from given player's deck to current player.
@param index (int) which card to take.
@param playerId (int) who card is from.
@return ID of card transferred.
*/
function transferCard(cardIndex, playerId)
{
    const deck = playerCardDecks[playerId],
        cardId = deck[cardIndex];
    if (cardIndex >= deck.length) return;

    deck.splice(cardIndex, 1);
    playerCardDecks[who].push(cardId);
    addCardToDetNotes(cardId, true);

    const newCardsCode = stringCardsCode(encodeCards([cardId]));
    appendStatus(`You got 1 Murder card from ${PLAYERS[playerId]} &#x1F604; ${newCardsCode}`);
    return cardId;
}

function takeRandomCardFromPlayer(playerId, noChoiceOfPlayer)
{
    const name = PLAYERS[playerId];
    if (!noChoiceOfPlayer)
    {
        $('#divChoiceOfPlayers').remove();
        appendStatus(`You picked ${name}.`);
    }
    else
    {
        appendStatus(`Only ${name} has Murder card(s).`);
    }
    const deck = playerCardDecks[playerId];
    if (deck.length <= 0) return;

    transferCard(randInt(deck.length), playerId);
}

//offer player choice of other players to take Murder card from
function chooseCardFromPlayer(playerId)
{
    $('#divChoiceOfPlayers').remove();
    const deck = playerCardDecks[playerId],
        cnt = deck.length,
        name = PLAYERS[playerId];
    if (cnt <= 0)
    {
        appendStatus(`${name} has NO cards!`);
        return;
    }
    if (cnt === 1)
    {
        transferCard(0, playerId);
        return;
    }
    let s = `Choose a Murder card from ${name}:<br><div id='divChoiceOfCards' style='display: flex; flex-direction: row; flex-wrap: wrap;'>`;

    const choices = Array.from(Array(cnt).keys());;
    shuffle(choices);
    choices.forEach((cardIndex) => {
        s += `<span data-tooltip='Take this card' data-tooltip-position='bottom'>
            <a href='javascript:$("#divChoiceOfCards").remove(); transferCard(${cardIndex}, ${playerId});'>
                <img style='width:60px; height:90px;' src='images/card-murder.webp'/></a></span> `;
    });

    s += '</div>';
    appendStatus(s);
}

let cardsCollected = [],
    numPlayersToCollectFrom = 0;

function transferCard2(divId, cardIndex, playerId)
{
    $(`#${divId}`).remove();
    const cardId = transferCard(cardIndex, playerId);
    cardsCollected.push(cardId);
    if (--numPlayersToCollectFrom <= 0)
    {
        announceNewCardsRecv({
            numCardsTaken: cardsCollected.length,
            newCardsCode: encodeCards(cardsCollected)
        });
    }
}

//offer cards from all other players to take Murder card (1 each) from
function chooseCardFromPlayers()
{
    const whoHas = whoHasCards(),
        cnt = whoHas.length;
    if (cnt <= 0)
    {
        appendStatus('Sadly no one has any Murder cards for you &#x1F62D;');
        return;
    }
    if (whoHas.length === 1)
    {
        chooseCardFromPlayer(whoHas[0]);
        return;
    }
    numPlayersToCollectFrom = cnt;

    let s = `Choose a Murder card from <b>each</b> player:<br><br>`;
    whoHas.forEach((playerId) => {
        const deck = playerCardDecks[playerId],
            cnt = deck.length,
            name = PLAYERS[playerId],
            divId = `divChoiceOfCards${playerId}`;
        if (cnt === 1)
        {
            --numPlayersToCollectFrom;
            cardsCollected.push(deck[0]);
            transferCard(0, playerId);
            return;
        }

        s += `<div id='${divId}' style='display: flex; flex-direction: row; flex-wrap: wrap;'>${name}:<br>`;

        const choices = Array.from(Array(cnt).keys());
        shuffle(choices);
        choices.forEach((cardIndex) => {
            s += `<span data-tooltip='Take this card' data-tooltip-position='bottom'>
                <a href='javascript:transferCard2("${divId}", ${cardIndex}, ${playerId});'>
                    <img style='width:60px; height:90px;' src='images/card-murder.webp'/></a></span> `;
        });

        s += '</div>';
    });
    appendStatus(s);
}

function choosePlayerForCard()
{
    const whoHas = whoHasCards(),
        cnt = whoHas.length;
    if (cnt <= 0)
    {
        appendStatus('Sadly no one has any Murder cards for you &#x1F62D;');
        return;
    }
    if (whoHas.length === 1)
    {
        chooseCardFromPlayer(whoHas[0]);
        return;
    }

    if (AUTOPICK_CARD)
    {
        const randomPlayerId = whoHas[randInt(whoHas.length)]; //to take card from
        takeRandomCardFromPlayer(randomPlayerId);
        return;
    }

    let s = `Choose a player to take a Murder card from:<br><div id='divChoiceOfPlayers' style='display: flex; flex-direction: row; flex-wrap: wrap;'>`;

    whoHas.forEach((playerId) => {
        const name = PLAYERS[playerId],
            numCards = playerCardDecks[playerId].length;
        s += `<span data-tooltip='Take card from ${name}' data-tooltip-position='bottom'>
            <button onclick='chooseCardFromPlayer(${playerId});'>${name}: ${numCards} card(s)</button></span> `;
    });

    const randomPlayerId = whoHas[randInt(whoHas.length)]; //to take card from
    s += `<span data-tooltip='Take card from random player' data-tooltip-position='bottom'>
        <button onclick='takeRandomCardFromPlayer(${randomPlayerId});'>Random</button></span> `;

    s += '</div>';
    appendStatus(s);
}

function cellClicked(y, x)
{
    //console.log(y, x);
    const cellId = `${y}_${x}`;
    if (invalidSpots[cellId] !== undefined)
    {
        showStatus(`&#9940; @ ${x}, ${y}: Invalid/unreachable space`, undefined, true);
        return;
    }

    if (bumpMode)
    {
        const cell = $(`#cell${cellId}`);
        if (cell.hasClass('cell_occupied'))
        {
            showStatus(`Cannot move other player (${PLAYERS[bumpingWho]}) to occupied space @ ${x}, ${y}! Try else where!`);
        }
        else
        {
            movePlayerThere(bumpingWho, cellId);
            showStatus(`Other player (${PLAYERS[bumpingWho]}) has been bumped to @ ${x}, ${y}`);
            bumpMode = false;
        }
        return;
    }

    if (placedClues[cellId] !== undefined)
    {
        const clueId = placedClues[cellId];
        //console.log(y, x, `clue counter #${clueId}`, CLUES[clueId]);

        delete placedClues[cellId];
        const cell = $(`#cell${cellId}`);
        cell.removeClass('cell_clue_counter cell_clue_counter_dummy cell_occupied');
        $(`#cell_played${cellId}`)[0].innerHTML = '';

        removedClues[clueId] = true; //remember it for reset
        updateClueAvail(clueId);

        const clue = CLUES[clueId];
        if (clue[1] === 'murderCardFromDeck')
        {
            const cnt = clue[2];
            showStatus(`Take ${cnt} murder card${(cnt>=1)?'s':''} from deck`);
            announceNewCardsRecv(takeMurderCard(who, cnt));
        }
        else if (clue[1] === 'clue')
        {
            const clueObjId = clue[2],
                clueObjName = clue[3];

            //check (1) clue item already gone (2) clue already active
            const cnt = $(`.cell_${(clueObjId < WEAPONS.length)?'wpn':'orn'}_${clueObjName}`).length;
            if (cnt <= 0)
            {
                showStatus(`&#x1F62D; Clue @ <b>${clueObjName}</b> is already <b><i>GONE/TAKEN</i></b>`);
            }
            else if (activeClues.indexOf(clueObjId) < 0)
            {
                //not yet shown in active clue list, so add it
                activeClues.push(clueObjId);
                const div = $('#divActiveClues');
                if (!hasActiveClue())
                {
                    div[0].children[0].remove();
                }
                addActiveClue(div, clueObjId, clueObjName);
                showStatus(`&#x1F60E; New clue available @ <b>${clueObjName}</b>`);
            }
            //else already shown in active clue list
            else
            {
                showStatus(`&#x1F609; Reminder: clue available @ <b>${clueObjName}</b>, have another turn (roll again)`);
            }
        }
        else if (clue[1] === 'look')
        {
            showStatus(`<h2>&#x1F970; ${clue[0]}</h2>`);
            unlockFlaps(clue[2], clue[3], clue[4]);
        }
        else if (clue[1] === 'falseAlarm')
        {
            showStatus(`<h2>&#x1F61C; ${clue[0]}</h2>`);
        }
        else if (clue[1] === 'murderCardFromPlayer')
        {
            const cnt = clue[2],
                from = clue[3],
                myDeck = playerCardDecks[who],
                takenCards = [],
                takenFrom = [];
            showStatus(clue[0]);

            let numTaken = 0;
            if (from === 'everyone')
            {
                if (AUTOPICK_CARD)
                {
                    playerCardDecks.forEach((deck, playerId) => {
                        if (playerId === who) return; //ignore self
                        if (deck.length > 0)
                        {
                            const i = randInt(deck.length),
                                card = deck[i];
                            deck.splice(i, 1);
                            myDeck.push(card);
                            takenCards.push(card);
                            takenFrom.push(playerId);
                            addCardToDetNotes(card, true);
                            ++numTaken;
                        }
                    });
                }
                else
                {
                    chooseCardFromPlayers();
                    return;
                }
            }
            else //from 1 player only
            {
                choosePlayerForCard();
                return;
            }
            if (numTaken <= 0)
            {
                appendStatus('Sadly no one has any Murder cards for you &#x1F62D;');
            }
            else
            {
                takenFrom.forEach((playerId, i) => {
                    takenFrom[i] = PLAYERS[playerId];
                });
                const newCardsCode = encodeCards(takenCards);
                appendStatus(`You got ${numTaken} Murder card${(numTaken > 1)?'s':''} from ${takenFrom.join(',')} &#x1F604; ${stringCardsCode(newCardsCode)}`);
            }
        }
        else
        {
            //should no longer come here!
            showStatus(`&#x1F914; [Construction in progress...] Your clue is: ${clue[0]}`);
        }
        movePlayerThere(who, cellId);
        checkResetClueCounters();
        return;
    }
    if (placedOrns[cellId] !== undefined)
    {
        const ornId = placedOrns[cellId],
            ornName = ORNAMENTS[ornId],
            clueObjId = ornId + WEAPONS.length;
        //console.log(y, x, `garden ornament: ${ORNAMENTS[ornId]}`);

        //check if in activeClues
        const i = activeClues.indexOf(clueObjId);
        if (i < 0)
        {
            //console.log(`garden ornament: ${ornName} is NOT an active clue! Go away!`);
            showStatus(`&#x1F605; <b>Garden Ornament <i>${ornName}</i></b> has NO clue yet!`);
        }
        else
        {
            showStatus(`You have found the Clue at <b>Garden Ornament <i>${ornName}</i></b> &#x1F601;<br>Have a Super Clue card...`);

            delete placedOrns[cellId];
            const cell = $(`#cell${cellId}`);
            cell.removeClass(`cell_orn_${ORNAMENTS[ornId]} cell_occupied`);

            removedOrns[ornId] = true; //remember it for reset

            activeClues.splice(i, 1);
            $(`#active-clue-${clueObjId}`).remove();

            movePlayerThere(who, cellId);
            takeActionCard();
        }
        return;
    }
    if (placedWeapons[cellId] !== undefined)
    {
        const wpnId = placedWeapons[cellId],
            wpnName = WEAPONS[wpnId];
        //console.log(y, x, `weapon: ${wpnName}`);
        //check if in activeClues
        const i = activeClues.indexOf(wpnId);
        if (i < 0)
        {
            //console.log(`weapon: ${wpnName} is NOT an active clue! Go away!`);
            showStatus(`&#x1F605; <b><i>${wpnName}</i> (Weapon)</b> has NO clue yet!`);
        }
        else
        {
            showStatus(`You have found the Clue on <b><i>${wpnName}</i> (weapon)</b> &#x1F601;<br>Have a Super Clue card...`);

            delete placedWeapons[cellId];
            const cell = $(`#cell${cellId}`);
            cell.removeClass(`cell_wpn_${WEAPONS[wpnId]} cell_occupied cell_has_weapon`);

            removedWeapons[wpnId] = true; //remember it for reset

            activeClues.splice(i, 1);
            $(`#active-clue-${wpnId}`).remove();

            movePlayerThere(who, cellId);
            takeActionCard();
        }
        return;
    }
    const cell = $(`#cell${cellId}`);
    if (cell.hasClass('cell_occupied'))
    {
        let allowBump = false;
        const ownPos = playerPositions[who];
        if (ownPos == cellId) //ignore clicking on own position
        {
            return;
        }
        if (allRoomSlots[cellId] && allRoomSlots[ownPos] //are in rooms
            && (allRoomSlots[cellId] === allRoomSlots[ownPos])) //and in fact in same room
        {
            // further check if side by side!
            const coords = ownPos.split('_'),
                ownY = parseInt(coords[0], 10),
                ownX = parseInt(coords[1], 10);
            allowBump = (Math.abs(ownX - x) <= 1) && (Math.abs(ownY - y) <= 1);
        }
        if (!allowBump)
        {
            showStatus(`Cannot crowd with other player @ ${x}, ${y}! Go elsewhere~`);
        }
        else
        {
            bumpMode = true;
            playerPositions.forEach((spot, playerId) => {
                if (cellId === spot)
                {
                    bumpingWho = playerId;
                }
            });
            showStatus(`You can now bump the other player (${PLAYERS[bumpingWho]}) @ ${x}, ${y} away! Choose a new space to place them!`);
        }
        return;
    }
    if (stairSpots[cellId] !== undefined)
    {
        //console.log(y, x, `stair`);
        showStatus(`&#129393; @ ${x}, ${y}: Admiring the stairs...`, undefined, true);

        movePlayerThere(who, cellId);
        return;
    }
    showStatus(`&#128001;&#128001; All quiet @ ${x}, ${y}`, undefined, true);
    movePlayerThere(who, cellId);
}

function showStatus(s, colour, silent)
{
    const div = $('#divStatus')[0];
    if (!colour)
    {
        div.innerHTML = s;
    }
    else
    {
        div.innerHTML = `<font color="${colour}"><b>${s}</b></font>`;
    }
    if (!silent)
        div.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
}

function appendStatus(s, colour, silent)
{
    const div = $('#divStatus')[0];
    if (!colour)
    {
        div.innerHTML += '<br>' + s;
    }
    else
    {
        div.innerHTML += '<br>' + `<font color="${colour}"><b>${s}</b></font>`;
    }
    if (!silent)
        div.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
}

function refreshCardsInDetNotes()
{
    deckPlayerMurderCards[0].innerHTML = ''; //remove all
    const cardIds = playerCardDecks[who],
        cnt = cardIds.length;
    cardIds.sort(compareNumbers);
    for (let i = 0; i < cnt; ++i)
    {
        const card = cardIds[i];
        addCardToDetNotes(card);
    }
}

function showWhoseTurn(freshStart)
{
    const s = playerString(),
        cell = $('#divWho');
    cell[0].innerHTML = `${s} turn...`;
    cell.addClass('pulsate_once');
    $('#spanWhose')[0].innerHTML = s;
    setTimeout(() => {
        cell.removeClass('pulsate_once');
    }, 1000);

    if (lastPlayer === who)
    {
        return; //no change in player, so no need to swap UI data
    }
    whereAmI(who, true, true);
    //also update shared player data UIs, like deckPlayerMurderCards & Detective Notepad
    if (freshStart)
    {
        return;
    }

    refreshCardsInDetNotes();
    //saveLastPlayerDetNotes();
    restoreCurPlayerDetNotes();
    updateDetNotesClueStyle();
    lastPlayer = who;
}

function saveLastPlayerDetNotes(playerId)
{
    playerId ??= lastPlayer;
    if (playerId < 0) return;

    //save last player's data
    createPlayerData(playerId);
    let i, j, p;
    const notepad = playersData[playerId].notepad;
    for (i = 0; i < 3; ++i)
    {
        for (j = 0; j < 9; ++j)
        {
            const key = `${i}${j}`;
            for (p = 0; p < 6; ++p)
            {
                const key2 = `#p${p}${key}`;
                notepad[key2] = $(key2)[0].checked;
            }
        }
        for (j = 0; j < 4; ++j)
        {
            const key = `#select_${i}_${j}`;
            notepad[key] = $(key)[0].value;
        }
        let key = `#select${i}`;
        notepad[key] = $(key)[0].value;
        key = `#detNoteCardHolder${i}`;
        notepad[key] = $(key)[0].value;
        key = `#detNoteSheet${i}`;
        notepad[key] = $(key)[0].value;
    }
    notepad['clueStyle'] = $('#radDetectiveSmartEasy')[0].checked? 1:
        ($('#radDetectiveSmart')[0].checked? 2: 3);
}

//suppress: prevent undoing radio button selection
function restoreCurPlayerDetNotes(suppress)
{
    //update to our data
    createPlayerData(who);
    let i, j, p;
    const notepad = playersData[who].notepad;
    for (i = 0; i < 3; ++i)
    {
        for (j = 0; j < 9; ++j)
        {
            const key = `${i}${j}`;
            for (p = 0; p < 6; ++p)
            {
                const key2 = `#p${p}${key}`;
                $(key2)[0].checked = (notepad[key2] === true);
            }
        }
        for (j = 0; j < 4; ++j)
        {
            const key = `#select_${i}_${j}`,
                p = $(`#detFlap${i}_${j}`),
                e = $(key)[0];
            let v = notepad[key];
            if (v === undefined) v = 'Unknown';

            e.value = v;
            if (v === 'Red')
            {
                p.css('background', '#ff1e0d');
                p.css('color', 'white');
            }
            else if (v === 'Green')
            {
                p.css('background', '#77bb41');
                p.css('color', 'white');
            }
            else if (v === 'Blue')
            {
                p.css('background', '#0061ff');
                p.css('color', 'white');
            }
            else if (v === 'Purple')
            {
                p.css('background', '#7b219f');
                p.css('color', 'white');
            }
            else if (v === 'White')
            {
                p.css('background', 'white');
                p.css('color', 'white');
            }
            else if (v === 'Yellow')
            {
                p.css('background', '#f5ec00');
                p.css('color', 'white');
            }
            else
            {
                p.css('background', 'white');
                p.css('color', 'black');
            }
        }
        let key = `#select${i}`;
        let v = notepad[key];
        if (v === undefined)
            v = 'Unknown';
        $(key)[0].value = v;

        key = `#detNoteCardHolder${i}`;
        v = notepad[key];
        if (v === undefined)
        v = 'Unknown';
        $(key)[0].value = v;
        onChangeDetNoteCardHolder(i);

        key = `#detNoteSheet${i}`;
        v = notepad[key];
        if (v === undefined)
        v = 'Unknown';
        $(key)[0].value = v;
    }
    if (!suppress) //do not undo user click/selection!
    {
        let v = notepad['clueStyle'];
        if (v === undefined) v = 1;
        if (v === 1)
        {
            $('#radDetectiveSmartEasy')[0].checked = true;
        }
        else if (v === 2)
        {
            $('#radDetectiveSmart')[0].checked = true;
        }
        else
        {
            $('#radDetectiveHardwork')[0].checked = true;
        }
    }
}

function updateDetNotesClueStyle()
{
    const e = $('.detective-card-table-clues');
    e.removeClass('detective-card-table-clues-1 detective-card-table-clues-2 detective-card-table-clues-3');
    let i = 3;
    if ($('#radDetectiveSmartEasy')[0].checked)
    {
        i = 1;
        $('.detective-card-table-clues').each((j, c) => {
            const cc = $(c),
                clues = cc.attr('clues-data-min'),
                styles = cc.attr('clues-styles-min').split(','),
                { children } = c;
            for (let k = 0; k < 4; ++k)
            {
                children[k].textContent = clues[k];
                const s = styles[k],
                    child = $(children[k]);
                s.split(';').forEach((style) => {
                    style = style.split(':');
                    child.css(style[0], style[1]);
                });
            }
        });
    }
    else //use full text
    {
        if ($('#radDetectiveSmart')[0].checked) i = 2;
        $('.detective-card-table-clues').each((j, c) => {
            const cc = $(c),
                clues = cc.attr('clues-data').split(','),
                styles = cc.attr('clues-styles').split(','),
                { children } = c;
            for (let k = 0; k < 4; ++k)
            {
                children[k].textContent = clues[k];
                const s = styles[k],
                    child = $(children[k]);
                s.split(';').forEach((style) => {
                    style = style.split(':');
                    child.css(style[0], style[1]);
                });
            }
        });
    }
    e.addClass(`detective-card-table-clues-${i}`);
}

//suppress: prevent undoing radio button selection
function refreshDetNotes(suppress)
{
    saveLastPlayerDetNotes();
    createDetectiveCard();
    restoreCurPlayerDetNotes(suppress);
}

function setShowClueNum(show)
{
    if (SHOW_CLUE_NUM !== show)
    {
        SHOW_CLUE_NUM = show;
    }
    if (SHOW_CLUE_NUM)
    {
        Object.keys(placedClues).forEach((cellId) => {
            $(`#cell_played${cellId}`)[0].innerHTML = String(placedClues[cellId]);
        });
    }
    else
    {
        Object.keys(placedClues).forEach((cellId) => {
            $(`#cell_played${cellId}`)[0].innerHTML = '';
        });
    }
}

function setAvoidBlockingRoomEntry(choice)
{
    if (AVOID_BLOCKING_ROOM_ENTRY !== choice)
    {
        AVOID_BLOCKING_ROOM_ENTRY = choice;
    }
}

function setAutopickCard(choice)
{
    if (AUTOPICK_CARD !== choice)
    {
        AUTOPICK_CARD = choice;
    }
}

function setAllowPeeks(choice)
{
    if (ALLOW_PEEKING_ANYTIME !== choice)
    {
        ALLOW_PEEKING_ANYTIME = choice;
    }
}

function resetOptions()
{
    const DEF_PLAYERS = [false, false, false, true, true, false, false, false, false];
    NUM_PLAYERS = 2;
    for (let i = 0; i < 9; ++i)
    {
        $(`#cb_player_${i}`)[0].checked = DEF_PLAYERS[i];
    }

    AVOID_BLOCKING_ROOM_ENTRY = true;
    $('#option_unblock_entry')[0].checked = true;
    AUTOPICK_CARD = false;
    $('#option_autopick_card')[0].checked = false;
    ALLOW_PEEKING_ANYTIME = false;
    $('#option_allow_peeks')[0].checked = false;
    SHOW_CLUE_NUM = false;
    $('#option_hint_clue_num')[0].checked = false;
    ignoredPlayers = {};
    newGameBoard();
}

let cachedGameBoard = false,
    cacheCardHolders = false,
    cacheClueSpots,
    cacheWeaponSlots,
    cacheBadWeaponSlots,
    cacheOrnamentSlots,
    cacheInvalidSlots,
    cacheStairSlots,
    cachePlayerPositions,
    allRoomSlots = {},
    cacheActionCards;

let clueSpots = {}, //to include ornamentSpots, after placing ornaments
    /*
    Can only have 1 weapon per room, so we need 'extra storage'.
    Allowable weapon slots in rooms only; to include clueSpots after placing clues.
    Format: { roomIdChar: { cellIds } }

    badWeaponSpots format: { cellIds }
    */
    weaponSpots = {},
    badWeaponSpots = {}, //spots that block room entrances
    ornamentSpots = {}, ///allowable garden ornament spots
    invalidSpots = {}, //outdoors
    stairSpots = {},
    placedOrns = {},
    placedClues = {},
    placedWeapons = {},
    removedOrns = {};
    removedClues = {};
    removedWeapons = {},
    playerPositions = [],
    activeClues = [];

let answers = [],
    cardHolders = [],
    //these 2 will Not be in saved game data; use it or lose it!
    cardHoldersLocks = [], //false: locked, true: open/unlocked
    numKeys = 0, //number of keys to unlock card holder flaps
    unlockedCardHolderId = -1, //and these 2 flags for AI use
    unlockedFlapId = -1,
    numPeeks = 0,
    cardsDeck = [],
    actionCardsDeck = [], //i.e. Super Clue cards
    playerCardDecks = []; //i.e. Murder cards

function genActionCards()
{
    if (!cacheActionCards)
    {
        //generate deck once
        cacheActionCards = [];
        let id = 0;
        Object.keys(ACTION_CARDS).forEach((actionStr) => {
            const data = ACTION_CARDS[actionStr],
                numCards = data[0];
            data[0] = actionStr;
            for (let i = 0; i < numCards; ++i)
            {
                cacheActionCards.push([...data, id]);
                ++id;
            }
        });
    }
    //restore from cache
    actionCardsDeck = [...cacheActionCards];
    shuffle(actionCardsDeck);
}

function updatePlayersSelection(playerId)
{
    let playerAdded = false;
    if (playerId !== undefined)
    {
        const c = $(`#cb_player_${playerId}`)[0];
        playerAdded = c.checked;
        if (!playerAdded && (Object.keys(ignoredPlayers).length >= 7))
        {
            c.checked = true;
            showStatus("Cannot remove player! As there're only 2 players!");
            return;
        }
    }
    ignoredPlayers = {};
    for (let i = 0; i < 9; ++i)
    {
        const chosen = $(`#cb_player_${i}`)[0].checked;
        if (!chosen)
            ignoredPlayers[i] = true;
    }
    NUM_PLAYERS = 9 - (Object.keys(ignoredPlayers)).length;

    if (playerId !== undefined)
    {
        if (playerAdded)
        {
            //place player token at starting point
            const c = $(`.cell_player_starter_${playerId}`)[0];
            let cellId = c.id;
            cellId = cellId.substring(4, cellId.lastIndexOf('_'));

            //check Uncommon situation where someone else has gone to and is occupying the start point
            const cell = $(`#cell${cellId}`);
            if (cell.hasClass('cell_occupied'))
            {
                const p = cellId.indexOf('_');
                //we will start 'aside' original starting point
                if (cellId.startsWith('0') || cellId.startsWith('19')) //top or bottom edge
                {
                    //shift right 1 space
                    const x = parseInt(cellId.substring(p + 1), 10) + 1;
                    cellId = `${cellId.substring(0, p)}_${x}`;
                }
                else //left or right edge
                {
                    //shift down 1 space
                    const y = parseInt(cellId.substring(0, p), 10) + 1;
                    cellId = `${y}${cellId.substring(p)}`;
                }
            }

            playerPositions[playerId] = cellId;
            $(`#cell_played${cellId}`).addClass(`cell_player_${playerId}`);
            showStatus(`${playerString(playerId)} has joined the game.`);
            whereAmI(playerId);
        }
        else //removed
        {
            const cellId = playerPositions[playerId];
            $(`#cell_played${cellId}`).removeClass(`cell_player_${playerId}`);
            $(`#cell${cellId}`).removeClass('cell_occupied');
            showStatus(`${playerString(playerId)} has left the game.`, undefined, true);
        }
    }
}

function lockAllFlaps()
{
    numKeys = 0;
    numPeeks = 0;
    for (let i = 0; i < 3; ++i)
    {
        cardHoldersLocks[i] = [ false, false, false, false ];
    }
}

function unlockAllFlaps()
{
    for (let i = 0; i < 3; ++i)
    {
        cardHoldersLocks[i] = [ true, true, true, true ];
    }
}

/*
    Inputs:
      > num of flaps.
      > card holder ID:
        0: beige, 1: green, 2: black, -1: any
        if is any, the unlockAllFlaps
      > flapId:
        0: TL, 1: BR, 2: TR, 3: BL, or -1: 'any' i.e. all flaps
*/
function unlockFlaps(numFlaps, cardHolderId, flapId)
{
    numPeeks = -numFlaps;
    //numKeys += numFlaps; //<- enable this to allow accumulate of (unused) flaps/unlock-keys
    numKeys = numFlaps; //no longer let it accumulate! as earlier keys could be for specific flaps
    unlockedCardHolderId = cardHolderId; //and these 2 flags for AI use
    unlockedFlapId = flapId;
    if (cardHolderId === -1)
    {
        unlockAllFlaps();
        return;
    }
    if (flapId < 0)
    {
        //unlock all flaps of a specific card holder
        cardHoldersLocks[cardHolderId] = [true, true, true, true];
        return;
    }
    //else unlock 1 specific flap
    cardHoldersLocks[cardHolderId][flapId] = true;
}

function joinGame(code)
{
    const cards = decodeMystery(code);
    answers = [...cards];
    cardHolders = [...cards];
    ALLOW_PEEKING_ANYTIME = true;
    $('#option_allow_peeks')[0].checked = true;
    remotePlay = true;
    showStatus(`Joined game #${code}.<br>
        Note that only the card holders are <i>synchronized</i> to the remote game,
        so use the Detective Notes and card holders only.<br>
        Begin!`);
}

//create game board
function newGameBoard()
{
    updatePlayersSelection();
    console.log(`new game for ${NUM_PLAYERS} players`);
    $('div').removeClass('choice_unavailable');
    SHOW_CLUE_NUM = $('#option_hint_clue_num')[0].checked;

    const div = $('#divPlayingArea');
    if (!cachedGameBoard)
    {
        //1. draw game board (once, then cache it (later))
        div[0].innerHTML = '';
        let s = `<table class='table_grid'>`;
        for (let y = 0; y < BOARD.length; ++y)
        {
            let row = BOARD[y];
            const numCols = row.length / 2;
            s += `<tr id='row${y}'>`;
            for (let x = 0, xx = 0; x < numCols; ++x, xx +=2)
            {
                const cellId = `${y}_${x}`,
                    cell = row.substring(xx, xx + 2),
                    cellType = cell[0];
                let styleClass = 'cell_container table_grid',
                    styleClass2 = '',
                    styleClass3 = '', //for room label
                    occupied = '',
                    styleClassPlayed = '',
                    content = '';
                if ((cellType === 'x') || (cellType === 'X'))
                {
                    styleClass += ' cell_grass';
                    if (cellType === 'X') styleClass3 += ' cell_title';
                    invalidSpots[cellId] = 0;
                }
                else if ((cellType >= '0') && (cellType <= '8'))
                {
                    playerPositions[cellType] = cellId;
                    styleClass += ` cell_player_starter_${cellType}`;
                    occupied = 'cell_occupied';
                    styleClassPlayed += ` cell_player_${cellType}`;
                    //content = PLAYERS[parseInt(cellType, 10)];
                }
                else if ((cellType >= 'A') && (cellType <= 'Z'))
                {
                    allRoomSlots[cellId] = cellType;
                    styleClass += ` cell_room${cellType}`; //background colour & image
                    if (cell[1] === 's')
                    {
                        styleClass2 += ' cell_stair_spot';
                        stairSpots[cellId] = 0;
                    }
                    else //if (cell[1] === 'r') //or 'c' or 'R'
                    {
                        if (!weaponSpots[cellType])
                        {
                            weaponSpots[cellType] = {};
                        }
                        weaponSpots[cellType][cellId] = 0;
                        const cellInfo = cell[1];
                        if ((cellInfo === 'R') || (cellInfo === 'C'))
                        {
                            badWeaponSpots[cellId] = 0;
                        }
                    }
                }
                else if (cellType === 'g')
                {
                    styleClass2 += ' cell_clue_spot';
                    ornamentSpots[cellId] = 0;
                }
                else if (cellType === 's')
                {
                    styleClass2 += ' cell_stair';
                    stairSpots[cellId] = 0;
                }

                if ((cell[1] === 'c') || (cell[1] === 'C'))
                {
                    styleClass2 += ' cell_clue_spot';
                    clueSpots[cellId] = 0;
                }
                s += `<td id='cell${cellId}_container' class='${styleClass}' onclick='cellClicked(${y}, ${x});'>
                    <div class='cell_container2'>
                        <div id="roomLabel${cellId}" class='cell_room_label${styleClass3}'></div>
                        <div style="z-index: 1;">
                            <table class='cell ${styleClass2}'><tr><td id='cell${cellId}' class='cell ${occupied}'>
                                <table class='cell'><tr><td id='cell_played${cellId}' class='cell ${styleClassPlayed}'>
                                    ${content}
                                </td></tr></table>
                            </td></tr></table>
                        </div>
                    </div>
                </td>`;
            }
            s += `</tr>`;
        }
        s += '</table>';
        div.append(s);

        //2. Label rooms
        Object.keys(LABELS).forEach((cellId) => {
            const cell = $(`#roomLabel${cellId}`);
            cell[0].innerHTML = LABELS[cellId];
        });

        PLAYERS.forEach((name, i) => {
            const cell = $(`.cell_player_starter_${i} .cell_container2 div`);
            cell[0].innerHTML = `${name}&#127808;`;
            cell.css('font-size', '0.8em');
        });

        //3. Add room's walls and windows
        const BORDER = {
            l: 'border-left',
            t: 'border-top',
            r: 'border-right',
            b: 'border-bottom'
        };
        Object.keys(WALLS).forEach((cell) => {
            WALLS[cell].split(',').forEach((info) => {
                const c = $(`#cell${cell}_container`);
                const lineStyle = (info[1] === 'W')? 'dotted': 'solid',
                    color = (info[1] === 'x')? 'brown': '#777e';
                c.css(BORDER[info[0]], `10px ${lineStyle} ${color}`);
            });
        });
        cachedGameBoard = div[0].innerHTML;
        cacheClueSpots = Object.assign({}, clueSpots);
        cacheWeaponSlots = JSON.stringify(weaponSpots); //Object.assign({}, weaponSpots);
        cacheBadWeaponSlots = Object.assign({}, badWeaponSpots);
        cacheOrnamentSlots = Object.assign({}, ornamentSpots);
        cacheInvalidSlots = Object.assign({}, invalidSpots);
        cacheStairSlots = Object.assign({}, stairSpots);
        cachePlayerPositions = [...playerPositions];
    }
    else
    {
        //draw from cache
        div[0].innerHTML = cachedGameBoard;
        clueSpots = Object.assign({}, cacheClueSpots);
        weaponSpots = JSON.parse(cacheWeaponSlots); //Object.assign({}, cacheWeaponSlots);
        badWeaponSpots = Object.assign({}, cacheBadWeaponSlots);
        ornamentSpots = Object.assign({}, cacheOrnamentSlots);
        invalidSpots = Object.assign({}, cacheInvalidSlots);
        stairSpots = Object.assign({}, cacheStairSlots);
        playerPositions = [...cachePlayerPositions];
    }
    createCardHolders();

    //3b. Generate set of action cards once
    genActionCards();

    //4. Place clues, etc.
    placedOrns = {};
    placedClues = {};
    placedWeapons = {};
    removedOrns = {};
    removedClues = {};
    removedWeapons = {};

    activeClues = [];

    //4a. Place ornaments
    let i;
    let availSlots = Object.keys(ornamentSpots);
    for (i = 0; i < ORNAMENTS.length; ++i)
    {
        const choice = randInt(availSlots.length),
            cellId = availSlots[choice];
        $(`#cell${cellId}`).addClass(`cell_orn_${ORNAMENTS[i]} cell_occupied`);
        placedOrns[cellId] = i;
        availSlots.splice(choice, 1);
    }
    //4a1. Add remaining ornament spots to clue spots
    availSlots.forEach((cellId) => {
        clueSpots[cellId] = 0;
    });

    //4b. Place clue counters
    availSlots = Object.keys(clueSpots);
    let className = 'cell_clue_counter_dummy cell_occupied'; //1st one is a dummy XD
    for (i = 0; i < CLUES.length; ++i)
    {
        const choice = randInt(availSlots.length),
            cellId = availSlots[choice],
            cell = $(`#cell${cellId}`);
        cell.addClass(className);
        className = 'cell_clue_counter cell_occupied';
        if (SHOW_CLUE_NUM)
        {
            $(`#cell_played${cellId}`)[0].innerHTML = String(i);
        }
        placedClues[cellId] = i; //base0 with false alarm clue #0
        availSlots.splice(choice, 1);
    }
    //4b1. Removed used clue spots from rooms, as weapons cannot overlap
    Object.keys(placedClues).forEach((cellId) => {
        Object.keys(weaponSpots).forEach((roomId) => {
            const room = weaponSpots[roomId];
            delete room[cellId];
        });
    });
    //4b2. If AVOID_BLOCKING_ROOM_ENTRY, remove the bad spots
    if (AVOID_BLOCKING_ROOM_ENTRY)
    {
        Object.keys(badWeaponSpots).forEach((cellId) => {
            Object.keys(weaponSpots).forEach((roomId) => {
                const room = weaponSpots[roomId];
                delete room[cellId];
            });
        });
    }

    //4c. Place weapons
    const availWeapons = [0,1,2,3,4,5,6,7,8];
    for (i = 0; i < WEAPONS.length; ++i) //same as ROOM_KEYS.length
    {
        const choice = randInt(availWeapons.length),
            wpnId = availWeapons[choice],
            room = weaponSpots[ROOM_KEYS[i]],
            placesInRoom = Object.keys(room),
            numPlacesInRoom = placesInRoom.length,
            placeChoice = randInt(numPlacesInRoom),
            cellId = placesInRoom[placeChoice],
            cell = $(`#cell${cellId}`);
        cell.addClass(`cell_wpn_${WEAPONS[wpnId]} cell_occupied cell_has_weapon`);
        placedWeapons[cellId] = wpnId;
        availWeapons.splice(choice, 1);
        delete room[cellId];
    }

    //5. Pick whodunnits
    //5a. Randomly pick each of who, what, where
    const num = (CARD_NAMES.length / 3) | 0;
    answers = [randInt(num), randInt(num) + num, randInt(num) + (2*num)];
    //5b. Shuffle into card-holders
    cardHolders = [...answers];
    shuffle(cardHolders);
    //console.log(CARD_NAMES[cardHolders[0]], CARD_NAMES[cardHolders[1]], CARD_NAMES[cardHolders[2]]);
    lockAllFlaps();
    updateGameCode();

    //5c. Place remaining cards in cardsDeck
    for (i = 0; i < CARD_NAMES.length; ++i)
    {
        if ((i === answers[0]) || (i === answers[1]) || (i === answers[2]))
            continue; //exclude earlier 3 answer cards
        cardsDeck.push(i);
    }
    shuffle(cardsDeck);
    //5d. Init empty playerCardDecks
    playerCardDecks = [];
    for (let i = 0; i < PLAYERS.length; ++i)
    {
        playerCardDecks[i] = [];
    }
    hideAllFlaps();
    //5e. Hide ignored players
    const ignored = Object.keys(ignoredPlayers);
    for (let i = 0; i < ignored.length; ++i)
    {
        const playerId = ignored[i];
        $('td').removeClass(`cell_player_${playerId}`);
        const cellId = playerPositions[playerId];
        $(`#cell${cellId}`).removeClass('cell_occupied');
    }

    //6. new game data
    playersData = [];
    for (i = 0; i < PLAYERS.length; ++i)
    {
        playersData[i] = {
            notepad: {
                //checkboxes:
                //p##: true/false
                //q##: true/false
                //combo:
                //detFlap#_#: string
            },
            clues: {
                cardHolders: [ [-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1] ],
                cardsSeen: {}
            }
        };
    }
    bumpMode = false;
    status = 'New game';
    showStatus(status);

    createSuperClueDeck();
    createDetectiveCard();

    $('#divActiveClues')[0].innerHTML = '';
    checkNoMoreActiveClue();

    //7. begin~
    who = -1;
    nextPlayer(true); //fresh start, no need to restore UI

    //8. Check for saved game
    if (localStorage.savedGame !== undefined)
    {
        showStatus(`Would you like to restore saved game?
            <button onclick="restoreSavedGame();">Yes</button>
            <button onclick="showStatus('Begin!');">No</button>`);
    }
    if (window.location.search.length > 0)
    {
        const code = new URL(window.location).searchParams.get('mys');
        if (code !== null)
        {
            appendStatus(`Would you like to "join" game #${code}?
                <button onclick="joinGame('${code}');">Yes</button>
                <button onclick="showStatus('Begin!');">No</button>`);
        }
    }
}

function enableLastCardDragAndFlip(deck)
{
    const last = deck.cards.length - 1,
        card = deck.cards[last];
    card.enableDragging();
    card.enableFlipping();
}

function takeMurderCard(playerIndex, cnt)
{
    const newCards = [];
    while ((cnt > 0) && (cardsDeck.length >= 1))
    {
        const card = cardsDeck.splice(0, 1)[0];
        playerCardDecks[playerIndex].push(card);
        --cnt;
        newCards.push(card);

        createPlayerData(playerIndex);
        playersData[playerIndex].clues.cardsSeen[card] = true;

        deckPlayerMurderCards.append(`<div class='bg_gold'>
            <div id='player${who}_mur${card}' class='card_alone'
                style='background-image: url(images/card-${CARD_IMAGES[card]}.webp); background-repeat: no-repeat;background-size: 100%;'></div></div>`);
        deckSpareMurderCards.removeCard(card);
    }
    return {
        numCardsTaken: newCards.length,
        newCardsCode: encodeCards(newCards)
    };
}

function returnMurderCards()
{
    const cards = playerCardDecks[who];
    playerCardDecks[who] = [];
    cardsDeck.push(...cards);
    cards.forEach((cardId) => {
        deckSpareMurderCards.addCard(cardId);
    });
    deckSpareMurderCards.shuffle(spareMurderCardsDeckOrder());
    deckSpareMurderCards.smear();
    deckPlayerMurderCards[0].innerHTML = '';
}

function handleActionCard()
{
    if (!curActionCard) return;

    $("#divOpenedActionCard").remove();

    //handle card
    const img = `<img style='width:120px; height:180px;' src='images/${curActionCard[3]}'/> `;
    if (curActionCard[1] === 'murderCardFromDeck')
    {
        const cnt = curActionCard[2];
        appendStatus(`You've obtained a Super Clue card: <h2>${img}Take ${cnt} murder cards from deck</h2>`);
        announceNewCardsRecv(takeMurderCard(who, cnt));
    }
    else
    {
        appendStatus(`You've obtained a Super Clue card: <h2>${img}${curActionCard[0]}</h2>`);
        if (curActionCard[1] === 'look')
        {
            unlockFlaps(curActionCard[2], -1, -1);
        }
    }
    curActionCard = false;
    checkNoMoreActiveClue();
}

function takeActionCard()
{
    //open an action card
    const card = actionCardsDeck.splice(0, 1)[0]; //open top card
    actionCardsDeck.push(card); //put back below
    curActionCard = card;

    if (AUTOPICK_CARD)
    {
        deckSuperClues.showTopCard();

        setTimeout(() => {
            deckSuperClues.flipAllToBack();
            deckSuperClues.moveTopCardToBottom();
        }, 3000);
        handleActionCard();
        return;
    }
    //else let player open the card themselves before handling its action
    appendStatus(`<div id='divOpenedActionCard' You've obtained a Super Clue card; click to open:<br><span data-tooltip='Open action card' data-tooltip-position='bottom'>
        <a href='javascript:handleActionCard();'>
            <img id='imgActionCard' style='width:120px; height:180px;' src='images/card-super-clue.webp'/></a></span></div>`);
}

function addActiveClue(div, clueObjId, clueObjName)
{
    let className = '';
    if (clueObjId < WEAPONS.length)
    {
        if (clueObjName === undefined)
        {
            clueObjName = WEAPONS[clueObjId];
        }
        className = `cell_wpn_${clueObjName}`;
    }
    else
    {
        if (clueObjName === undefined)
        {
            clueObjName = ORNAMENTS[clueObjId - 9];
        }
        className = `cell_orn_${clueObjName}`;
    }
    div.append(`<td id='active-clue-${clueObjId}' class='cell ${className}' onclick='zoomToItem(${clueObjId});'></td>`);
}

//retval: type of card => 0: person, 1: weapon, 2: room
function cardType(cardId)
{
    return (cardId / 9) | 0;
}

const CARD_TYPES = ['person', 'weapon', 'room'];
const CARD_TYPES_MAP = {
    '-1': 'unknown/any',
    0: 'person',
    1: 'weapon',
    2: 'room'};
function cardTypeName(cardId)
{
    return CARD_TYPES[cardType(cardId)];
}

const FLAP_MASK = [
    0xff000000, 0xff0000, 0xff00, 0xff
];
const FLAPS_MAP = [
    //no change
    [0,1,2,3],
    //swapped to force CC##
    [2,3,0,1]
];
/*
Identify card holder contents from seen flaps and Murder cards.

Inputs:
    flaps: [TL flap code, BR code, TR code, BL code],
    cardsSeen: { id of card seen: true },
    exclCardTypes: [...card types to exclude]
    handicap:
      0 (default): Uses the accurate-to-flap-position TL-BR-TR-BL codes, for smart analysis.
      1: Handicap of using only CC## (colour, colour, number, number) codes.
         For now, we'll still allow knowledge of the colours' top & bottom order.
         I.e. CC## is actually: Top-Colour, Bottom-Colour, Top-Number, Bottom-Number.

retval: [
    cardId if identified uniquely (-1: if no unique found; cardId o.w. within [0, 27]),
    [array of possibilities o.w.],
    [array of flaps to look at],
    typeOfCard //If single card type identified, 0: person, 1: weapon, 2: room; o.w. -1: unknown/any
]
where poss: [cardId, typeOfCard]
*/
function identify(flaps, cardsSeen, exclCardTypes, handicap)
{
    cardsSeen ??= {};
    exclCardTypes ??= [];

    let i, code, cardId;
    const unseenFlaps = []; //recommended to check out next
    //1. If all flaps seen
    if ((flaps[0] !== -1) && (flaps[1] !== -1) && (flaps[2] !== -1) && (flaps[3] !== -1))
    {
        code = ((flaps[0] & 0xff) << 24)
            | ((flaps[1] & 0xff) << 16)
            | ((flaps[2] & 0xff) << 8)
            | (flaps[3] & 0xff);
        cardId = CARD_CODES.indexOf(code);
        return [cardId, [], [], cardType(cardId)];
    }
    //2. Else tally and find possibilities
    code = 0;
    let mask = 0;
    for (i = 0, j = 24; i < 4; ++i, j -=8)
    {
        if (flaps[i] !== -1)
        {
            code |= ((flaps[i] & 0xff) << j);
            mask |= 0xff << j;
        }
        else
        {
            unseenFlaps.push(i);
        }
    }
    let flapsSwapped = 0,
        allCodes = CARD_CODES;
    if (handicap)
    {
        allCodes = CARD_CODES_HARD;
        //2b. Transform to CC##
        if ( ( (flaps[0] >= 0x07) && (flaps[0] <= 0x0c) ) //1st is number
            || ( (flaps[1] >= 0x07) && (flaps[1] <= 0x0c) ) //2nd is number
            || ( (flaps[2] >= 0x00) && (flaps[2] <= 0x06) ) //3rd is colour
            || ( (flaps[3] >= 0x00) && (flaps[3] <= 0x06) ) ) //4th is colour
        {
            //swap numbers in front 2 to the back 2
            code = ((code & 0xffff) << 16   ) | ((code >> 16) & 0xffff);
            mask = ((mask & 0xffff) << 16) | ((mask >> 16) & 0xffff);
            flapsSwapped = 1;
        }
    }
    const poss = [];
    let typeOfCard = -1;
    for (i = 0; i < allCodes.length; ++i)
    {
        if ( ((allCodes[i] & mask) === code)
            && !cardsSeen[i] )
        {
            const type = cardType(i);
            if (exclCardTypes.indexOf(type) >= 0)
            {
                continue; //skip this excluded card type,
                          //cos this card type has probably been uniquely identified in other card holder
            }
            poss.push([i, type]);
            if (poss.length === 1)
            {
                typeOfCard = type;
            }
            else if (typeOfCard !== type)
            {
                typeOfCard = -1; //found different card type, so nullify typeOfCard
            }
        }
    }
    if (poss.length === 1)
    {
        cardId = poss[0][0];
        return [cardId, [], [], typeOfCard];
    }
    //3. else better AI will further narrow down remaining unseen flaps to 'essential' unseen flaps
    //for each flap, tally the codes for all poss
    //  if same code, discard 'useless, same-same (code)' flap;
    //  else retain as useful flap.
    //       furthermore if codes are *all different*, mark it *essential and identifies uniquely*
    //                   else mark as merely *useful, but not code-breaking*.

    //iterate possible card, put a flap's code in a Set/{},
    // count if #unique_clues === #cards => *essential*
    //       else #unique_clues === 1 => totally useless, discard
    //       else => *merely useful*
    const cnt = unseenFlaps.length,
        numPossCards = poss.length;
    for (i = cnt - 1; i >= 0; --i)
    {
        const codes = new Set(),
            flapId = FLAPS_MAP[flapsSwapped][unseenFlaps[i]],
            mask = FLAP_MASK[flapId];
        poss.forEach((cardIdAndType) => {
            const cardId = cardIdAndType[0],
                code = allCodes[cardId];
            codes.add(code & mask);
        });
        const numDiff = codes.size;
        if (numDiff === numPossCards)
        {
            //retain; mark as essential
        }
        else if (numDiff === 1)
        {
            //discard flap useless, totally same info
            unseenFlaps.splice(i, 1);
        }
        else
        {
            //retain; mark as merely useful... by +10
            unseenFlaps[i] += 10;
        }
    }

    return [-1, poss, unseenFlaps, typeOfCard];
}

/*
[for explaining]
Input: as per identify() but strings accepted and auto-converted to indices for identify()
retval: [...identify's raw result, translated result]
    i.e. [-1, poss, unseenFlaps, typeOfCard, [card_identified, poss_cardnames, unseen_flap_names, type_of_card]]

Usage e.g.'s:
    Mystery ans: Poison, Ballroom, Rev Green
    identifyThis([-1, -1, -1, 'P']) //plum (5B2), pipe (5B0), billiard (7B2)
    identifyThis(['G', 'Y', -1, -1], ['Poison']) //capt (1,7), library (1,5)
    or identifyThis(['G', 'Y', -1, -1], {'Poison':true})
    identifyThis(['R', 'P', -1, -1]) //scarlett (1,4), blunderbuss (2,4), hall (0,4)
*/
function identifyThis(codes, cardsSeen, exclCardTypes, handicap)
{
    cardsSeen ??= {};
    exclCardTypes ??= [];

    //1. 'encode' clues to indices
    codes.forEach((c, i) => {
        if ('string' === typeof c)
        {
            codes[i] = ELEMENT_MAP.indexOf(c);
        }
    });
    if (cardsSeen.length !== undefined)
    {
        const m = {};
        cardsSeen.forEach((c, i) => {
            if ('string' === typeof c)
            {
                m[CARD_NAMES.indexOf(c)] = true;
            }
        });
        cardsSeen = m;
    }
    else
    {
        Object.keys(cardsSeen).forEach((c) => {
            if (c.length > 3)
            {
                delete cardsSeen[c];
                cardsSeen[CARD_NAMES.indexOf(c)] = true;
            }
        });
    }
    exclCardTypes.forEach((c, i) => {
        if ('string' === typeof c)
        {
            exclCardTypes[i] = CARD_TYPES.indexOf(c);
        }
    });
    const result = identify(codes, cardsSeen, exclCardTypes, handicap),
        resultRaw = JSON.parse(JSON.stringify(result));
    //2. 'decode' result to readable strings
    //2b. unique card?
    let i = result[0];
    if (i >= 0)
    {
        result[0] = CARD_NAMES[i];
    }

    //2b. possible cards
    i = result[1];
    i.forEach((data, j) => {
        i[j][0] = CARD_NAMES[data[0]];
        i[j][1] = CARD_TYPES[data[1]];
    });

    //2c. flaps (remaining) to look at
    i = result[2];
    i.forEach((flapId, j) => {
        let essential = false;
        if (flapId < 10)
        {
            essential = true;
        }
        else
        {
            flapId -= 10;
            resultRaw[2][j] = flapId; //revert to adjusted value of flapId with [0,3]
        }
        i[j] = CARD_HOLDER_FLAP[flapId];
        if (essential)
        {
            i[j] += '*';
        }
    });

    //2d. type of card if uniquely identified
    result[3] = CARD_TYPES_MAP[result[3]];

    //console.log(result);
    resultRaw[4] = result;
    return resultRaw;
}

const H1 = 0, H2 = 1, H3 = 2, //card holder indices for readability
    CID = 0, POSS = 1, FLAP = 2, TYPE = 3,
    VEB = 4; //verbose/interpreted

function all3CardsKnown(results, showSuggestions, actOnSuggestions)
{
    if ((results[H1][0] >= 0)
        && (results[H2][0] >= 0)
        && (results[H3][0] >= 0))
    {
        const ans = [
            //typeOfCard        cardId          cardName
            [results[H1][TYPE], results[H1][0], results[H1][VEB][0]],
            [results[H2][TYPE], results[H2][0], results[H2][VEB][0]],
            [results[H3][TYPE], results[H3][0], results[H3][VEB][0]]];
        ans.sort(compareCardTypes);
        if (showSuggestions)
        {
            appendStatus(`I know! - <span class='spanGuess' style='visibility:hidden'><b><font color='${PLAYER_COLORS[ans[0][1]]}'>${ans[0][2]}</font></b></span> used the <span class='spanGuess' style='visibility:hidden'><b>${ans[1][2]}</b></span> in the <span class='spanGuess' style='visibility:hidden'><b>${ans[2][2]}</b></span> to smash the birthday cake!
                <button id='buttRevealGuess' onclick='$(".spanGuess").css("visibility", ""); $("#buttRevealGuess").remove();'>(click here to reveal accusation)</button>
                <br>What!? I thought it was a murder??
                <br> Not at all~ it's just a strawberry jam splatter.`);
        }
        if (actOnSuggestions)
        {
            $('#select0')[0].value = ans[0][2];
            $('#select1')[0].value = ans[1][2],
            $('#select2')[0].value = ans[2][2];
            $('#buttAccuse')[0].click();
        }
        return true;
    }
    return false;
}

function identifyAgain(results, clues, handicap)
{
    const card1Type = results[H1][TYPE],
        card2Type = results[H2][TYPE],
        card3Type = results[H3][TYPE],
        types = [card1Type, card2Type, card3Type],
        newResults = [];
    if ((card1Type >= 0)
        || (card2Type >= 0)
        || (card3Type >= 0))
    {
        for (i = 0; i < 3; ++i)
        {
            const exclTypes = [...types];
            exclTypes[i] = -1;
            newResults[i] = identifyThis(
                clues.cardHolders[i],
                clues.cardsSeen,
                exclTypes,
                handicap);
        }
        //console.log('new analysis');
        return newResults;
    }
    return results;
}

/*
const FLAPS = JSON.stringify([
    [ [0, CARD_HOLDER_FLAP[0], 0], [0, CARD_HOLDER_FLAP[1], 1],
      [0, CARD_HOLDER_FLAP[2], 2], [0, CARD_HOLDER_FLAP[3], 3] ],
    [ [1, CARD_HOLDER_FLAP[0], 0], [1, CARD_HOLDER_FLAP[1], 1],
      [1, CARD_HOLDER_FLAP[2], 2], [1, CARD_HOLDER_FLAP[3], 3] ],
    [ [2, CARD_HOLDER_FLAP[0], 0], [2, CARD_HOLDER_FLAP[1], 1],
      [2, CARD_HOLDER_FLAP[2], 2], [2, CARD_HOLDER_FLAP[3], 3] ]
]);
*/
const FLAPS = '[[[0,"Top Left",0],[0,"Bottom Right",1],[0,"Top Right",2],[0,"Bottom Left",3]],[[1,"Top Left",0],[1,"Bottom Right",1],[1,"Top Right",2],[1,"Bottom Left",3]],[[2,"Top Left",0],[2,"Bottom Right",1],[2,"Top Right",2],[2,"Bottom Left",3]]]';

//talkAloud: whether to publicly announce analysis
function think(showSuggestions, actOnSuggestions, talkAloud, handicap)
{
    let i, results = [];
    let { clues } = playersData[who],
        cards = playerCardDecks[who];

    if (!remotePlay)
    {
        //update Murder Cards seen into Detective Notes
        if (actOnSuggestions)
        {
            cards.forEach((cardId) => {
                const typeId = (cardId / 9) | 0,
                    cardSubId = cardId % 9;
                $(`#p1${typeId}${cardSubId}`)[0].checked = true;
            });
        }
    }
    else
    {
        //in remote play
        //so grab data from UI instead or remembered truth
        cards = [];
        clues = {
            cardHolders: [ [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0] ],
            cardsSeen: []
        };

        let j;
        for (i = 0; i < 3; ++i)
        {
            //a. Grab seen cards
            for (j = 0; j < 9; ++j)
            {
                const seen = $(`#p1${i}${j}`)[0].checked;
                if (seen)
                {
                    cards.push(j + (i * 9));
                }
            }
            //b. Grab seen flaps
            for (j = 0; j < 4; ++j)
            {
                const value = ELEMENT_MAP2.indexOf($(`#select_${i}_${j}`)[0].value);
                clues.cardHolders[i][j] = value;
            }
        }
    }

    //1. Check flaps data to see if can uniquely identify a card in a card holder.
    for (i = 0; i < 3; ++i)
    {
        results[i] = identifyThis(
            clues.cardHolders[i],
            clues.cardsSeen,
            undefined,
            handicap);
    }
    clues.lastResults = results;
    //2. Trivial case of all 3 solved
    if (all3CardsKnown(results, showSuggestions, actOnSuggestions))
        return;

    //3a. Check if any of the 3 typeOfCard's are known. If yes, further narrow down the answer
    let results2 = identifyAgain(results, clues, handicap);
    if (results2 !== results)
    {
        results = results2;
        clues.lastResults = results;

        //3b. Re-check: Trivial case of all 3 solved
        if (all3CardsKnown(results, showSuggestions, actOnSuggestions))
            return;

        //4a. Repeat #3, one last time
        results2 = identifyAgain(results, clues, handicap);
        if (results2 !== results)
        {
            results = results2;
            clues.lastResults = results;

            //4b. Re-check: Trivial case of all 3 solved
            if (all3CardsKnown(results, showSuggestions, actOnSuggestions))
                return;
        }
    }

    //No complete solution yet

    //5. Check if 1 or 2 cards known? Recommend 1-2 flaps to look if numKeys > 0?
    const solvedHolders = [];
    let numCardsKnown = 0;
    for (i = 0; i < 3; ++i)
    {
        if (results[i][0] >= 0)
        {
            ++numCardsKnown;
            solvedHolders.push(i);
        }
    }

    const self = playerString();
    let s = (numCardsKnown > 0)? `${self} knows ${numCardsKnown} out of the 3 WWW &#x1F600;<br>`:
        `${self} don't know any of the WWW &#x1F605; Find more clues, look at more flaps!<br>`;

    //6. Collect recommended flaps to peek
    const flapsBest = [],
        flapsGood = [],
        unseenHolders = [];
    for (i = 0; i < 3; ++i)
    {
        if (results[i][0] >= 0) continue; //known, so no need to look at any more flaps for this card holder

        const unseenFlaps = results[i][VEB][FLAP];
        if (unseenFlaps.length >= 4)
        {
            //never seen any flap in this card holder!
            unseenHolders.push(i);
            continue;
        }
        unseenFlaps.forEach((flapName, j) => {
            if (flapName.endsWith('*'))
            {
                //cardHolderId, flapName. flapId
                flapsBest.push([i, flapName, results[i][FLAP][j]]);
            }
            else
            {
                flapsGood.push([i, flapName, results[i][FLAP][j]]);
            }
        });
    }

    if (showSuggestions)
    {
        if (solvedHolders.length > 0)
        {
            s += '&#x1F601; You already know the ones in these card holder(s):<ul>\n';
            solvedHolders.forEach((cardHolderId) => {
                s += `<li>${CARD_HOLDER_COLOUR[cardHolderId]}</li>\n`;
            });
            s += '</ul>';
        }
        if (unseenHolders.length > 0)
        {
            s += '&#x1F606; Try looking in these card holder(s) at least once:<ul>\n';
            unseenHolders.forEach((cardHolderId) => {
                s += `<li>${CARD_HOLDER_COLOUR[cardHolderId]}</li>\n`;
            });
            s += '</ul>';
        }
        if (flapsBest.length > 0)
        {
            s += "The <span data-tooltip-position='top' data-tooltip='just need 1 flap per card holder to identify the card!'><b>BEST</b></span> flaps to look at is/are:<ul>\n";
            flapsBest.forEach((info) => {
                s += `<li>${CARD_HOLDER_COLOUR[info[0]]}'s <b>${info[1]}</b> flap.</li>\n`
            });
            s += '</ul>';
        }
        if (flapsGood.length > 0)
        {
            s += 'A combination of some of these other flaps may also help:<ul>\n';
            flapsGood.forEach((info) => {
                s += `<li>${CARD_HOLDER_COLOUR[info[0]]}'s <b>${info[1]}</b> flap.</li>\n`
            });
            s += '</ul>';
        }
        if (talkAloud)
        {
            appendStatus(s);
        }
    }
    if (actOnSuggestions)
    {
        function tryTheseFlaps(flaps)
        {
            const numFlaps = flaps.length;
            if (numFlaps <= 0)
            {
                return false;
            }
            shuffle(flaps);
            for (let i = 0; i < numFlaps; ++i)
            {
                const choice = flaps[i],
                    cardHolderId = choice[0];
                if ((unlockedCardHolderId !== -1) && (unlockedCardHolderId !== cardHolderId))
                    continue; //cannot view desired card holder which is Not unlocked

                const flapId = choice[2];
                if ((unlockedFlapId !== -1) && (unlockedFlapId !== flapId))
                    continue; //cannot view desired flap which is Not unlocked

                //open the flap (by clicking it)
                let flapName = choice[1];
                if (flapName.endsWith('*'))
                {
                    flapName = flapName.substring(0, flapName.length - 1); //do Not let opponents know if this is an essential flap!
                }
                appendStatus(`${self} is going to look at <b>${flapName} flap</b> of the ${CARD_HOLDER_COLOUR[cardHolderId]} card holder.`);
                //$(`#cardHolder${cardHolderId}_${flapId}`)[0].click();
                clickedCardHolder(cardHolderId, flapId, false, !talkAloud);
/*
                //update to Detective Notes
                const key = `${cardHolderId}_${flapId}`,
                    selId = `#select_${key}`,
                    cardId = cardHolders[cardHolderId],
                    cardCode = CARD_CODES[cardId],
                    code = ELEMENT_MAP2[(cardCode >> (24 - (flapId * 8))) & 0xff];
                $(selId)[0].value = code;
                changeCellColour(`#detFlap${key}`, selId);
*/
                flaps.splice(0, 1);
                return true;
            }
            return false;
        }

        let choice, cardHolderId, flapId,
            numFlapsSeen = 0;
        if (numKeys > 0)
        {
            if (tryTheseFlaps(flapsBest))
            {
                ++numFlapsSeen;
            }
            else
            {
                if (tryTheseFlaps(flapsGood))
                {
                    ++numFlapsSeen;
                }
                else if (unseenHolders.length > 0)
                {
                    //try looking at flaps in any unseen card holder
                    const allFlaps = JSON.parse(FLAPS);
                    shuffle(unseenHolders);
                    cardHolderId = unseenHolders[0];
                    if (tryTheseFlaps(allFlaps[cardHolderId]))
                    {
                        ++numFlapsSeen;
                    }
                    else if (unseenHolders.length > 1)
                    {
                        cardHolderId = unseenHolders[1];
                        if (tryTheseFlaps(allFlaps[cardHolderId]))
                        {
                            ++numFlapsSeen;
                        }
                        else if (unseenHolders.length > 2)
                        {
                            cardHolderId = unseenHolders[2];
                            if (tryTheseFlaps(allFlaps[cardHolderId]))
                            {
                                ++numFlapsSeen;
                            }
                        }
                    }
                }
            }
        }
        s = '';
        if (numKeys > 0)
        {
            s = `Skipped looking at ${numKeys} flap(s).<br>`;
        }
        let s2 = [],
            numCards = cards.length;
        if (numFlapsSeen > 0)
        {
            s2.push(`${numFlapsSeen} new flap${(numFlapsSeen > 1)? 's':''}`);
        }
        if (numCards > 0)
        {
            s2.push(`${numCards} Murder Card${(numCards > 1)? 's':''}`);
        }
        if (s2.length > 0)
        {
            s2 = ` (${s2.join(' & ')})`;
        }
        for (i = 0; i < 3; ++i)
        {
            if (results[i][0] >= 0) //cardId
            {
                $(`#detNoteCardHolder${i}`)[0].value = results[i][VEB][0];
                onChangeDetNoteCardHolder(i);
            }
        }
        appendStatus(`${s}${self} has finished studying their clues${s2}.<br>`);
        if (numFlapsSeen > 0)
        {
            //iterate on new info!
            setTimeout(() => {
                think(showSuggestions, actOnSuggestions);
            }, 100);
        }
    }
}

function createPlayerData(i)
{
    if (playersData[i].notepad === undefined)
    {
        playersData[i].notepad = {};
    }
    if (playersData[i].clues === undefined)
    {
        playersData[i].clues = {};
    }
    if (playersData[i].clues.cardHolders === undefined)
    {
        playersData[i].clues.cardHolders = [ [-1,-1,-1,-1], [-1,-1,-1,-1], [-1,-1,-1,-1] ];
    }
    if (playersData[i].clues.cardsSeen === undefined)
    {
        playersData[i].clues.cardsSeen = {};
    }
}

function restoreSavedGame()
{
    const gameData = JSON.parse(localStorage.savedGame);
    let i;

    //remove all items
    $('td').removeClass('cell_occupied cell_clue_counter cell_clue_counter_dummy pulsate cell_has_weapon');
    for (i = 0; i < PLAYERS.length; ++i)
    {
        $('td').removeClass(`cell_player_${i}`);
        $('td').removeClass(`cell_wpn_${WEAPONS[i]}`);

        createPlayerData(i);
    }
    for (i = 0; i < ORNAMENTS.length; ++i)
    {
        $('td').removeClass(`cell_orn_${ORNAMENTS[i]} cell_occupied`);
    }
    let cellIds = [...Object.keys(clueSpots), ...Object.keys(ornamentSpots)];
    cellIds.forEach((cellId) => {
        $(`#cell_played${cellId}`)[0].innerHTML = '';
    });

    answers = gameData.answers;
    cardHolders = gameData.cardHolders;
    updateGameCode();

    //playerPositions, ignoredPlayers
    playerPositions = gameData.playerPositions;
    ignoredPlayers = gameData.ignoredPlayers;
    for (i = 0; i < PLAYERS.length; ++i)
    {
        const cb = $(`#cb_player_${i}`)[0];
        if (ignoredPlayers[i])
        {
            //remove player
            cb.checked = false;
        }
        else //restore player position
        {
            movePlayerThere(i, playerPositions[i]);
            cb.checked = true;
        }
    }
    NUM_PLAYERS = 9 - (Object.keys(ignoredPlayers)).length;

    //actionCardsDeck
    actionCardsDeck = gameData.actionCardsDeck;
    deckSuperClues.removeSomeCards(100);
    let cardsOrder = superCardsDeckOrder();
    cardsOrder[0].forEach((cardId) => {
        deckSuperClues.addCard(cardId);
    });
    deckSuperClues.shuffle(cardsOrder);
    deckSuperClues.smear();

    //cardsDeck
    cardsDeck = gameData.cardsDeck;
    deckSpareMurderCards.removeSomeCards(100);
    cardsOrder = spareMurderCardsDeckOrder();
    cardsOrder[0].forEach((cardId) => {
        deckSpareMurderCards.addCard(cardId);
    });
    deckSpareMurderCards.shuffle(cardsOrder);
    deckSpareMurderCards.smear();

    //placedOrns, placedClues, placedWeapons
    placedOrns = gameData.placedOrns;
    placedClues = gameData.placedClues;
    placedWeapons = gameData.placedWeapons;
    cellIds = Object.keys(placedOrns);
    cellIds.forEach((cellId) => {
        const itemId = placedOrns[cellId];
        $(`#cell${cellId}`).addClass(`cell_orn_${ORNAMENTS[itemId]} cell_occupied`);
    });
    cellIds = Object.keys(placedClues);
    cellIds.forEach((cellId) => {
        const itemId = placedClues[cellId];
        $(`#cell${cellId}`).addClass(`cell_clue_counter${itemId===0?'_dummy':''} cell_occupied`);
    });
    cellIds = Object.keys(placedWeapons);
    cellIds.forEach((cellId) => {
        const itemId = placedWeapons[cellId];
        $(`#cell${cellId}`).addClass(`cell_wpn_${WEAPONS[itemId]} cell_occupied`);
    });
    removedOrns = gameData.removedOrns;
    removedClues = gameData.removedClues;
    removedWeapons = gameData.removedWeapons;

    who = gameData.who;

    activeClues = gameData.activeClues;
    const div = $('#divActiveClues');
    div[0].innerHTML = '';
    if (activeClues.length <= 0)
    {
        checkNoMoreActiveClue();
    }
    else
    {
        activeClues.forEach((clueObjId) => {
            addActiveClue(div, clueObjId);
        });
    }

    //playersData
    playersData = gameData.playersData;
    restoreCurPlayerDetNotes();
    updateDetNotesClueStyle();

    playerCardDecks = gameData.playerCardDecks;
    deckPlayerMurderCards[0].innerHTML = '';
    playerCardDecks[who].forEach((cardId) => {
        deckPlayerMurderCards.append(`<div id='player${who}_mur${cardId}' class='card_alone'
            style='background-image: url(images/card-${CARD_IMAGES[cardId]}.webp); background-repeat: no-repeat;background-size: 100%;'></div>`);
    });

    AVOID_BLOCKING_ROOM_ENTRY = gameData.AVOID_BLOCKING_ROOM_ENTRY;
    $('#option_unblock_entry')[0].checked = AVOID_BLOCKING_ROOM_ENTRY;
    AUTOPICK_CARD = gameData.AUTOPICK_CARD;
    $('#option_autopick_card')[0].checked = AUTOPICK_CARD;
    ALLOW_PEEKING_ANYTIME = gameData.ALLOW_PEEKING_ANYTIME;
    $('#option_allow_peeks')[0].checked = ALLOW_PEEKING_ANYTIME;
    SHOW_CLUE_NUM = gameData.SHOW_CLUE_NUM;
    $('#option_hint_clue_num')[0].checked = SHOW_CLUE_NUM;
    setShowClueNum(SHOW_CLUE_NUM);

    //showWhoseTurn(true);
    nextPlayer(false, true);
    showStatus('Game restored');
}

function saveGame()
{
    const gameData = {
        answers, cardHolders,
        playerPositions, ignoredPlayers,
        actionCardsDeck,
        cardsDeck,
        placedOrns,
        placedClues,
        placedWeapons,
        removedOrns,
        removedClues,
        removedWeapons,
        activeClues,
        who,
        playerCardDecks,
        playersData,
        AVOID_BLOCKING_ROOM_ENTRY,
        AUTOPICK_CARD,
        ALLOW_PEEKING_ANYTIME,
        SHOW_CLUE_NUM
    };
    localStorage.savedGame = JSON.stringify(gameData);
}

function nextPlayer(freshStart, dontSave)
{
    if (!freshStart && !dontSave)
    {
        saveLastPlayerDetNotes(who);
        saveGame();
    }
    curActionCard = false;
    hideAllFlaps();
    lockAllFlaps();
    if (who >= 0) $(`#cell_played${playerPositions[who]}`)[0].innerHTML = '';
    lastPlayer = who;
    $('div').removeClass('bg_gold'); //unhighlight previously new murder cards in Detective's possession
    showStatus('', undefined, true);
    do
    {
        if (++who >= PLAYERS.length)
        {
            who = 0;
        }
    } while (ignoredPlayers[who]);
    showWhoseTurn(freshStart);
}

function whereAmI(playerId, dontScrollIntoView, shimmer)
{
    playerId ??= who;
    const cellId = playerPositions[playerId],
        cell = $(`#cell_played${cellId}`),
        hasSimmer = cell.hasClass('shimmer');
    if (shimmer)
    {
        $('td').removeClass('shimmer');
    }
    if (hasSimmer)
    {
        cell.removeClass('shimmer'); //remove temporarily as pulsate will conflicts with it, and woon't show o.w.
    }
    cell.addClass('pulsate');
    if (!dontScrollIntoView)
    {
        cell[0].scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    }
    setTimeout(() => {
        cell.removeClass('pulsate');
        if (shimmer || hasSimmer)
        {
            cell.addClass('shimmer');
        }
    }, 5000);
}

function zoomToItem(clueObjId)
{
    $('td').removeClass('pulsate');
    let cellId;
    function findIn(list, clueObjId)
    {
        Object.keys(list).forEach((id) => {
            if (list[id] === clueObjId)
            {
                cellId = id;
            }
        });
    }
    if (clueObjId < WEAPONS.length)
    {
        findIn(placedWeapons, clueObjId);
    }
    else
    {
        findIn(placedOrns, clueObjId - 9);
    }
    if (cellId === undefined) return;

    const cell = $(`#cell${cellId}`);
    cell.addClass('pulsate');
    cell[0].scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    setTimeout(() => {
        cell.removeClass('pulsate');
    }, 5000);
}

function gotoNotes()
{
    const div = $('#divDetectiveNotepad');
    div.css('display', '');
    div[0].scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
}

function gotoHolderInNotes(cardHolderId)
{
    const div = $('#divDetectiveNotepad'),
        focus = $(`#detFlap${cardHolderId}_3`)[0];
    div.css('display', '');
    focus.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
}


function goTop()
{
    const div = $('#divDetectiveNotepad');
    div.css('display', 'none');
    window.scrollTo(0, 0);
}

function hidePlayer()
{
    const cnt = Object.keys(ignoredPlayers).length;
    if (cnt >= 7)
    {
        showStatus('Cannot hide any more players, as only 2 players left!');
        return;
    }
    const left = who;
    ignoredPlayers[who] = true;
    const lastPos = playerPositions[who]; //cell ID
    $(`#cell_played${lastPos}`).removeClass(`cell_player_${who}`);
    $(`#cell${lastPos}`).removeClass('cell_occupied');
    nextPlayer();
    showStatus(`<font color="${PLAYER_COLORS[left]}"><b>${PLAYERS[left]}</b></font> is No longer playing.`);

    if (cnt === 6)
    {
        $('#divButHidePlayer').css('display', 'none');
    }
}

function hasActiveClue()
{
    return !($($('#divActiveClues')[0].children[0]).hasClass('no-active-clue'));
}

function checkNoMoreActiveClue() //and add back 'no active clue' note
{
    const div = $('#divActiveClues');
    if (div.children().length <= 0)
    {
        div.append(`<th class='no-active-clue' colspan='31'>
                    (No Active Super Clues)
                </th>`);
        appendStatus('No more active Super clues &#x1f641;');
    }
}

function removeOccupiedSlots(availSlots)
{
    for (let i = availSlots.length - 1; i >= 0; --i)
    {
        const cellId = availSlots[i],
            c = $(`#cell${cellId}`);
        if (c.hasClass('cell_occupied'))
            availSlots.splice(i, 1);
    }
}

function resetClueCounters()
{
    let i;
    //1. Replace ornaments
    let availSlots = Object.keys(ornamentSpots);
    removeOccupiedSlots(availSlots);

    let idsToReplace = Object.keys(removedOrns);
    for (i = 0; i < idsToReplace.length; ++i)
    {
        const id = parseInt(idsToReplace[i]);
        if (availSlots.length <= 0)
        {
            console.log(`WARNING: No more garden spaces for Ornament: ${ORNAMENT[id]}`);
            continue;
        }

        const choice = randInt(availSlots.length),
            cellId = availSlots[choice];
        $(`#cell${cellId}`).addClass(`cell_orn_${ORNAMENTS[id]} cell_occupied`);
        placedOrns[cellId] = id;
        availSlots.splice(choice, 1);

        delete removedOrns[id];
    }
    //Add remaining ornament spots to clue spots
    clueSpots = Object.assign({}, cacheClueSpots);
    availSlots.forEach((cellId) => {
        clueSpots[cellId] = 0;
    });

    //2. Replace clue counters
    availSlots = Object.keys(clueSpots);
    removeOccupiedSlots(availSlots);

    idsToReplace = Object.keys(removedClues);
    for (i = 0; i < idsToReplace.length; ++i)
    {
        const id = parseInt(idsToReplace[i], 10);
/*
        if (availSlots.length <= 0) //impossible
        {
            console.log(`WARNING: No more clue spots for clue counter #${id}`);
            continue;
        }
*/
        const choice = randInt(availSlots.length),
            cellId = availSlots[choice],
            cell = $(`#cell${cellId}`),
            className = (id !== 0)? 'cell_clue_counter cell_occupied':
                'cell_clue_counter_dummy cell_occupied';
        cell.addClass(className);
        if (SHOW_CLUE_NUM)
        {
            $(`#cell_played${cellId}`)[0].innerHTML = String(id);
        }
        placedClues[cellId] = id;
        updateClueAvail(id, true);
        availSlots.splice(choice, 1);
    }
    removedClues = {};

    weaponSpots = JSON.parse(cacheWeaponSlots); //Object.assign({}, cacheWeaponSlots);
    const rooms = Object.keys(weaponSpots);
    for (let index = rooms.length - 1; index >= 0; --index)
    {
        const roomId = rooms[index],
            room = weaponSpots[roomId];

        //check if any (other) weapon already in room
        let cell_has_weapon = false;
        Object.keys(room).forEach((cellId) => {
            const c = $(`#cell${cellId}`);
            if (c.hasClass('cell_has_weapon'))
                cell_has_weapon = true;
        });
        if (cell_has_weapon)
        {
            //console.log(`Room ${roomId} already has weapon`); //DEBUG
            rooms.splice(index, 1);
        }
        else
        {
            //console.log(`Room ${roomId} has NO weapon`); //DEBUG
            removeOccupiedSlots(room);
        }
    };
    //Removed used clue spots from rooms, as weapons cannot overlap
    Object.keys(placedClues).forEach((cellId) => {
        rooms.forEach((roomId) => {
            const room = weaponSpots[roomId];
            delete room[cellId];
        });
    });

    //3. Replace weapons - need to find empty rooms!
    idsToReplace = Object.keys(removedWeapons);
    shuffle(rooms); //shuffle then just place sequentially
    for (i = 0; i < idsToReplace.length; ++i)
    {
        const id = parseInt(idsToReplace[i], 10);
        const room = weaponSpots[rooms[i]],
            placesInRoom = Object.keys(room),
            numPlacesInRoom = placesInRoom.length,
            placeChoice = randInt(numPlacesInRoom),
            cellId = placesInRoom[placeChoice],
            cell = $(`#cell${cellId}`);
        cell.addClass(`cell_wpn_${WEAPONS[id]} cell_occupied cell_has_weapon`);
        placedWeapons[cellId] = id;

        delete removedWeapons[id];
    }
    appendStatus('Finished resetting clue counters &#x1F604;');
}

function accuse()
{
    let culprit = $('#select0')[0].value,
        what = $('#select1')[0].value,
        where = $('#select2')[0].value;
    if (culprit === 'Unknown')
    {
        showStatus('You cannot accuse No one!!');
        return;
    }
    if (what === 'Unknown')
    {
        showStatus('You cannot accuse without identifying the murder weapon!!');
        return;
    }
    if (where === 'Unknown')
    {
        showStatus('You cannot accuse without knowing where!!');
        return;
    }
    appendStatus(`${playerString()} accuses <span class='spanGuess' style='visibility:hidden'><b>${playerString(CARD_NAMES.indexOf(culprit))}</b></span> of using <span class='spanGuess' style='visibility:hidden'><b>${what}</b></span> in the <span class='spanGuess' style='visibility:hidden'><b>${where}</b></span>...
        <button id='buttRevealGuess' onclick='$(".spanGuess").css("visibility", ""); $("#buttRevealGuess").remove();'>(click here to reveal accusation)</button>`);
    culprit = CARD_NAMES.indexOf(culprit);
    what = CARD_NAMES.indexOf(what);
    where = CARD_NAMES.indexOf(where);

    const guess = [culprit, what, where], //.sort(),
        ans = [...answers].sort(compareNumbers);

    let solved = true;
    for (let i = 0; i < 3; ++i)
    {
        if (guess[i] !== ans[i])
        {
            solved = false;
            break;
        }
    }

    //console.log('Accuse', culprit, what, where, solved);

    if (solved)
    {
        appendStatus(`<h2>Congratulations! You are Right! &#x1F601;</h2>
            <br><button onclick="showAllFlaps(true);">Show Answer</button>
            <br>${htmlGiveUpButt}`);
        returnMurderCards();
    }
    else
    {
        appendStatus(`<h3>Yikes! You are Wrong! &#x1F62C;</h3>
            <br><button onclick="showAllFlaps(true);">Show Answer</button>
            <br>${htmlGiveUpButt}`);
    }
}

//const htmlGiveUpButt = `<button id='buttHideAns' onclick="hideAllFlaps(); $('#buttHideAns').remove();">Hide Answer</button>`;
const htmlGiveUpButt = `<button id='buttHideAns' onclick="hideAllFlaps();">Hide Answer</button>`;
function giveUp()
{
    showStatus(`You've given up!? &#128517;<br>${htmlGiveUpButt}`);
    showAllFlaps(true);
}

function toggleView(divName)
{
    const d = $(`#${divName}`);
    if (d.css('display') === 'none')
    {
        d.css('display', '');
    }
    else
    {
        d.css('display', 'none');
    }
}

function onDiceRolled(diceId, val)
{
    let msg = '';
    if (diceOne.val === diceTwo.val)
    {
        msg = 'Doubles: you may re-roll if desired.<br>';
    }
    if ((diceOne.val === 6) && (diceTwo.val === 6))
    {
        msg += '6+6: Resetting all clue counters, etc.';
        resetClueCounters();
    }
    $(`#cell_played${playerPositions[who]}`)[0].innerHTML = diceString();
    showStatus(msg);
}

function createDice()
{
    if ($('#dice1').length > 0) return;
    const div = $('.dice-container');
    div.append($(Dice.html('dice1')));
    div.append($(Dice.html('dice2')));
    $(document).ready(() => {
        if (!diceOne)
        {
            //diceOne = new Dice('dice1', true, () => { Dice.rollDice('dice2'); });
            //diceTwo = new Dice('dice2', true, () => { Dice.rollDice('dice1'); });
            diceOne = new Dice('dice1', true);
            diceTwo = new Dice('dice2', true);
            diceOne.link(diceTwo);
            diceOne.rollHandler = onDiceRolled;
        }
    });
}

//retrieve order for ordering Deck. Note that order is reversed
function superCardsDeckOrder()
{
    const order = actionCardsDeck.map((c) => c[3]);
    return [order.reverse()];
}

function spareMurderCardsDeckOrder()
{
    return [[...cardsDeck].reverse()];
}

let popupSuperClues,
    popupSpareMurderCards,
    popupPlayerMurderCards,
    poupupCluesList,
    popupRules;
function createSuperClueDeck()
{
    //if (popupSuperClues) popupSuperClues.close();
    if (!popupSuperClues)
    {
        deckSuperClues = Deck(18, 'superclue'); //actionCardsDeck.length is not ready
        deckSuperClues.cards.forEach(function (card, i) {
            card.enableDragging();
            card.enableFlipping();

            card.$el.addEventListener('mousedown', onTouch);
            card.$el.addEventListener('touchstart', onTouch);

            function onTouch() {
                let card;
            }
        })
        popupSuperClues = new WinBox({
            title: 'Super Clues',
            x: '70%',
            y: '10px', //1%
            width: '30%',
            height: '500px', //'10%',
            html: `
<div style="flex: 18">
        <table>
            <tr>
                <td rowspan='3'>
                    <div id='deck-container' class='deck-container'>
                </td>
                <td>
                    <button onclick='shuffleSuperClue();'>shuffle</button>
                    <button onclick='fanSuperClue();'>fan</button>
                </td>
            </tr>
            <tr><td>
                <span data-tooltip='Reveal all cards' data-tooltip-position='right'>
                    <button onclick='spreadSuperClue();'>&#x1F441;</button></span>
                <span data-tooltip='Hide/Put back all cards' data-tooltip-position='right'>
                    <button onclick='resetSuperClueDeck();'>&#x1F648;</button></span>
            </td></tr><tr><td>
            </td></tr>
        </table>
</div>`,
            oncreate: () => {
                const $container = document.getElementById('deck-container');
                deckSuperClues.mount($container);

                deckSuperClues.shuffle(superCardsDeckOrder());
                deckSuperClues.smear();
            },
            onclose: function() {
                this.minimize();
                return true;
            }
        });
    }
    else
    {
        deckSuperClues.removeSomeCards(100);
        const cardIds = superCardsDeckOrder();
        deckSuperClues.addCards(cardIds[0]);
        deckSuperClues.shuffle(cardIds);
        deckSuperClues.smear();
    }

    if (!popupSpareMurderCards)
    {
        deckSpareMurderCards = Deck(24, 'murder'); //cardsDeck.length is not ready
        deckSpareMurderCards.cards.forEach(function (card, i) {
            card.enableDragging();
            card.enableFlipping();

            card.$el.addEventListener('mousedown', onTouch);
            card.$el.addEventListener('touchstart', onTouch);

            function onTouch() {
                let card;
            }
        });
        //if (popupSpareMurderCards) popupSpareMurderCards.close();
        popupSpareMurderCards = new WinBox({
            title: 'Spare Murder Cards',
            x: '70%',
            y: `${(window.innerHeight/2)|0}px`, //'10%',
            width: '30%',
            height: '500px', //'10%',
            html: `
<div style="flex: 18">
        <table>
            <tr>
                <td rowspan='3'>
                    <div id='deck-container2' class='deck-container'>
                </td>
                <td>
                    <button onclick='shuffleSpareMurderCards();'>shuffle</button>
                    <button onclick='fanSpareMurderCards();'>fan</button>
                </td>
            </tr>
            <tr><td>
                <span data-tooltip='Reveal all cards' data-tooltip-position='right'>
                    <button onclick='spreadSpareMurderCards();'>&#x1F441;</button></span>
                <span data-tooltip='Hide/Put back all cards' data-tooltip-position='right'>
                    <button onclick='resetSpareMurderCards();'>&#x1F648;</button></span>
            </td></tr>
        </table>
</div>`,
            oncreate: () => {
                const $container = document.getElementById('deck-container2');
                deckSpareMurderCards.mount($container);

                //remove 3 answers cards (if # < 24) and put back missing 3 (last 3 cards #24, #25, #26)
                const cardsToAdd = [24, 25, 26];
                const ans = [...answers];
                ans.sort(compareNumbersBig1st);
                function replaceIfValid(id)
                {
                    if (id < 24)
                    {
                        deckSpareMurderCards.removeCard(id);
                    }
                    else
                    {
                        cardsToAdd.splice(cardsToAdd.indexOf(id), 1);
                    }
                }
                replaceIfValid(ans[0]);
                replaceIfValid(ans[1]);
                replaceIfValid(ans[2]);
                cardsToAdd.forEach((id) => {
                    deckSpareMurderCards.addCard(id);
                    enableLastCardDragAndFlip(deckSpareMurderCards);
                });

                //deckSpareMurderCards.intro();
                //deckSpareMurderCards.shuffle(true); //fake shuffle 2x for visual effect
                //deckSpareMurderCards.shuffle(true);
                deckSpareMurderCards.shuffle(spareMurderCardsDeckOrder());
                deckSpareMurderCards.smear();
            },
            onclose: function() {
                this.minimize();
                return true;
            }
        });
    }
    else
    {
        deckSpareMurderCards.removeSomeCards(100);
        const cardIds = spareMurderCardsDeckOrder();
        deckSpareMurderCards.addCards(cardIds[0]);
        deckSpareMurderCards.shuffle(cardIds);
        deckSpareMurderCards.smear();
    }

    deckPlayerMurderCards = $('#deck-container3');
    deckPlayerMurderCards[0].innerHTML = '';
}

function resetSuperClueDeck()
{
    deckSuperClues.straighten();
    deckSuperClues.flipAllToBack();
    deckSuperClues.smear();
}

function shuffleSuperClue()
{
    deckSuperClues.flipAllToBack();
    shuffle(actionCardsDeck);
    deckSuperClues.shuffle(true);
    deckSuperClues.shuffle(true);
    deckSuperClues.shuffle(superCardsDeckOrder());
    deckSuperClues.smear();
}

function resetSpareMurderCards()
{
    deckSpareMurderCards.straighten();
    deckSpareMurderCards.flipAllToBack();
    deckSpareMurderCards.smear();
}

function shuffleSpareMurderCards()
{
    deckSpareMurderCards.flipAllToBack();
    shuffle(cardsDeck);
    deckSpareMurderCards.shuffle(true);
    deckSpareMurderCards.shuffle(true);
    deckSpareMurderCards.shuffle(spareMurderCardsDeckOrder());
    deckSpareMurderCards.smear();
}

function fanSuperClue()
{
    deckSuperClues.fan();
}

function spreadSuperClue()
{
    deckSuperClues.flipAllToFront();
    deckSuperClues.spread();
}

function fanSpareMurderCards()
{
    deckSpareMurderCards.fan();
}

function spreadSpareMurderCards()
{
    deckSpareMurderCards.flipAllToFront();
    deckSpareMurderCards.spread();
}

/*
holder#:
  0: beige, 1: green, 2: black
flap:
  0: TL, 1: BR, 2: TR, 3: BL
permaShow:
  true: leave flap open permanently
quiet:
  true: for AI use to Not show what's under the flap, i.e. peek secretly

*/
function clickedCardHolder(cardHolderId, flapId, permaShow, quiet)
{
    const flapElem = $(`#cardHolder${cardHolderId}_${flapId}`);

    function closeFlap()
    {
        flapElem.css('background', '');
        flapElem.css('color', '');
        flapElem[0].textContent = '?';
        flapElem.removeClass('flap_open flap_being_viewed');
    }
    if (flapElem.hasClass('flap_open'))
    {
        closeFlap();
        return;
    }

    if (!permaShow && !ALLOW_PEEKING_ANYTIME)
    {
        //check if any keys available
        if (numKeys <= 0)
        {
            appendStatus('Are you trying to cheat? - No unlocks available! &#x1F9D0;');
            return;
        }
        //check if flap is unlocked
        if (!cardHoldersLocks[cardHolderId][flapId])
        {
            appendStatus(`${CARD_HOLDER_FLAP[flapId]} flap of ${CARD_HOLDER_COLOUR[cardHolderId]} is locked. Are you peeking at the right holder and/or flap? &#x1F914;`);
            return;
        }
    }
    if (--numKeys < 0)
    {
        numKeys = 0;
    }

    const cardId = cardHolders[cardHolderId],
        cardCode = CARD_CODES[cardId];
    //console.log('Clicked flap:', cardHolderId, flap, 'card:', CARD_NAMES[cardId], cardCode);

    let code = 0;
    switch (flapId)
    {
        case 0:
            code = (cardCode >> 24) & 0xff;
            break;
        case 1:
            code = (cardCode >> 16) & 0xff;
            break;
        case 2:
            code = (cardCode >> 8) & 0xff;
            break;
        default:
        //case 3:
            code = cardCode & 0xff;
            break;
    }
    if (!quiet)
    {
        flapElem.addClass('flap_open');
        if (code < ELEMENT_COLOURS.length)
        {
            flapElem.css('background', ELEMENT_COLOURS[code]);
            flapElem[0].innerHTML = '';
        }
        else
        {
            flapElem.css('background', 'white');
            flapElem.css('color', 'black');
            flapElem[0].innerHTML = ELEMENT_MAP[code];
        }
    }
    else
    {
        flapElem.addClass('flap_being_viewed');
        flapElem[0].innerHTML = '&#x1F441;';
    }
    if (!permaShow)
    {
        createPlayerData(who);
        playersData[who].clues.cardHolders[cardHolderId][flapId] = code;

        //update to Detective Notes
        const key = `${cardHolderId}_${flapId}`,
            selId = `#select_${key}`;
        $(selId)[0].value = ELEMENT_MAP2[code];
        changeCellColour(`#detFlap${key}`, selId);

        if (!ALLOW_PEEKING_ANYTIME)
        {
            const s = (numKeys > 0)? `${numKeys} more flap peek(s) available &#x1F600;`:
                'No more peeks allowed &#x1F648;';
            appendStatus(`You've peeked at ${CARD_HOLDER_FLAP[flapId]} flap of ${CARD_HOLDER_COLOUR[cardHolderId]}. ${s}`);
        }
        else if (++numPeeks >= 3)
        {
            showStatus('&#x1F925;');
        }
        setTimeout(() => {
            closeFlap();
        }, 3000);
    }
    else
    {
        numPeeks = 0;
    }
}

function showAllFlaps(showCard) //reveal answer
{
    if (!showCard)
    {
        for (let h = 0; h < 3; ++h)
        {
            for (let f = 0; f < 4; ++f)
            {
                clickedCardHolder(h, f, true);
            }
        }
        return;
    }
    for (let i = 0; i < 3; ++i)
    {
        const parent = $(`#card-holder-container-${i}`),
            cardId = cardHolders[i];
        parent[0].innerHTML = '';
        parent.addClass(`card_${cardId} card_holder_${i}`);
        parent.css('width', '250px');
        //parent.css('height', '350px');
    }
}

function hideAllFlaps() //hide
{
    if ($(`#cardHolder0_0`).length <= 0)
    {
        //answer shown, so holders are 'trashed'. Therefore, recreate.
        createCardHolders();
        return;
    }
    for (let h = 0; h < 3; ++h)
    {
        for (let f = 0; f < 4; ++f)
        {
            const flapElem = $(`#cardHolder${h}_${f}`);
            flapElem.css('background', '');
            flapElem.css('color', '');
            flapElem[0].innerHTML = '?';
        }
        const e = $(`#cardHolder${h}_M`);
        e[0].innerHTML = solveThis[h];
        for (let i = 0; i < CARD_NAMES.length; ++i)
        {
            e.removeClass(`card_${i}`);
        }
    }
}

function onChangeDetNoteCardHolder(holderId)
{
    const cardName = $(`#detNoteCardHolder${holderId}`)[0].value,
        img = $(`#detNoteCardHolderImg${holderId}`)[0];
    if (cardName === 'Unknown')
    {
        img.src = 'images/card-unknown.webp';
        return;
    }
    const cardId = CARD_NAMES.indexOf(cardName);
    img.src = `images/card-${CARD_IMAGES[cardId]}.webp`;
}

const solveThis = [
    `<span data-tooltip='Jump to Beige card holder in Detective Notes' data-tooltip-position='left'>
        <button onclick='gotoHolderInNotes(0);' style='background:#dedea9'>(goto Notes)</button></span>`,
    `<span data-tooltip='Jump to Green card holder in Detective Notes' data-tooltip-position='left'>
        <button onclick='gotoHolderInNotes(1);' style='background:#008d00; color:white'>(goto Notes)</button></span>`,
    `<span data-tooltip='Jump to Black card holder in Detective Notes' data-tooltip-position='left'>
        <button onclick='gotoHolderInNotes(2);' style='background:#555; color:white'>(goto Notes)</button></span>`
];
const bgColors = ['#d0d09e', 'darkgreen', 'black'],
    fontColor = ['black', 'black', 'white'];
function createCardHolders()
{
    if (!cacheCardHolders)
    {
        const cardHolderColours = Object.keys(CARD_HOLDERS),
            cnt = cardHolderColours.length;
        let flapClass = 'card-holder-flap';
        for (let i = 0; i < cnt; ++i)
        {
            if (i >= 2) flapClass += '-black';
            const parent = $(`#card-holder-container-${i}`),
                c = cardHolderColours[i];
            parent.append(`
            <div id='cardHolder${i}'>
                <table style='background: ${bgColors[i]}; color: ${fontColor[i]}'>
                    <tr>
                        <td id='cardHolder${i}_0' class='${flapClass}' onclick='clickedCardHolder(${i}, 0);'>?</td><td class='card_holder_space'></td>
                        <td id='cardHolder${i}_2' class='${flapClass}' onclick='clickedCardHolder(${i}, 2);'>?</td>
                    </tr><tr>
                        <td id='cardHolder${i}_M' colspan='3' class='card_holder_middle'>${solveThis[i]}</td>
                    </tr><tr>
                        <td id='cardHolder${i}_3' class='${flapClass}' onclick='clickedCardHolder(${i}, 3);'>?</td><td class='card_holder_space'></td>
                        <td id='cardHolder${i}_1' class='${flapClass}' onclick='clickedCardHolder(${i}, 1);'>?</td>
                    </tr>
                </table>
            </div>`);
        }
        const parent = $(`#card-holder-container`)[0];
        cacheCardHolders = parent.innerHTML;
    }
    else
    {
        const parent = $(`#card-holder-container`)[0];
        parent.innerHTML = cacheCardHolders;
    }
}

function changeCellColour(id, selId)
{
    const c = $(selId),
        v = c[0].value,
        p = $(id);
    if (v === 'Red')
    {
        p.css('background', '#ff1e0d');
        p.css('color', 'white');
    }
    else if (v === 'Green')
    {
        p.css('background', '#77bb41');
        p.css('color', 'white');
    }
    else if (v === 'Blue')
    {
        p.css('background', '#0061ff');
        p.css('color', 'white');
    }
    else if (v === 'Purple')
    {
        p.css('background', '#7b219f');
        p.css('color', 'white');
    }
    else if (v === 'White')
    {
        p.css('background', 'white');
        p.css('color', 'white');
    }
    else if (v === 'Yellow')
    {
        p.css('background', '#f5ec00');
        p.css('color', 'white');
    }
    else
    {
        p.css('background', 'white');
        p.css('color', 'black');
    }
}

const CARD_STYLES = [
    "'background:#f5ec00;'",
    "'background:#ff1e0d; color:white;'",
    "'background:brown; color:white;'",
    "''",
    "'background:gray; color:white;'",
    "'background:#77bb41;'",
    "'background:#7b219f; color:white;'",
    "'background:#0061ff; color:white;'",
    "'background:pink;'",
    "'background:#fdd5d5;'",
    "'background:#ffa6a6;'",
    "'background:#fdd5d5;'",
    "'background:#ffa6a6;'",
    "'background:#fdd5d5;'",
    "'background:#ffa6a6;'",
    "'background:#fdd5d5;'",
    "'background:#ffa6a6;'",
    "'background:#fdd5d5;'",
    "'background:#7b219f; color:white;'",
    "'background:lightgreen;'",
    "'background:#0061ff; color:white;'",
    "'background:orange;'",
    "'background:#77bb41;'",
    "'background:pink;'",
    "'background:lightcyan'",
    "'background:#f5ec00;'",
    "'background:#d966d9;'"];

function createDetectiveCard()
{
    const smart = !($('#radDetectiveHardwork')[0].checked);
    let n = 0;

    let cardComboOptions = ['', '', ''];
    for (let n = 0; n < CARD_NAMES.length; ++n)
    {
        cardComboOptions[(n/9)|0] += `<option value="${CARD_NAMES[n]}" style=${CARD_STYLES[n]}>${CARD_NAMES[n]}</option>`;
    }
    /*
    Exclusions:
    > TL: P,W,Y
    > BR: R, B
    > TR: W,Y,4,5,7
    > BL: R,G,B,0,1,2
    */
    const options = [
        //TL flap exclusions: P,W,Y
        `<option value="Unknown">?</option>
        <option value="Red" style='background:#ff1e0d; color:white;'>Red</option>
        <option value="Green" style='background:#77bb41;'>Green</option>
        <option value="Blue" style='background:#0061ff; color:white;'>Blue</option>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="7">7</option>`,
        //TR exlusions: W,Y,4,5,7
        `<option value="Unknown">?</option>
        <option value="Red" style='background:#ff1e0d; color:white;'>Red</option>
        <option value="Green" style='background:#77bb41;'>Green</option>
        <option value="Blue" style='background:#0061ff; color:white;'>Blue</option>
        <option value="Purple" style='background:#7b219f; color:white;'>Purple</option>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>`,
        //BL excl: R,G,B,0,1,2
        `<option value="Unknown">?</option>
        <option value="Purple" style='background:#7b219f; color:white;'>Purple</option>
        <option value="White">White</option>
        <option value="Yellow" style='background:#f5ec00;'>Yellow</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="7">7</option>`,
        //BR excl: R, B
        `<option value="Unknown">?</option>
        <option value="Green" style='background:#77bb41;'>Green</option>
        <option value="Purple" style='background:#7b219f; color:white;'>Purple</option>
        <option value="White">White</option>
        <option value="Yellow" style='background:#f5ec00;'>Yellow</option>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="7">7</option>`];
    const symbol = ['&#129485;', '&#9876;&#65039;', '&#127968;'];

    let flapClass = 'card-holder-flap';
    for (let i = 0; i < 3; ++i)
    {
        const c = $(`#detective-card-container-${i}`);
        c.empty();

        let s = `<td><table class='detective-card-table'>
            <tr>
            </tr>
            <tr>
                <td><span data-tooltip-position='top' data-tooltip='maybe this?'>&#10004;</span></td>
                <td><span data-tooltip-position='top' data-tooltip='I have this card'>&#x270B;</span></td>
                <td style='background:#d0d09e; border-left: 2px solid black;'><span data-tooltip-position='top' data-tooltip='maybe in Beige card holder'>Be</span></td>
                <td style='background:green; color:white;'><span data-tooltip-position='top' data-tooltip='maybe in Green card holder'>G</span></td>
                <td style='background:black; color:white; border-right: 2px solid black;'><span data-tooltip-position='top' data-tooltip='maybe in Black card holder'>Bk</span></td>
                <td colspan='3'>
                    Most likely: <select id='detNoteSheet${i}'>
                        <option value="Unknown">(Unknown)</option>
                        ${cardComboOptions[i]}
                </select>&nbsp;${symbol[i]}</td>
            </tr>`;

        for (let j = 0; j < 9; ++j, ++n)
        {
            const cardCode = CARD_CODES[n],
                name = CARD_NAMES[n];
            let code1 = (cardCode >> 24) & 0xff,
                code2 = (cardCode >> 16) & 0xff,
                code3 = (cardCode >> 8) & 0xff,
                code4 = cardCode & 0xff,
                c1 = ELEMENT_MAP2[code1],
                c2 = ELEMENT_MAP2[code2],
                c3 = ELEMENT_MAP2[code3],
                c4 = ELEMENT_MAP2[code4],
                colourLeft = true;
            if (c1.length === 1)
            {
                if (!smart)
                {
                    let t1 = c1,
                        t2 = c2;
                    c1 = c3;
                    c2 = c4;
                    c3 = t1;
                    c4 = t2;
                    t1 = code1;
                    t2 = code2;
                    code1 = code3;
                    code2 = code4;
                    code3 = t1;
                    code4 = t2;
                }
                else
                    colourLeft = false;
            }
            const defStyle = 'background:white;color:black';
            let style1 = defStyle, style2 = defStyle, style3 = defStyle, style4 = defStyle; //each columns
            if (colourLeft)
            {
                //must Not have space in between, as css(' color', ...) fails >.<"
                style1 = `background:${ELEMENT_COLOURS[code1]};color:${ELEMENT_TEXT_COLOURS[code1]}`;
                style2 = `background:${ELEMENT_COLOURS[code2]};color:${ELEMENT_TEXT_COLOURS[code2]}`;
            }
            else
            {
                style3 = `background:${ELEMENT_COLOURS[code3]};color:${ELEMENT_TEXT_COLOURS[code3]}`;
                style4 = `background:${ELEMENT_COLOURS[code4]};color:${ELEMENT_TEXT_COLOURS[code4]}`;
            }
            const styleTemp = CARD_STYLES[n].substring(1),
                styleBorderLeft = "'border-left: 2px solid black;" + styleTemp,
                styleBorderRight = "'border-right: 2px solid black;" + styleTemp;
            s += `<tr style='border: 3px solid black'>
                <td class="detective-card-table-col1p" style=${CARD_STYLES[n]}><input type="checkbox" name="p0${i}${j}" id="p0${i}${j}"></td>
                <td class="detective-card-table-col1p" style=${CARD_STYLES[n]}><input type="checkbox" name="p1${i}${j}" id="p1${i}${j}"></td>
                <td class="detective-card-table-col1p" style=${styleBorderLeft}><input type="checkbox" name="p2${i}${j}" id="p2${i}${j}"></td>
                <td class="detective-card-table-col1p" style=${CARD_STYLES[n]}><input type="checkbox" name="p3${i}${j}" id="p3${i}${j}"></td>
                <td class="detective-card-table-col1p" style=${styleBorderRight}><input type="checkbox" name="p4${i}${j}" id="p4${i}${j}"></td>
                <td class="detective-card-table-col1q" style=${CARD_STYLES[n]}><input type="checkbox" name="p5${i}${j}" id="p5${i}${j}">
                <label for="q${i}${j}">${name}</label><br>
                <td class='detective-card-table-clues detective-card-table-clues-1'
                    clues-data='${c1},${c2},${c3},${c4}' clues-data-min='${c1[0]}${c3[0]}${c4[0]}${c2[0]}'
                    clues-styles='${style1},${style2},${style3},${style4}' clues-styles-min='${style1},${style3},${style4},${style2}'>
                    <div class='detective-card-table-clue' style='${style1}'>${c1}</div>
                    <div class='detective-card-table-clue' style='${style2}'>${c2}</div>
                    <div class='detective-card-table-clue' style='${style3}'>${c3}</div>
                    <div class='detective-card-table-clue' style='${style4}'>${c4}</div></td></tr>`;

            const sel = $(`#select${i}`);
            sel.append(`<option value="${name}" style=${CARD_STYLES[n]}>${name}</option>`);
        }
        s += '</tr></table></td>';
        c[0].innerHTML = s;


        if (i >= 2) flapClass += '-black';

        s = '<td style="width:20px;"></td><td>';
        s += `
            <table style='background: ${bgColors[i]}; color: ${fontColor[i]}'>
                <tr>
                    <td id='detFlap${i}_0' class='${flapClass}'>
                        <select id="select_${i}_0" onchange='changeCellColour("#detFlap${i}_0", "#select_${i}_0");'>
                            ${options[0]}
                        </select>
                    </td><td class='card_holder_space' rowspan='3' style='text-align: center;'>
                        <div><select id='detNoteCardHolder${i}' onchange='onChangeDetNoteCardHolder(${i});'>
                            <option value="Unknown">(Unknown)</option>
                            ${cardComboOptions.join(' ')}
                        </select></div>
                        <div><img id='detNoteCardHolderImg${i}' src='images/card-unknown.webp' style='width:200px'/></div>
                    </td>
                    <td id='detFlap${i}_2' class='${flapClass}'>
                        <select id="select_${i}_2" onchange='changeCellColour("#detFlap${i}_2", "#select_${i}_2");'>>
                            ${options[1]}
                        </select>
                    </td>
                </tr>
                <tr>
                    <td></td><td></td>
                </tr><tr>
                    <td id='detFlap${i}_3' class='${flapClass}'>
                        <select id="select_${i}_3" onchange='changeCellColour("#detFlap${i}_3", "#select_${i}_3");'>>
                            ${options[2]}
                        </select>
                    </td>
                    <td id='detFlap${i}_1' class='${flapClass}'>
                        <select id="select_${i}_1" onchange='changeCellColour("#detFlap${i}_1", "#select_${i}_1");'>>
                            ${options[3]}
                        </select>
                    </td>
                </tr>
            </table>`;
        c.append(s);
    }
    updateDetNotesClueStyle();
}

const RULES = `
<div id='divRules'>
(Courtesy of / recorded by <a href='https://cluepedia.fandom.com/wiki/Super_Cluedo_Challenge/Rules' target="_blank">Cluepdia Wiki</a>; with <b>my recommendations</b> for better gameplay)
<div class="mw-parser-output"><div id="toc" class="toc" role="navigation" aria-labelledby="mw-toc-heading"><input type="checkbox" role="button" id="toctogglecheckbox" class="toctogglecheckbox" style="display:none" aria-pressed='true'><div class="toctitle" lang="en" dir="ltr"><h2 id="mw-toc-heading">Contents</h2><span class="toctogglespan"><label class="toctogglelabel" for="toctogglecheckbox"></label></span></div>
<ul>
<li class="toclevel-1 tocsection-1"><a href="#Set_up"><span class="tocnumber">1</span> <span class="toctext">Set up</span></a></li>
<ul>
<li class="toclevel-2 tocsection-8"><a href="#Webpage_Play"><span class="tocnumber">1.2</span> <span class="toctext">Webpage Play</span></a></li>
<li class="toclevel-2 tocsection-9"><a href="#Partial_AI"><span class="tocnumber">1.2</span> <span class="toctext">Partial AI</span></a></li>
</ul>
<li class="toclevel-1 tocsection-2"><a href="#Gameplay"><span class="tocnumber">2</span> <span class="toctext">Gameplay</span></a>
<ul>
<li class="toclevel-2 tocsection-3"><a href="#Secret_Passages"><span class="tocnumber">2.1</span> <span class="toctext">Secret Passages</span></a></li>
<li class="toclevel-2 tocsection-4"><a href="#Accusation"><span class="tocnumber">2.2</span> <span class="toctext">Accusation</span></a>
<ul>
<li class="toclevel-3 tocsection-5"><a href="#In_a_2_player_game"><span class="tocnumber">2.2.1</span> <span class="toctext">In a 2 player game</span></a></li>
<li class="toclevel-3 tocsection-6"><a href="#In_a_game_of_more_than_2_players"><span class="tocnumber">2.2.2</span> <span class="toctext">In a game of more than 2 players</span></a></li>
<li class="toclevel-3 tocsection-7"><a href="#In_web_based_game"><span class="tocnumber">2.2.3</span> <span class="toctext">In a web-based game</span></a></li>
</ul>
</li>
</ul>
</li>
</ul>
</div>
<h2><span class="mw-headline" id="Set_up">Set up</span></h2>
<ol><li>Unfold the playing area and place it on a large flat surface.</li>
<li>Place one Weapon in each room.</li>
<li>Place the four Garden Ornaments on any four Super Cluedo spaces in the garden.</li>
<li>Place each character piece on their correct starting space.</li>
<li>Place the 30 Clue Counters on any of the Super Cluedo space. These should be placed at random, face down, indoors or in the garden (there will be some Super Cluedo spaces unused).</li>
<li>Shuffle the Super Clue Cards and place these near the board within the reach of all players.</li>
<li>One player shuffles the Character Cards and places them face down. The same is down with the Weapon Cards and finally the Room Cards. There are now three piles of cards face down. These piles must now be moved around so that no one knows which pile is which. One card is taken from each pile and the cards are placed one by one into the three Murder Card Holders.
    <ol>
    <li>Two of the corners show COLOURS which are associated with the Person, Weapon or Room. This information can be found in the Detective Note Sheets.</li>
    <li>Two of the corners show NUMBERS which are associated with the Person, Weapon or Room. This information can be found in the Detective Note Sheets.</li>
    </ol>
</li>
<li>Once the Murder Cards have been placed in the Murder Card Holders the remaining Murder Cards are shuffled together thoroughly and placed face down next to the Super Clue Cards.</li>
<li>Each player take a "wipe off" Detective Note Sheet.</li></ol>
<h3><span class="mw-headline" id="Webpage_Play">Webpage Play</span></h3>
<p>When using Neon's Cluedo webpage to play, most setup is automatically done.
</p>
<ol>
<li>Go to the bottom of the page to select players. You may still add/remove players after the game is started.</li>
<li>Refresh the page (or click the 'New Game' button) to start a new game. You will be offered the chance to (a) restore a save game if available (click the corresponding 'Yes' button), (b) join a 'remote' play  (click the corresponding 'Yes' button), or start a new game (click 'No' button or just roll the dice and go!).
    <ul>
        <li>'Remote' play is a temporary proxy for networked multiplayer.
            <ol>
                <li>A host player hosts the game on a main webpage. Share this 'main' game board using video chat.</li>
                <li>Click the 'Copy Game Link' button and send the link to the other players.</li>
                <li>The latter opens the game page in their own devices to keep notes privately. The shared game code 'mirrors' the current mystery to their device.</li>
                <li>Remote players directs the Host player to help make their moves. When a clue counter reward or Super Clue triggers:
                    <ul>
                        <li>For viewing flaps: remote players use their own device to click the 'mirrored' card holders and take notes.</li>
                        <li>For Murder cards: Host has to send the 'Cards Code' to the current remote player. The latter claims the code in the Detective Notes in their own device, and views the Murder cards obtained, and take notes.</li>
                    </ul>
                </li>
                <li>Host plays as normal on the main screen, and pauses sharing when making his private inspections and note taking.</li>
            </ol>
        </li>
    </ul>
</li>
<li>Click the dice to roll. Click the 'Find Me!' button to scroll your player token into view. Mouse over the token to recall your rolled dice numbers.</li>
<li>Click on map spaces to move. Clicking on items trigger relevant actions, which are stated at the top of the page.</li>
<li>Click '(goto Notes)' button to jump to Detective Notes section to record your findings. When finished, click the '(back to top)' button to hide your Notes and jump back to the top of the page.</li>
<li>Click 'Next Player' button to save game and pass the turn to the next player.</li>
</ol>
<h3><span class="mw-headline" id="Partial_AI">Partial AI</span></h3>
<p>To play against partial Computer Players, help it to:
</p>
<ol>
<li>Roll dice and move player token to find clue counters or active Super Clue items.</li>
<ul>
<li>If you want a 'weaker' AI, simply move its token 'more aimlessly' or take bigger detours. E.g.: Go after clues one or two turns later, so as to let human players go after the clues first! Send AI's token outside and go round the garden, LOL!</li>
</ul>
<li>When an action is available (Murder cards received or flaps available for peeking), click the 'Act Secretly' button to let the AI automatically select flaps to view, study available Murder cards and even make an accusation!</li>
<li>Click 'Next Player' to pass.</li>
</ol>
<p>If you require assistance, you may click the 'Analyze' button to get recommendations. If more help is required, you may further click on the 'Act' button to automatically select the best flaps to view, study all your clues and form accusations!
</p>
<h2><span class="mw-headline" id="Gameplay">Gameplay</span></h2>
<ol><li>Each player chooses a character and moves this piece throughout the game.</li>
<li>Choose a starting player. The first player throws both dice and then moves their character EITHER the sum of the two dice OR the number on any single dice.</li>
<li>Play continues in a clockwise direction with the next player in the same way.</li>
<li>Character pieces may be moved vertically of horizontally but not diagonally. They cannot retrace their step by going over the same space more than once during one turn. They cannot move through walls and can only enter the room through the Doors, French Windows (arrowed), or Secret Passages. (See #8 - #12).</li>
<li>If a player lands on a Clue Counter (by an exact throw only) the number is called out and the counter placed face up on the title space in the centre of the board. The player must now follow instructions given on the Detective Note as follows:    a) If the Clue involves taking a murder card from the pack or from another player this is done, taking care not to show other players any cards held. These cards are now kept by that player. The Clue Counter is then placed face down by the side of the board.       b) If the Clue involves looking under a flap (or flaps) then the player should do this so other players can see their actions but NOT the information concealed under the flap. The Clue Counter is then placed face down by the side of the board.       c) If the clue involves a clue being situated on a Weapon or in the Garden then all players must race towards the Clue. (The player who LANDED on the clue counter throws first). The first player to land on the space occupied by the Weapon or Garden Ornament in question removes it from the board and takes the top SUPER CLUE Card. The instructions are followed and the card replaced on the bottom of the pack. The Clue Counter is then placed face down by the side of the board.
    <ol>
        <li><i><b>Extra rule clarifications/recommended</b></i>:
            <ol>
                <li>To make gameplay faster, players NEED NOT all rush for the new clue of Weapon or Garden Ornament. Instead, players may choose to go after other clue counters, especially if they can't reach the clue object. I.e. every player can decide when they wish to go after and take the clue.</li>
                <li>Immediately place/discard the Clue Counter face down by the side of the board. Write the clue (Weapon or Garden Ornament) down on a whiteboard for all players to know which clue objects are active. Erase it when any player finds the clue.</li>
            </ol>
        </li>
    </ol>
</li>
<li>Any information gathered should be recorded on the Detective Note Sheet provided and kept secret from all other players. The information may be a record of what is under a certain flap or may be an elimination of a suspect due to the discovery of clues obtained from picking up Murder cards. (N.B. Use a water based felt pen when recording information).</li>
<li>If a player throws a double they have the choice of moving with that throw or ignoring it and throwing the dice again. If a double six is thrown then all Clue Counters, Weapons and Garden Ornaments are placed back onto the board (not necessarily in the positions they originally occupied but still obeying the instructions in "Setting up the Game"). If a stage is reached where there are only THREE Clue Counters remaining on the board then all the Clue Counters, Weapons and Garden Ornaments are replaced as above.</li>
<li>Players are NOT allowed to move over other Character pieces, Weapons or Garden Ornaments.</li>
<li>Players ARE allowed to move OVER, but not look at, Clue Counters during a turn.</li>
<li>Players are NOT allowed to land on other Character pieces.</li>
<li>Players are NOT allowed to land on Weapons or Garden Ornaments except when racing for a clue there.
    <i><b>Recommend</b></i>:
    <ol>
        <li><i>Weapons and Garden ornaments, and Players are <b>blockages</b>. If an aforementioned object is in the doorway or stairs (to a room), it blocks entry & exit via that way!</i>
        <li><i>Player CANNOT move over the space occupied by another player, unless agreed with each other on that turn. Without agreement, player will be blocked, and have to detour around it. With agreement, player may use 1 movement point to move onto the space and then off it. Players may NOT share and occupy the space together (at the end of the turn).</i>
    </ol>
</li>
<li>Players may move over or land on a staircase or Super Cluedo space.</li>
<li>If a player finishes a move in a room on a space ADJACENT to another player, the player entering the room can EITHER:
    <ol>
    <li>Leave the Character pieces as they are,</li>
    <li>OR Remove the other Character piece and place it ANYWHERE else in the board, EXCEPT on the spaces occupied by:- another Character piece, a Weapon, a Garden Ornament or a Clue Counter. If there is more the one player adjacent then the player entering the room has the choice of moving EITHER Character Pieces as above, but NOT both.</li>
    </ol>
</li></ol>
<h3><span class="mw-headline" id="Secret_Passages">Secret Passages</span></h3>
<p>Underneath Tudor Close there is a maze of secret passages enabling players to take short cuts around the house. The secret passages can be entered or left through any of the ten staircases (one in the centre of the board and one in each room of the house). Moves can be made in one of the following ways:
</p>
<ol><li>Players may move from one staircase to another during the course of one turn (the distance between two staircases is one space). <b>Recommend:</b> Count each move onto a stair as 1 space. Stairs in the middle of the board count as 3 separate stairs/spaces. Tip: use up excess dice throw points by jumping stairs a few times.</li>
<li>Players may move onto a staircase and stop there until their next turn. (An exact throw is not needed to do this). This staircase is then blocked until that player's next turn.</li>
<li>Players may move from one staircase to another and stop on the second staircase until their next turn. Again, an exact throw is not needed and the staircase is then blocked until that player's next turn.</li></ol>
<p>If at the start of any players turn they are occupying a staircase space they must state where they are moving to before throwing the dice. Players moving from the cellar staircase have the choice of starting from either of the two adjacent spaces. <b>Recommend:</b> For easier gameplay, let players go anywhere from the stairs, without prior declaration.
</p>
<h3><span class="mw-headline" id="Accusation">Accusation</span></h3>
<p>When a player thinks he has discovered, by means of the information collected, the following three things: (1) The Murderer (2) The Weapon used (3) The room where the crime was committed. They must write this down clearly in the Accusation Box.
</p>
<h4><span class="mw-headline" id="In_a_2_player_game">In a 2 player game</span></h4>
<p>The player making the accusation removes the cards from the holders. If the accusation is correct that player wins, if it is wrong the other player is the winner.
</p>
<h4><span class="mw-headline" id="In_a_game_of_more_than_2_players">In a game of more than 2 players</span></h4>
<p>The player making the accusation looks at the Murder Cards without the other players seeing. If the accusation is correct that player is the winner. If it is wrong then that player replaces any Murder cards in their correct envelopes. They then place any Murder Cards they may have in their hand back on the bottom of the pile and are out of the game. The other players then continue as normal.
</p>
<h4><span class="mw-headline" id="In_web_based_game">In a web-based game</span></h4>
<p><i><b>Recommend</b></i>: The computer checks the player's accusation instead of of the player themselves. Thus, if the accusation is wrong, that player may be allowed to resume play and to try to solve the mystery. Game then continue as normal.
</p>
</div>`;

function showRules()
{
    if (!popupRules)
    {
        popupRules = new WinBox({
            title: 'Rules',
            x: '10px',
            y: '100px',
            width: '70%',
            height: `${window.innerHeight - 200}px`,
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

const available = "<font color='green'>&#x2714;</font>",
    gone = "<font color='red'>&#x2718;</font>";
function updateClueAvail(clueId, inplay)
{
    if (poupupCluesList && (clueId > 0))
    {
        $(`#cc${clueId}`)[0].innerHTML = (inplay || !removedClues[clueId])? available: gone;
    }
}

function showCluesList()
{
    if (!poupupCluesList)
    {
        let s = '<h1>Available Clues</h1>\n';
        for (let i = 1; i < CLUES.length; ++i) //don't show dummy clue counter XD
        {
            s += `<span id='cc${i}' class='clue_counter_info'>${removedClues[i]? gone:available}</span> ${i}. ${CLUES[i][0]}<br>\n`;
        }

        poupupCluesList = new WinBox({
            title: 'Available Clues',
            x: '10px',
            y: '100px',
            width: '50%',
            height: `${window.innerHeight - 200}px`,
            html: s,
            onclose: function() {
                this.minimize();
                return true;
            }
        });
    }
    else
    {
        $('.clue_counter_info').each((i, c) => {
            c.innerHTML = removedClues[i+1]? gone: available;
        });
        poupupCluesList.restore();
    }
}

$(document).ready(() => {
    const div = $('#divPlayingArea')[0];
    AVOID_BLOCKING_ROOM_ENTRY = $('#option_unblock_entry')[0].checked;
    AUTOPICK_CARD = $('#option_autopick_card')[0].checked;
    ALLOW_PEEKING_ANYTIME = $('#option_allow_peeks')[0].checked;

    createDice();
    createDetectiveCard();
    newGameBoard();
});
