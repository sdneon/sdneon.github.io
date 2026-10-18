//Computer ('AI') players for Careers: what they choose whenever the game waits for the player whose turn it is.
//A level is a set of traits (AI_TRAITS), as in Hotels; the choosing code is the same for all levels.
//They play as a person would: by the page's own buttons and clicks (aiStep), knowing only what a player may know.

const AI_LEVELS = { friendly: 'Friendly', smart: 'Smart' }; //1st is the default
const AI_TRAITS = {
    friendly: {
        formula: 'random', //its Success Formula: random, or 'plan' (smart: from what the board gives most)
        sense: 0.5, //how often it weighs a choice; else it picks at random among the sensible ones
        cards: 0.4, //how often it plays a card at the start of its turn when it has one
        enterBar: -2, //enters a career when its worth (aiPathWorth) is at least this
        spendShare: 0.5, //share of cash beyond its money target it may spend on hearts / fame
        bets: 0, //Las Vegas: share of spare cash it bets
        expWorth: 0.5, //worth of an Experience card in hand, in formula points
        expKeep: { track: 0.8, path: 0.8 }, //how much better than a throw a card's square must be for it to play it (on the track, in a career)
        reserve: 0 //cash kept for taxes / rent, in salaries (smart: so as not to go bankrupt)
    },
    smart: {
        formula: 'plan',
        sense: 1,
        cards: 1,
        enterBar: 1,
        spendShare: 0.8,
        bets: 0.25,
        expWorth: 1.2, //kept for the career squares that pay most
        expKeep: { track: 2.5, path: 0.6 },
        reserve: 1
    }
};
//the 'AI' pin on a computer player's token in the turn dial: green friendly, (silver a middle level,) gold the strongest
const AI_PINS = { friendly: 'pin_green', smart: 'pin_gold' };
let AI_THINK_MS = 1300; //(as Hotels) pause before each of its actions, to be seen (the page test sets 0)

function aiLevel(p)
{
    return p && options.ai && options.ai[p.id];
}

function aiTraits(p)
{
    return AI_TRAITS[aiLevel(p)] || AI_TRAITS.friendly;
}

//Success Formula for a computer player: Smart leans on happiness and fame, which the board gives most of
function aiFormula(p)
{
    const total = options.success;
    if (aiTraits(p).formula === 'plan')
    {
        const money = Math.round(total * 0.2), fame = Math.round(total * 0.35);
        return { money, fame, hearts: total - money - fame };
    }
    const a = Math.random(), b = Math.random(), c = Math.random(), sum = a + b + c,
        money = Math.round(total * a / sum), fame = Math.round(total * b / sum);
    return { money, fame, hearts: total - money - fame };
}

/*
What it still needs: { money (points), fame, hearts }, and how much each point is worth to it now: the parts
still short count by how short they are; a part already reached counts a little (it may be lost again).
*/
function aiNeeds(p)
{
    const f = p.formula, need = { money: Math.max(0, f.money - moneyPoints(p)), fame: Math.max(0, f.fame - p.fame),
        hearts: Math.max(0, f.hearts - p.hearts) }, total = need.money + need.fame + need.hearts || 1;
    const w = (k) => need[k]? 0.2 + need[k] / total: 0.05;
    return { need, w: { money: w('money'), fame: w('fame'), hearts: w('hearts') } };
}

//worth of $n to the player, in points of their formula
function aiCash(p, n, w)
{
    return n / 1000 * w.money;
}

/*
Worth of a path square's effect (board.js) to the player, in formula points: a rough measure, good enough to
compare one square or career with another.
*/
function aiEffectWorth(p, eff, name, w)
{
    let v = 0;
    if (eff.f) v += eff.f * w.fame;
    if (eff.h) v += eff.h * ((p.doubleHearts === name)? 2: 1) * w.hearts;
    if (eff.cash) v += aiCash(p, eff.cash, w);
    if (eff.die) v += aiCash(p, eff.die * 3.5, w);
    if (eff.salary) v += aiCash(p, eff.salary * 2, w); //a few Pay Days to come
    if (eff.half === 'salary') v -= aiCash(p, p.salary, w);
    if (eff.half === 'cash') v -= aiCash(p, p.cash / 2, w);
    if (eff.half === 'fame') v -= p.fame / 2 * w.fame;
    if (eff.lose === 'hearts') v -= p.hearts * w.hearts;
    if (eff.lose === 'fame') v -= p.fame * w.fame;
    if (eff.lose === 'cash') v -= aiCash(p, p.cash, w);
    if (eff.exp) v += aiTraits(p).expWorth * eff.exp;
    if (eff.opp) v += 0.6 * eff.opp;
    if (eff.loseTurn) v -= 1;
    if (eff.again) v += 1;
    if (eff.goTo) v -= 3;
    if (eff.fine) v -= Math.min(aiCash(p, eff.fine[0], w), 3);
    return v;
}

