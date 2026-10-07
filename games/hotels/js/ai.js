//Computer ('AI') players for Hotels: who they are, and what they choose whenever the game asks (see ask() in hotels.js).
//A level is a set of traits; the choices themselves are the same code for all levels.

const AI_LEVELS = { friendly: 'Friendly', aggressive: 'Aggressive' }; //1st is the default
const AI_TRAITS = {
    friendly: {
        reserve: 3000, //least cash it likes to keep in hand after buying something
        caution: 1, //and how much of a 4 night stay at the opponents' dearest hotel it keeps in hand as well
        buysAbove: 0, //buys the Bank's land if it scores at least this (aiBuyChoice)
        //and an opponent's bare land, by compulsory purchase, if it scores at least this. Same bar as Aggressive; but with its
        //lower blockWeight the land has to be worth it for itself, not for what it takes from the opponent
        takesOwnedLand: 0.6,
        blockWeight: 0.3, //how much taking entrance spots from opponents' hotels counts in choosing land
        bareLandLimit: 2, //plots without a main building it holds at a time
        maxPhases: 1, //extensions it applies for at a time
        bidShare: 0.5, //most it bids at an auction, as a share of what the hotel cost to set up
        hogChance: 0.4, //how often it puts an entrance where an opponent's hotel could have one, to deny it
        ambushChance: 0.1, //how often it looks for a spot right ahead of opponents' cars
        forgetsFee: 0.2 //how often it forgets to claim the fee from a guest
    },
    aggressive: {
        reserve: 3000,
        caution: 1,
        buysAbove: 0.25, //passes up the poorest land
        takesOwnedLand: 0.6, //only for a top hotel, or to get in the way of an opponent's
        blockWeight: 1,
        bareLandLimit: 2,
        maxPhases: 3,
        bidShare: 0.8,
        hogChance: 1,
        ambushChance: 0.5,
        forgetsFee: 0.05
    }
};
const AI_BUSY_WORDS = { //shown while it makes up its mind, by kind of question
    roll: 'reaching for the die',
    rollNights: 'throwing for the nights',
    permission: 'throwing the permission die',
    bid: 'considering a bid',
    entranceSpot: 'choosing a spot for the entrance'
};

let aiPlayers = {}; //{ playerId: level }

//@return level of given player if it is a computer player; else undefined
function aiLevel(playerId)
{
    return aiPlayers[playerId];
}

function aiFloor(amount)
{
    return amount - (amount % BID_STEP);
}

//Cash that given computer player wants to keep in hand: more, the dearer the opponents' hotels are to stay at
function aiReserve(playerId)
{
    const traits = AI_TRAITS[aiLevel(playerId)];
    let threat = 0;
    Object.keys(hotelsOwners).forEach((hotel) => {
        const live = hotelOf(hotel);
        if ((hotelsOwners[hotel] !== playerId) && (live.built > 0) && (live.entrances.length > 0))
        {
            threat = Math.max(threat, HOTELS_DATA[hotel].rent[live.built - 1][3]);
        }
    });
    return Math.max(traits.reserve, threat * traits.caution);
}

//What it cost to set a hotel up as it stands: land, buildings and entrances
function aiHotelWorth(hotel)
{
    const data = HOTELS_DATA[hotel],
        live = hotelOf(hotel);
    return data.land + buildCost(hotel, 0, live.built) + (live.entrances.length * data.entrance);
}

//Fee for 1 night at given hotel: as it stands (at least its main building), or when fully built
function aiNightly(hotel, whenFull)
{
    const data = HOTELS_DATA[hotel],
        live = hotelOf(hotel),
        built = whenFull? data.build.length: Math.max(1, live? live.built: 1);
    return data.rent[built - 1][0];
}

/*
How lucrative a hotel is, about 0.2 to 0.8: half for what it pays per dollar put into it, half for what it pays outright.
Fully built with all its entrances; comes out as Boomerang (cheap, many entrances), Le Grand (most entrances),
President (dearest stays), Park Royal, Waikiki, Fujiyama, Safari, Taj Mahal.
*/
function aiHotelLucre(hotel)
{
    const data = HOTELS_DATA[hotel],
        phases = data.build.length,
        pays = data.rent[phases - 1][0] * data.maxEntrances;
    return (0.5 * Math.min(1, (pays / (data.land + buildCost(hotel, 0, phases))) / 1.4)) + (0.5 * Math.min(1, pays / 6750));
}