//Worth of going through a career from its start: its squares (a die lands on about 1 in 3.5), what completing
//it gives, less the time it takes and the fee
function aiPathWorth(p, name, payFee)
{
    const path = PATHS[name], { w } = aiNeeds(p);
    const worths = path.squares.map((sq) => aiEffectWorth(p, sq[INDEX_EFFECT], name, w)),
        avg = worths.reduce((a, b) => a + b, 0) / worths.length;
    let v = avg * worths.length / 3.5;
    //Experience cards in hand take it onto the best squares instead of where a die falls
    v += Math.min(p.exp.length, 2) * Math.max(0, Math.max(...worths) - avg) * 0.5;
    const done = path.onExit || {};
    if (!done.noExperience) v += Math.min((p.record[name] || 0) + 1, MAX_EXPERIENCE_DRAW) * aiTraits(p).expWorth; //cards for completing it
    if (done.salary) v += aiCash(p, done.salary * 3, w);
    if (done.degree) v += 2;
    v -= path.squares.length / 3.5 * 0.8; //turns spent in it, that the outer track would have given
    if (payFee) v -= aiCash(p, path.fee, w) + ((p.cash - path.fee < 1000)? 1: 0);
    return v;
}

//Worth of landing on a square (an Experience card's choice): path square or outer square
function aiSquareWorth(p, pos)
{
    const { w } = aiNeeds(p);
    if (pos.path) return aiEffectWorth(p, PATHS[pos.path].squares[pos.step][INDEX_EFFECT], pos.path, w) + (pos.done? 1: 0);
    let v = pos.passPay? aiCash(p, p.salary * ((pos.at === PAYDAY)? 2: 1), w): 0;
    if (pos.done) v += 1;
    const [kind, name] = OUTER[pos.at];
    if (kind === 'opp') v += 0.6;
    const owe = (kind === 'tax')? p.salary * ((p.salary <= 3000)? 0.1: (p.salary < 10000)? 0.5: 0.9): (kind === 'rent')? p.salary / 4: 0;
    v -= aiCash(p, owe, w);
    if (owe > p.cash) v -= 8; //bankrupt: starts afresh
    if (kind === 'inflation') v -= aiCash(p, p.cash / 4, w);
    if (kind === 'shop') v -= aiCash(p, p.cash * 0.35, w);
    if (kind === 'hawaii') v += 4 * w.hearts;
    if (kind === 'entry') v += Math.max(0, aiBestEntry(p, name, null).worth);
    if (players.some((q) => (q !== p) && (cellId(q) === cellId(pos)))) v += 0.5; //bumps someone
    return v;
}

//how it would enter a career here (the cheapest way), and what that is worth: { k (index of the way), worth }
function aiBestEntry(p, name, card)
{
    const ways = entryWays(p, name, card);
    if (!ways.length) return { k: -1, worth: -99 };
    return { k: 0, worth: aiPathWorth(p, name, ways[0].how === 'fee') };
}

//the career it would most like to be at the entrance of (for an Opportunity card)
function aiBestCareer(p, card)
{
    let best = null, worth = -99;
    for (const name of Object.keys(PATHS))
    {
        const v = aiBestEntry(p, name, card).worth;
        if (v > worth) best = name, worth = v;
    }
    return { name: best, worth };
}

//pick by sense (best by score), or at random among those within reach of the best
function aiPick(p, items, score)
{
    if (!items.length) return null;
    const scored = items.map((it) => ({ it, v: score(it) })).sort((a, b) => b.v - a.v);
    if (Math.random() < aiTraits(p).sense) return scored[0].it;
    const fair = scored.filter((s) => s.v >= scored[0].v - 2);
    return fair[Math.floor(Math.random() * fair.length)].it;
}