//The other hotel that could put an entrance on given road space, if any
function aiRivalAt(hotel, spot)
{
    const info = ROAD[spot],
        other = (info[INDEX_HOTEL_L] === hotel)? info[INDEX_HOTEL_R]: info[INDEX_HOTEL_L];
    return (isHotel(other) && (HOTELS_DATA[other].entrances.indexOf(spot) >= 0))? other: undefined;
}

/*
What owning given hotel would do to the opponents' hotels across the road from it: each entrance put on a spot
they share is one that theirs can never have (and one more safe space to land on).
About 0 to 1: the share of each such hotel's entrance spots that could still be taken, weighted by how dear a stay there gets.
*/
function aiBlockValue(playerId, hotel)
{
    const shared = {};
    freeEntranceSpots(hotel).forEach((spot) => {
        const rival = aiRivalAt(hotel, spot);
        if ((rival !== undefined) && (owner(rival) >= 0) && (owner(rival) !== playerId))
        {
            shared[rival] = (shared[rival] || 0) + 1;
        }
    });
    return Object.keys(shared).reduce((sum, rival) =>
        sum + ((shared[rival] / HOTELS_DATA[rival].maxEntrances) * (aiNightly(rival, true) / 1100) * (isBuilt(rival)? 1: 0.6)), 0);
}

/*
How good given road space is for the next entrance of given hotel.
@param hogs (bool) out to take spots that an opponent's hotel could use
@param ambushes (bool) out to catch the cars that are about to come by
*/
function aiSpotScore(playerId, hotel, spot, hogs, ambushes)
{
    const rival = aiRivalAt(hotel, spot);
    let score = Math.random() * 0.2;
    if (ambushes)
    {
        playingIds().forEach((id) => {
            if (id === playerId) return;
            const pos = (typeof playerPositions[id] === 'number')? playerPositions[id]: -1,
                ahead = (spot - pos + ROAD.length) % ROAD.length;
            if ((ahead >= 1) && (ahead <= 6))
            {
                score += 0.8; //that car may well stop here on its next throw; but it will soon be gone
            }
        });
    }
    if (rival === undefined)
    {
        score += 0.5; //no one else has a use for this spot
    }
    else if (owner(rival) === playerId)
    {
        //own hotels on both sides of the road: the spot goes to the one that is dearer to stay at
        score += (aiNightly(hotel, true) >= aiNightly(rival, true))? 1: -3;
    }
    else if (owner(rival) >= 0)
    {
        score += hogs? 3 + (aiNightly(rival, true) / 400): 0; //one entrance less for an opponent's hotel, for good
    }
    else
    {
        score += hogs? 1: 0; //whoever buys that land later finds the spot gone
    }
    return score;
}

function aiBestSpot(playerId, hotel, spots)
{
    const traits = AI_TRAITS[aiLevel(playerId)],
        hogs = Math.random() < traits.hogChance,
        ambushes = Math.random() < traits.ambushChance;
    let best, bestScore = -Infinity;
    spots.forEach((spot) => {
        const score = aiSpotScore(playerId, hotel, spot, hogs, ambushes);
        if (score > bestScore)
        {
            best = spot;
            bestScore = score;
        }
    });
    return best;
}

/*
What to apply to build. Whatever it applies for, it can pay for even if the die doubles the price: it never has to sell for it.
Bare land comes first, main building only: that secures the title deed and lets the hotel take entrances.
Extensions wait until the hotel has an entrance to earn with, and must leave the reserve whole even at double price,
so that there is cash for the next title deed, main building or entrance.
@return ({ hotel, count }) or undefined if nothing is within its means
*/
function aiBuildPlan(playerId)
{
    const traits = AI_TRAITS[aiLevel(playerId)],
        data = playersData[playerId],
        reserve = aiReserve(playerId);
    let best, bestScore = -Infinity;
    hotelsCanApply(playerId).forEach((hotel) => { //not a hotel that was refused on this space
        const live = data.hotels[hotel],
            info = HOTELS_DATA[hotel],
            bare = (live.built <= 0),
            left = bare? 1: ((live.entrances.length > 0)? Math.min(info.build.length - live.built, traits.maxPhases): 0);
        let count = 0;
        for (let k = 1; k <= left; ++k)
        {
            const atDouble = buildCost(hotel, live.built, k) * 2;
            if ((atDouble > data.money) || (!bare && ((data.money - atDouble) < reserve))) break;
            count = k;
        }
        if (count <= 0) return;
        const cost = buildCost(hotel, live.built, count),
            before = bare? 0: info.rent[live.built - 1][0],
            gain = (info.rent[live.built + count - 1][0] - before) * (live.entrances.length + 1) / cost,
            score = bare? 100 + aiHotelLucre(hotel) + aiBlockValue(playerId, hotel): gain;
        if (score > bestScore)
        {
            best = { hotel, count };
            bestScore = score;
        }
    });
    return best;
}

/*
Which land to buy, if any: for what the hotel earns (aiHotelLucre) and for what it takes from opponents' hotels (aiBlockValue).
An opponent's bare land is taken only when that serves a purpose: the score must reach traits.takesOwnedLand.
@return id of the 'buy land' option to take, or undefined
*/
function aiBuyChoice(playerId, options)
{
    const traits = AI_TRAITS[aiLevel(playerId)],
        data = playersData[playerId],
        bare = hotelsOf(playerId).filter((hotel) => data.hotels[hotel].built <= 0).length;
    let best, bestScore = -Infinity;
    if (bare >= traits.bareLandLimit) return undefined;
    options.forEach((option) => {
        if (!option.id.startsWith('buy:') || option.disabled) return;
        const hotel = option.id.substring(4),
            { price, from } = landPrice(hotel),
            score = aiHotelLucre(hotel) + (traits.blockWeight * aiBlockValue(playerId, hotel));
        if (score < ((from !== BANK_ID)? traits.takesOwnedLand: traits.buysAbove)) return;
        if (data.money - price < aiReserve(playerId)) return;
        //no use in land whose main building is out of reach for long: it must be payable at double price after a round or so
        if ((HOTELS_DATA[hotel].build[0] * 2) > (data.money - price + BANK_BONUS)) return;
        if (score > bestScore)
        {
            best = option.id;
            bestScore = score;
        }
    });
    return best;
}

//Choose among what a turn offers: free things first, then what earns soonest
function aiMenuChoice(playerId, q)
{
    const reserve = aiReserve(playerId),
        data = playersData[playerId],
        open = q.options.filter((option) => !option.disabled),
        has = (id) => open.some((option) => option.id === id);
    if (has('freeEntrance')) return 'freeEntrance';
    if (has('freePhase')) return 'freePhase';
    for (const option of open)
    {
        const hotel = option.id.substring(option.id.indexOf(':') + 1);
        if (option.id.startsWith('entrance:') && (data.money - HOTELS_DATA[hotel].entrance >= reserve / 2))
        {
            return option.id;
        }
        if (option.id.startsWith('leisure:'))
        {
            const { build } = HOTELS_DATA[hotel];
            if (data.money - build[build.length - 1] >= reserve) return option.id;
        }
    }
    if (has('build') && aiBuildPlan(playerId)) return 'build';
    return aiBuyChoice(playerId, open) || 'end';
}

function aiBid(playerId, q)
{
    const traits = AI_TRAITS[aiLevel(playerId)],
        data = playersData[playerId],
        worth = aiHotelWorth(q.hotel),
        limit = Math.min(q.max, aiFloor(worth * traits.bidShare), aiFloor(data.money - (aiReserve(playerId) / 2)));
    if (limit < q.min) return 0;
    const bid = (q.highBidder < 0)? aiFloor(worth * 0.2): q.min + aiFloor(worth * 0.05);
    return Math.max(q.min, Math.min(limit, bid));
}