/*
The choice it makes from the buttons the game shows for queue[0] (choiceOptions): the index of an option.
Each option's label is matched as a person would read it.
*/
function aiChooseOption(p, q)
{
    const opts = q.opts, { need, w } = aiNeeds(p), t = aiTraits(p), find = (re) => opts.findIndex((o) => re.test(o.label)),
        spare = Math.max(0, p.cash - p.formula.money * 1000 - t.reserve * p.salary) * t.spendShare; //cash beyond its money target (and reserve) that it may spend
    switch (q.kind)
    {
    case 'degree':
    {
        const score = (o) => /Medical/.test(o.label)? 3: /Engineering/.test(o.label)? 2 + w.fame + w.hearts:
            /Law/.test(o.label)? 1 + 2 * w.fame: /Science/.test(o.label)? 1 + 2 * w.hearts: 1;
        return opts.indexOf(aiPick(p, opts, score));
    }
    case 'enter':
    {
        const fee = !/free/i.test(opts[0].label), worth = aiPathWorth(p, q.name, fee);
        return (worth >= t.enterBar)? 0: find(/Don't/);
    }
    case 'fine':
    {
        const pay = find(/^Pay/);
        return ((pay >= 0) && (aiCash(p, q.amount, w) < 3))? pay: find(/Unemployment/);
    }
    case 'auto':
    {
        const k = Math.floor(Math.min(spare, p.salary) / 1000);
        if (need.hearts && (k >= 1) && (find(/^Buy/) >= 0))
        {
            aiAmount = Math.min(k, need.hearts);
            return find(/^Buy/);
        }
        return find(/looking/);
    }
    case 'hobby':
    {
        const two = find(/2 horses/), one = find(/1 horse/);
        if (!need.fame || (spare < 3000)) return find(/No thanks/);
        return ((spare >= 6000) && (two >= 0))? two: (one >= 0)? one: find(/No thanks/);
    }
    case 'vegas':
    {
        const k = Math.floor(p.cash * t.bets / 3000);
        if ((k < 1) || (find(/^Bet/) < 0)) return find(/No thanks/);
        aiAmount = k;
        return find(/^Bet/);
    }
    case 'paris': case 'charity':
    {
        const what = (q.kind === 'paris')? 'hearts': 'fame';
        if (!need[what]) return find(/No thanks/);
        let best = find(/No thanks/), bestV = 0;
        opts.forEach((o, k) =>
        {
            const m = o.label.match(/\$([\d,]+): (\d+)/);
            if (!m) return;
            const cost = parseInt(m[1].replace(/,/g, '')), gain = Math.min(parseInt(m[2]), need[what]);
            const v = gain * w[what] - aiCash(p, cost, w);
            if ((cost <= spare) && (v > bestV)) best = k, bestV = v;
        });
        return best;
    }
    case 'golden':
    {
        const { name } = aiBestCareer(p, q.card);
        return Math.max(0, opts.findIndex((o) => o.label === name));
    }
    case 'bump':
    {
        //the opponent with the most careers behind them, or furthest into one
        const score = (o) =>
        {
            const q2 = players.find((x) => PLAYERS[x.id] === o.label);
            return q2? Object.values(q2.record).reduce((a, b) => a + b, 0) + (q2.path? 1 + q2.step / 4: 0): -1;
        };
        const named = opts.filter((o) => o.label !== 'Nobody');
        return named.length? opts.indexOf(aiPick(p, named, score)): find(/Nobody/);
    }
    }
    return 0;
}

/*
Start of its turn: pay to leave Hospital / Unemployment? play a card? else throw (in Hawaii: a try to stay).
Returns a function doing it, or null to throw.
*/
function aiOpening(p)
{
    const t = aiTraits(p), { need, w } = aiNeeds(p);
    if (p.stuck)
    {
        const { fee } = leaveFee(p);
        //pays when it is cheap for it: free (the Doctor), or little of what it needs
        if ((fee <= p.cash) && ((fee === 0) || (aiCash(p, fee, w) < 1.5))) return () => payToLeave();
        return null;
    }
    if (cardPlayed || (Math.random() >= t.cards)) return null;
    //an Opportunity card into a career better than where it is
    const opp = aiBestOpp(p, false);
    if (opp >= 0) return () => playOpp(opp, true);
    //an Experience card onto a better square than a throw would give on average
    if (p.exp.length && !onHawaii(p))
    {
        //Smart keeps them on the track for the career squares that pay most
        const throwWorth = aiThrowWorth(p);
        let best = -1, bestV = throwWorth + (p.path? t.expKeep.path: t.expKeep.track);
        p.exp.forEach((n, k) =>
        {
            const v = aiSquareWorth(p, walk(p, n));
            if (v > bestV) best = k, bestV = v;
        });
        if (best >= 0) return () => playExp(best, true);
    }
    return null;
}

//the Opportunity card worth playing now (index in its hand), or -1: not from inside a career, unless just drawn there
//and better than staying; justDrawn: only cards drawn this turn (played straight away)
function aiBestOpp(p, justDrawn)
{
    const t = aiTraits(p), { w } = aiNeeds(p);
    let best = -1, bestV = t.enterBar + 1;
    if (p.path && !justDrawn) return -1;
    if (p.path) bestV += PATHS[p.path].squares.length - p.step; //leaving a career half done costs
    p.opp.forEach((card, k) =>
    {
        if (!oppPlayable(p, card) || (justDrawn && !drawnNow.includes(card[4]))) return;
        let v;
        if (card[3] === 'bump') v = players.some((o) => (o !== p) && o.path)? 1.5: -9;
        else if (card[1] === 'Hawaii') v = 4 * w.hearts - 0.5;
        else if (card[1] === 'any') v = aiBestCareer(p, card).worth;
        else v = aiBestEntry(p, card[1], card).worth;
        if (v > bestV) best = k, bestV = v;
    });
    return best;
}

//average worth of where a throw takes it (1 die in a path, 2 on the track)
function aiThrowWorth(p)
{
    let sum = 0, n = 0;
    const faces = [1, 2, 3, 4, 5, 6];
    if (p.path) for (const a of faces) sum += aiSquareWorth(p, walk(p, a)), ++n;
    else for (const a of faces) for (const b of faces) sum += aiSquareWorth(p, walk(p, a + b)), ++n;
    return sum / n;
}

/*
One action for the computer player whose turn it is, as a person would do it: click the glowing square, answer
the question on show, start the turn, or Next Player. Called again after each action (aiSchedule).
*/
function aiStep()
{
    const p = players[who];
    if (!aiLevel(p) || gameOver || busy) return;
    if (target) return squareClicked(cellId(target), true);
    if (queue.length)
    {
        const q = queue[0];
        q.opts = choiceOptions(q, p);
        return choose(Math.max(0, aiChooseOption(p, q)), true);
    }
    if (!rolled && !moved)
    {
        if (p.skip) return aiEndTurn();
        const act = aiOpening(p);
        if (act) return act();
        return rollClicked(true);
    }
    //an Opportunity card just drawn, used straight away
    if (moved && drawnNow.length && !oppUsed && (Math.random() < aiTraits(p).cards))
    {
        const k = aiBestOpp(p, true);
        if (k >= 0) return playOpp(k, true);
    }
    return aiEndTurn();
}

/*
Its turn is over: with a person in the game (and the option on), it waits for them to click Next Player, to see what it
did (as in Hotels); else on to the next player.
*/
function aiEndTurn()
{
    if (options.aiReview && players.some((x) => !aiLevel(x)))
    {
        aiWaiting = true;
        return showButtons();
    }
    nextPlayer(true);
}

function aiNext()
{
    if (!aiWaiting) return;
    aiWaiting = false;
    nextPlayer(true);
}

let aiTimer = null, aiGoing = false, aiWaiting = false;

//after the page has shown what happened: the computer player's next action, after a moment (unless paused)
function aiSchedule()
{
    clearTimeout(aiTimer);
    const p = players[who];
    if (!aiLevel(p) || gameOver || aiWaiting || preparing) return; //(round 0: its formula is set already)
    if (options.aiPause && !aiGoing) return;
    const run = gameRun;
    aiTimer = setTimeout(() =>
    {
        if (run !== gameRun) return;
        if (busy || (Date.now() < focusUntil)) return aiSchedule();
        aiStep();
    }, Math.max(AI_THINK_MS, focusUntil - Date.now()));
}

//paused: 'Go!' lets this computer player play its turn; the next waits again
function aiGo()
{
    aiGoing = true;
    showButtons();
    aiSchedule();
}

function aiUnpause()
{
    options.aiPause = false;
    saveOptions();
    $('#option_ai_pause')[0].checked = false;
    aiGo();
}