/*
The choice of a computer player.
@param q (object) the question, as given to ask(); by q.kind:
    roll, rollNights, permission: throw a die. Nothing to choose
    menu: what to do on this turn, of q.options: 'buy:<hotel>', 'build', 'freeEntrance', 'freePhase',
        'entrance:<hotel>' (bought on passing the Town Hall), 'leisure:<hotel>', 'sell', 'end'
    buildWhich, buildHowMany: hotel and number of phases to apply for
    phaseWhich, entranceWhich: hotel that gets the free phase / the entrance
    entranceSpot: road space for the entrance of q.hotel
    sellWhich: hotel to auction; q.forced if it must
    bid: amount for q.hotel, from q.min to q.max; 0 to pass
@return id of the option chosen, or the amount of the bid
*/
function aiDecide(playerId, q)
{
    const data = playersData[playerId],
        ids = (q.options || []).filter((option) => !option.disabled).map((option) => option.id),
        hotels = ids.filter((id) => (typeof id === 'string') && (id !== ''));
    let plan;
    switch (q.kind)
    {
    case 'menu':
        return aiMenuChoice(playerId, q);
    case 'buildWhich':
        plan = aiBuildPlan(playerId);
        return plan? plan.hotel: '';
    case 'buildHowMany':
        plan = aiBuildPlan(playerId);
        return (plan && (plan.hotel === q.hotel))? plan.count: 0;
    case 'phaseWhich':
        //main building of bare land 1st; else the phase worth most
        hotels.sort((a, b) => {
            const bareA = (data.hotels[a].built <= 0)? 1: 0,
                bareB = (data.hotels[b].built <= 0)? 1: 0;
            return (bareB - bareA) || (HOTELS_DATA[b].build[data.hotels[b].built] - HOTELS_DATA[a].build[data.hotels[a].built]);
        });
        return hotels[0];
    case 'entranceWhich':
        //where an entrance adds most: high fee per night, few entrances so far; and where it can take a spot from an opponent's hotel
        hotels.sort((a, b) => {
            const pays = (hotel) => (HOTELS_DATA[hotel].rent[data.hotels[hotel].built - 1][0] / (data.hotels[hotel].entrances.length + 1))
                * (1 + aiBlockValue(playerId, hotel));
            return pays(b) - pays(a);
        });
        return hotels[0];
    case 'entranceSpot':
        return aiBestSpot(playerId, q.hotel, ids.filter((id) => id >= 0));
    case 'sellWhich':
        if (!q.forced) return '';
        hotels.sort((a, b) => aiHotelWorth(a) - aiHotelWorth(b)); //part with the least
        return hotels[0];
    case 'bid':
        return aiBid(playerId, q);
    default:
        return ids[0];
    }
}

//Answer the pending question for a computer player, after a moment's thought
async function aiAnswer(q)
{
    await sleep(AI_THINK_MS * (q.announce? 3: 1)); //longer over what it has announced: time for the others to cheer or jeer
    while (aiPaused)
    {
        await sleep(250);
    }
    if ((pendingAsk !== q) || !aiLevel(q.playerId)) return; //answered meanwhile, or the player is human now
    q.resolve(aiDecide(q.playerId, q));
}

////////// Who the computer players are: 'AI' checkbox and level per player, in the Players table //////////

//@param players ({ playerId: level })
function setAiPlayers(players)
{
    aiPlayers = {};
    for (let i = 0; i < PLAYERS.length; ++i)
    {
        const level = AI_LEVELS[players[i]]? players[i]: false,
            sel = $(`#sel_ai_${i}`);
        $(`#cb_ai_${i}`)[0].checked = !!level;
        sel.css('display', level? '': 'none');
        if (level)
        {
            sel[0].value = level;
            aiPlayers[i] = level;
        }
    }
    rememberAiPlayers();
}

//Keep who are the AI players across page reloads, whether or not a saved game is restored then
function rememberAiPlayers()
{
    localStorage.hotelsAiPlayers = JSON.stringify(aiPlayers);
}

function recallAiPlayers()
{
    if (localStorage.hotelsAiPlayers === undefined) return;
    try
    {
        setAiPlayers(JSON.parse(localStorage.hotelsAiPlayers));
    }
    catch (e)
    {
        console.log('Cannot recall AI players', e);
    }
}

//'AI' checkbox or level of given player has been changed
function updateAiSelection(playerId)
{
    const isAi = $(`#cb_ai_${playerId}`)[0].checked,
        sel = $(`#sel_ai_${playerId}`);
    sel.css('display', isAi? '': 'none');
    if (isAi)
    {
        aiPlayers[playerId] = sel[0].value;
    }
    else
    {
        delete aiPlayers[playerId];
    }
    rememberAiPlayers();
    if (pendingAsk && (pendingAsk.playerId === playerId))
    {
        dispatchAsk(); //hand the pending choice over
    }
    if (playersData.length > 0)
    {
        printBalances();
    }
}
