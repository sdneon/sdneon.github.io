/*
Computer player movement.
Plans the move options of the current player from the rolled dice, and previews them on the board
(numbered shoeprints for one option; wavy dotted routes for all), for the (human) player to confirm.
Done automatically for players ticked as 'AI' in the Players selection table.
Design notes: see cluedo-ai-design.md

Movement rules used:
  > Movement points (MP) for a move: either dice, or the sum of both. Must always be used up exactly.
  > Player has to move. On doubles, player may re-roll and decide the move afresh.
  > 1 MP per step to a side-by-side space (no diagonals), or per jump from one stair to another.
  > The stairs in the centre are 2 giant spaces (left & right; each 2 columns x 3 rows), 1 MP to step onto.
  > No backtracking: a space cannot be visited more than once in a move.
  > No passing through walls, windows, player tokens, weapons & ornaments.
  > Clue counters can be moved over (rule #9), but only landed on by exact throw.
*/
//Rule #9: players may move over clue counters. Set false to have clue counters block the way.
let MOVE_PASS_OVER_CLUE_COUNTERS = true,
    //Debug: show all route options of an AI player to choose from. If false, only its chosen route, to confirm.
    MOVE_SHOW_ALL_ROUTES = true,
    //Full auto-mode: once dice are rolled for an AI player, computer chooses and makes its move by itself.
    //If false, its routes are shown for the human player to choose and accept.
    MOVE_AI_AUTO_PLAY = true,
    //Auto-mode: also press 'Analyze' before 'Act'. Not needed, as 'Act' does its own analysis; it only tells more.
    MOVE_AUTO_ANALYZE = false,
    //Debug: auto-mode presses 'Act' instead of 'Act Secretly', so that AI player tells what it is thinking and doing.
    //Keep false in play, so as not to reveal too much to the human players.
    MOVE_AUTO_ACT_ALOUD = false,
    //Auto-mode: when AI player finds where a Super Clue is and so gets another turn, it rolls the dice again by itself.
    //If false, it waits for the human player to roll for it.
    MOVE_AUTO_ROLL_AGAIN = true,
    //Auto-mode: AI player rolls the dice by itself at the start of its turn (after 'Next Player'), unless interrupted.
    //If false, it waits for the human player to roll for it.
    MOVE_AUTO_ROLL_START = true,
    //Auto-mode: AI player that enters a room and stops next to another player, bumps that player elsewhere (rule #13).
    //Smart AI also goes out of its way to do so, when a weapon/ornament clue is to be had but is out of its reach.
    MOVE_AI_BUMP = true,
    //Auto-mode: time (ms) given to the dice to tumble and come to rest, once thrown for an AI player,
    //before the page goes to its token and its move is worked out. 0 for no wait.
    MOVE_DICE_ROLL_MS = 2000;

const MOVE_AUTO_VIEWS = 4, //auto-mode: number of routes that AI looks over before choosing
    MOVE_AUTO_VIEW_MS = 900, //time on each route looked over
    MOVE_AUTO_STEP_MS = 800, //time per step walked
    MOVE_AUTO_JUMP_MS = 1200, //time per stair jump
    MOVE_AUTO_TAKE_MS = 3000, //time for the clue counter/weapon/ornament to pop off the board
    MOVE_AUTO_PAUSE_MS = 900, //pause after that (or after the last step, if nothing to take), before going to top of page for the game to handle the move
    MOVE_AUTO_BUTTON_MS = 900; //time between button presses after the move ('Act' etc. get twice this)
const MOVE_AUTO_BUTTONS = { //auto-mode: buttons (by their onclick) pressed after a move that gained cards or flaps
    weak: { //those of the 'Weak Assist | Handicapped AI Play' row
        analyze: 'think(true, false, true, 1);',
        act: 'think(true, true, true, 1);',
        actSecretly: 'think(true, true, false, 1);'
    },
    smart: { //those of the 'Smart AI Assist | Smart AI Play' row
        analyze: 'think(true, false, true);',
        act: 'think(true, true, true);',
        actSecretly: 'think(true, true, false);'
    }
};

const MOVE_SEARCH_BUDGET = 50000, //max spaces to try, in looking for 1 exact path to a clue
    MOVE_SEARCH_BUDGET_POSITIONING = 5000, //same, but for a space that is merely a good place to wait at
    MOVE_VALUE_SUPER_CLUE = 10, //worth of an active clue on a weapon/ornament (gives Super Clue card)
    MOVE_VALUE_COUNTER = 4, //worth of a clue counter
    MOVE_SMART_NEXT_WEIGHT = 0.5, //Smart AI: weight of what the next roll could get from a space
    MOVE_SMART_NEARBY_WEIGHT = 0.1, //Smart AI: weight of how rich in clues the area of a space is
    MOVE_SMART_DUMMY_CHANCE = 0.1, //Smart AI: chance (0 to 1), per dice throw, that it takes the dummy clue counter for a real one. Weak AI always does
    MOVE_SMILE_CHANCE = 0.7, //auto-mode: chance (0 to 1) that an AI player which has seen into all 3 card holders grins at the end of its turn
    MOVE_CONFETTI_PIECES = 180, //pieces of confetti thrown for a right accusation
    MOVE_CONFETTI_MS = 12000, //longest time a piece of confetti takes to fall; the quickest take about half of it
    MOVE_WEAK_MAX_JUMPS = 1, //Weak AI: most stair jumps it makes per dice throw. Smart AI has no limit
    MOVE_WEAK_FORGET_STAIRS = 0.5, //Weak AI: chance (0 to 1), per dice throw, that it forgets the stairs and only walks
    MOVE_REROLL_DOUBLES_UP_TO = 3, //auto-mode: AI re-rolls doubles of up to this number, if they get it no clue
    MOVE_REROLL_MS = 2000, //auto-mode: time its reason for re-rolling is shown, before the dice are rolled
    MOVE_ROLL_START_MS = 3000, //auto-mode: time AI player 'looks for the dice' at the start of its turn, in which it can be interrupted (see MOVE_AUTO_ROLL_START)
    MOVE_ROLL_AGAIN_MS = 2000, //auto-mode: pause before AI rolls for the other turn it got (see MOVE_AUTO_ROLL_AGAIN)
    MOVE_SMART_BUMP_VALUE = 3, //Smart AI: worth of a space from which it can bump another player, when it is out to bump (1 more if it is a Smart AI player it is after)
    MOVE_SMART_BUMP_SMART_CHANCE = 0.5, //Smart AI: chance (0 to 1) that it is after a Smart AI player to bump; else any player will do
    MOVE_WEAK_BUMP_SPREAD = 4, //Weak AI: puts a bumped player on any free space outside the room, within this many steps of the nearest such
    MOVE_AUTO_BUMP_MS = 1500, //auto-mode: time for the bumped token to fly off
    MOVE_MAX_WAIT_OPTIONS = 5; //number of 'go wait at a good space' options to offer, besides all the clues in reach
const MOVE_ROOM_NAMES = { K: 'Kitchen', B: 'Ballroom', C: 'Conservatory', D: 'Dining Room', I: 'Billiard Room',
    L: 'Library', O: 'Lounge', H: 'Hall', S: 'Study' }; //by the room keys of board.js
const MOVE_ROOM_CARDS = { H: 18, C: 19, S: 20, L: 21, O: 22, K: 23, I: 24, D: 25, B: 26 }; //room key: its card in CARD_IMAGES, whose name is that of the room's picture too
const MOVE_AI_LEVELS = { //1st is the default
    weak: 'Weak AI',
    smart: 'Smart AI'
};
const MOVE_ROUTE_COLOURS = ['#0a0', '#06c', '#c0c', '#e80', '#088', '#850', '#c04', '#55f'];
const MOVE_ROUTE_START_GAP = 42; //pixels from the centre of the player token at which the dotted routes start, so as not to cover its face (2 dots of the current route)
const MOVE_DIRS = [ //dy, dx, wall side of this space, wall side of the neighbour
    [-1, 0, 't', 'b'],
    [1, 0, 'b', 't'],
    [0, -1, 'l', 'r'],
    [0, 1, 'r', 'l']];
const MOVE_TIER_SUPER_CLUE = 0,
    MOVE_TIER_COUNTER = 1,
    MOVE_TIER_POSITIONING = 2;

let moveGraph = false, //static map of which spaces connect; built once from BOARD & WALLS
    moveOptions = false, //list of move options for the current roll, best 1st
    moveCurrent = false, //move option being previewed
    moveOptionNum = 0, //base1
    moveAiPlayers = {}, //playerId: 'weak'/'smart'; human players are not in here
    moveGameCellClicked, //the game's own cellClicked()
    moveAutoRun = 0, //counts up per auto-play; one that finds it has moved on stops
    moveAutoBusy = false, //true while computer is making a move by itself
    moveAutoLocked = false, //true once it has chosen its route
    moveAccusation = false, //'right'/'wrong' once an accusation is made; reset before each auto-play move
    moveFinishedPlayers = {}, //playerId: true for AI players that have solved the mystery and left the game; back in for the next game
    moveStairsNote = '', //remarks on the AI's lapses (stairs forgotten, dummy not noticed) in the routes worked out; for the panel
    moveGameDiceClicked, //the game's own onDiceClicked()
    moveBumpPreferSmart; //Smart AI out to bump this throw: true if it is after a Smart AI player; false if any; undefined if not out to bump

//----------------------------------------------------------------------------
// Planning (no UI in this part)
//----------------------------------------------------------------------------

//@retval true if given side of space has a wall or (closed) window
function moveWallBlocks(cellId, side)
{
    const walls = WALLS[cellId];
    if (!walls)
    {
        return false;
    }
    return walls.split(',').some((info) => {
        return (info[0] === side) && ((info[1] === 'x') || (info[1] === 'w'));
    });
}

function getMoveGraph()
{
    if (moveGraph)
    {
        return moveGraph;
    }
    const cellWalk = {}, //cellId: [cell IDs 1 step away]
        walk = {}, //same, but by space: a giant stair's cells are merged into 1 space
        stairs = [],
        isStair = {},
        giantCells = [], //cells of the stairs in the centre
        giants = {}, //space ID of giant stair: [its cell IDs]
        spaceOf = {}, //cellId of giant stair: its space ID (= its 1st cell ID)
        isValid = (y, x) => {
            if ((y < 0) || (y >= BOARD.length) || (x < 0) || (x >= BOARD[y].length / 2)) return false;
            const cellType = BOARD[y][x * 2];
            return (cellType !== 'x') && (cellType !== 'X');
        };
    for (let y = 0; y < BOARD.length; ++y)
    {
        const numCols = BOARD[y].length / 2;
        for (let x = 0; x < numCols; ++x)
        {
            if (!isValid(y, x)) continue;
            const cellId = `${y}_${x}`,
                cell = BOARD[y].substring(x * 2, x * 2 + 2);
            cellWalk[cellId] = [];
            if (cell[0] === 's')
            {
                giantCells.push(cellId);
            }
            else if (cell[1] === 's')
            {
                stairs.push(cellId);
                isStair[cellId] = true;
            }
            MOVE_DIRS.forEach((dir) => {
                const ny = y + dir[0],
                    nx = x + dir[1],
                    nextId = `${ny}_${nx}`;
                //walls are usually given on 1 side only, so check both
                if (isValid(ny, nx) && !moveWallBlocks(cellId, dir[2]) && !moveWallBlocks(nextId, dir[3]))
                {
                    cellWalk[cellId].push(nextId);
                }
            });
        }
    }
    //group the centre stair cells that connect (a wall divides left from right) into giant stairs
    giantCells.forEach((cellId) => {
        if (spaceOf[cellId]) return;
        const cells = [cellId];
        spaceOf[cellId] = cellId;
        for (let i = 0; i < cells.length; ++i)
        {
            cellWalk[cells[i]].forEach((c) => {
                if ((giantCells.indexOf(c) >= 0) && !spaceOf[c])
                {
                    spaceOf[c] = cellId;
                    cells.push(c);
                }
            });
        }
        giants[cellId] = cells;
        stairs.push(cellId);
        isStair[cellId] = true;
    });
    Object.keys(cellWalk).forEach((cellId) => {
        const space = spaceOf[cellId] || cellId;
        walk[space] ??= [];
        cellWalk[cellId].forEach((c) => {
            const next = spaceOf[c] || c;
            if ((next !== space) && (walk[space].indexOf(next) < 0))
            {
                walk[space].push(next);
            }
        });
    });
    moveGraph = { walk, stairs, isStair, giants, spaceOf };
    return moveGraph;
}

//@retval space that given cell is (part of); differs from cell only for the giant stairs
function moveSpaceOf(cellId)
{
    return getMoveGraph().spaceOf[cellId] || cellId;
}

/*
Least MP needed from given space to every space reachable (ignoring the 'exact throw' rule).
@param canEnter (function(cellId)) whether space can be moved onto
@param isDeadEnd (function(cellId)) optional; whether space can be moved onto but not beyond
@return { cellId: MP }
*/
function moveDistances(from, canEnter, isDeadEnd)
{
    const g = getMoveGraph(),
        dist = {},
        queue = [from];
    let stairsDone = false;
    dist[from] = 0;
    for (let i = 0; i < queue.length; ++i)
    {
        const cell = queue[i];
        if ((i > 0) && isDeadEnd && isDeadEnd(cell)) continue;
        let next = g.walk[cell];
        if (g.isStair[cell] && !stairsDone)
        {
            stairsDone = true; //all stairs are 1 jump apart, so only the 1st one reached needs to fan out
            next = next.concat(g.stairs);
        }
        next.forEach((c) => {
            if ((dist[c] === undefined) && canEnter(c))
            {
                dist[c] = dist[cell] + 1;
                queue.push(c);
            }
        });
    }
    return dist;
}

/*
Same as moveDistances(), but with the number of stair jumps limited.
@param maxJumps (number) most stair jumps allowed
@return list by number of jumps: [j] is { cellId: least MP using at most j jumps }, for j = 0 to maxJumps
*/
function moveDistancesByJumps(from, canEnter, isDeadEnd, maxJumps)
{
    const g = getMoveGraph(),
        dist = [], //[jumps made]: { cellId: MP }
        queue = [[from, 0]], //[cellId, jumps made]
        stairsDone = [];
    for (let j = 0; j <= maxJumps; ++j)
    {
        dist[j] = {};
    }
    dist[0][from] = 0;
    for (let i = 0; i < queue.length; ++i)
    {
        const cell = queue[i][0],
            jumps = queue[i][1],
            mp = dist[jumps][cell] + 1;
        if ((cell !== from) && isDeadEnd && isDeadEnd(cell)) continue;
        g.walk[cell].forEach((c) => {
            if ((dist[jumps][c] === undefined) && canEnter(c))
            {
                dist[jumps][c] = mp;
                queue.push([c, jumps]);
            }
        });
        if (g.isStair[cell] && (jumps < maxJumps) && !stairsDone[jumps])
        {
            stairsDone[jumps] = true; //all stairs are 1 jump apart, so only the 1st one reached needs to fan out
            g.stairs.forEach((c) => {
                if ((c !== cell) && (dist[jumps + 1][c] === undefined) && canEnter(c))
                {
                    dist[jumps + 1][c] = mp;
                    queue.push([c, jumps + 1]);
                }
            });
        }
    }
    //'at most j jumps' is the best of exactly 0 to j jumps
    for (let j = 1; j <= maxJumps; ++j)
    {
        Object.keys(dist[j - 1]).forEach((c) => {
            if ((dist[j][c] === undefined) || (dist[j - 1][c] < dist[j][c]))
            {
                dist[j][c] = dist[j - 1][c];
            }
        });
    }
    return dist;
}

/*
Find a path from start to goal that uses exactly the given MP, without revisiting any space.
Excess MP can be used up by detours, or by jumping between a few stairs.
@param blocked ({ cellId: true }) spaces that cannot be moved onto (goal itself excepted)
@param budget (number) max spaces to try before giving up
@param maxJumps (number) optional; most stair jumps allowed in the path. Default: no limit
@return list of steps [{ cell: cellId, jump: true if step is a stair jump }], or false if none found
*/
function moveFindPath(start, goal, mp, blocked, budget, maxJumps)
{
    const g = getMoveGraph(),
        limited = (maxJumps !== undefined) && (maxJumps !== Infinity),
        canEnter = (c) => (c === goal) || !blocked[c],
        dist = limited? moveDistancesByJumps(goal, canEnter, undefined, maxJumps): moveDistances(goal, canEnter),
        //MP still needed from a space, with given number of jumps left; to prune hopeless paths
        need = (c, jumps) => limited? dist[jumps][c]: dist[c],
        visited = {},
        steps = [], //{ cell, jump, burn }; burn: number of extra stairs to jump via, picked at the end
        spareStairs = () => g.stairs.filter((c) => !visited[c] && !blocked[c] && (c !== goal));
    let tried = 0,
        burnTotal = 0,
        jumpsLeft = limited? maxJumps: Infinity;
    if ((need(start, jumpsLeft) === undefined) || (need(start, jumpsLeft) > mp))
    {
        return false;
    }

    function tryStep(cell, jump, burn, mpLeft)
    {
        const jumps = jump? burn + 1: 0;
        visited[cell] = true;
        steps.push({ cell, jump, burn });
        burnTotal += burn;
        jumpsLeft -= jumps;
        if (search(cell, mpLeft, jump))
        {
            return true;
        }
        jumpsLeft += jumps;
        burnTotal -= burn;
        steps.pop();
        delete visited[cell];
        return false;
    }

    //@retval spaces among given ones that can be gone to next, nearest to goal 1st
    function nextSpaces(cells, mpAfter, jumpsAfter)
    {
        return cells.filter((c) => {
            return !visited[c] && canEnter(c) && (need(c, jumpsAfter) !== undefined) && (need(c, jumpsAfter) <= mpAfter);
        }).sort((a, b) => need(a, jumpsAfter) - need(b, jumpsAfter));
    }

    function search(cell, mpLeft, jumped)
    {
        if (cell === goal)
        {
            return (mpLeft === 0) && (burnTotal <= spareStairs().length);
        }
        if (++tried > budget)
        {
            return false;
        }
        const next = nextSpaces(g.walk[cell], mpLeft - 1, jumpsLeft);
        for (let i = 0; i < next.length; ++i)
        {
            if (tryStep(next[i], false, 0, mpLeft - 1)) return true;
        }
        //jumps in a row are merged into 1 jump with 'burn' stairs in between, so never jump twice in a row here
        if (g.isStair[cell] && !jumped)
        {
            for (let burn = 0; (burn < mpLeft) && (burn < jumpsLeft); ++burn)
            {
                const stairs = nextSpaces(g.stairs, mpLeft - 1 - burn, jumpsLeft - 1 - burn);
                for (let i = 0; i < stairs.length; ++i)
                {
                    if (tryStep(stairs[i], true, burn, mpLeft - 1 - burn)) return true;
                }
            }
        }
        return false;
    }

    visited[start] = true;
    if (!search(start, mp, false))
    {
        return false;
    }
    const spare = spareStairs(),
        path = [];
    steps.forEach((step) => {
        for (let i = 0; i < step.burn; ++i)
        {
            path.push({ cell: spare.pop(), jump: true });
        }
        path.push({ cell: step.cell, jump: step.jump });
    });
    return path;
}

//Least MP from given space to everywhere, as a player would move: can land on clues, but not pass the blocked ones
function moveDistancesFrom(cell, state)
{
    return moveDistances(cell,
        (c) => !state.blocked[c] || state.targets[c],
        (c) => state.blocked[c]);
}

/*
Rate a space by the clues around it (by shortest way; the clue on the space itself not counted).
@return {
    next: expected worth of the best clue that the next dice roll could land on from there,
    nearby: sum of (worth / MP away) of all clues within 2 dice of there; i.e. how rich the area is
  }
*/
function moveOutlook(cell, state)
{
    const dist = moveDistancesFrom(cell, state),
        reach = []; //MP: worth of best clue at that distance
    let nearby = 0;
    Object.keys(state.targets).forEach((c) => {
        const d = dist[c];
        if ((c === cell) || (d === undefined) || (d > 12)) return;
        reach[d] = Math.max(reach[d] || 0, state.targets[c].value);
        nearby += state.targets[c].value / d;
    });
    let next = 0;
    for (let a = 1; a <= 6; ++a)
    {
        for (let b = 1; b <= 6; ++b)
        {
            next += Math.max(reach[a] || 0, reach[b] || 0, reach[a + b] || 0);
        }
    }
    return { next: next / 36, nearby };
}

/*
Smart AI: weighs up what a space gives now, what the next roll could get from it, and how rich its area is.
So it takes a clue in reach, prefers one with more clues around it, and heads for where clues are plenty;
a far away weapon/ornament clue (over 2 dice away) counts for nothing.
@return function(option) giving { score, why }
*/
function moveSmartScorer(state)
{
    return (option) => {
        const look = moveOutlook(option.cell, state),
            land = option.target? option.target.value: 0;
        let score = land + MOVE_SMART_NEXT_WEIGHT * look.next + MOVE_SMART_NEARBY_WEIGHT * look.nearby,
            why = `land ${land} + next roll ${look.next.toFixed(1)} x ${MOVE_SMART_NEXT_WEIGHT} + nearby ${look.nearby.toFixed(1)} x ${MOVE_SMART_NEARBY_WEIGHT}`;
        if (state.bump) //it is out to bump someone: a space to do that from is worth something
        {
            const others = moveBumpable(state, option.cell);
            if (others.length > 0)
            {
                //a bit more, if it is after Smart AI players and one is there
                const bump = MOVE_SMART_BUMP_VALUE + ((state.bump.preferSmart && others.some((other) => other.smart))? 1: 0);
                score += bump;
                why += ` + bump ${others.map((other) => PLAYERS[other.id]).join('/')} ${bump}`;
            }
        }
        return { score, why };
    };
}

/*
@retval the other players [{ id, cell, smart }] that current player could bump (rule #13) if its move ends on given space:
those in the same room on a space next to it (diagonals count, as in the game's own check),
and only if the move brings current player into that room. [] if none.
*/
function moveBumpable(state, cellId)
{
    const room = state.roomOf[cellId];
    if (!room || (room === state.roomOf[state.startCell]))
    {
        return [];
    }
    const at = moveCellCoords(cellId);
    return state.others.filter((other) => {
        const coords = moveCellCoords(other.cell);
        return (state.roomOf[other.cell] === room) && (Math.abs(coords[0] - at[0]) <= 1) && (Math.abs(coords[1] - at[1]) <= 1);
    });
}

/*
Weak AI: single-minded. Goes for the nearest weapon/ornament with an active clue, no matter how far;
stopping on a clue counter if that is on the way (i.e. gets it nearer). Only if there is no such clue at all
does it go for clue counters for their own sake.
@return function(option) giving { score, why }
*/
function moveWeakScorer(state)
{
    const toClue = {}; //cellId: MP to the nearest weapon/ornament with active clue
    Object.keys(state.targets).forEach((cell) => {
        if (state.targets[cell].kind === 'counter') return;
        const dist = moveDistancesFrom(cell, state);
        Object.keys(dist).forEach((c) => {
            if ((toClue[c] === undefined) || (dist[c] < toClue[c]))
            {
                toClue[c] = dist[c];
            }
        });
    });
    const now = toClue[state.start];
    return (option) => {
        const d = toClue[option.cell],
            isCounter = option.target && (option.target.kind === 'counter');
        if ((now === undefined) || (d === undefined)) //no weapon/ornament clue to go for (or no way to it)
        {
            const next = moveOutlook(option.cell, state).next;
            return isCounter? { score: 500 + next, why: 'no weapon/ornament clue: take a clue counter' }:
                { score: next, why: 'no weapon/ornament clue: wait where next roll may reach a clue counter' };
        }
        if (option.target && !isCounter)
        {
            return { score: 1000, why: 'lands on weapon/ornament clue' };
        }
        if (isCounter && (d < now))
        {
            return { score: 500 - d, why: `clue counter on the way: ${d} MP from weapon/ornament clue (now ${now})` };
        }
        if (!isCounter)
        {
            return { score: 100 - d, why: `gets to ${d} MP from weapon/ornament clue (now ${now})` };
        }
        return { score: 50 - d, why: `clue counter, but not on the way: ${d} MP from weapon/ornament clue (now ${now})` };
    };
}

/*
Generate move options for a roll, best 1st in the eyes of the given level of AI.
@param state ({
    start: cellId of player,
    dice: [val, val],
    blocked: { cellId: true } spaces that cannot be passed,
    noStop: { cellId: true } spaces that can be passed but not stopped at,
    targets: { cellId: { kind: 'counter'/'weapon'/'ornament', name, value } } clues to go for; can be blocked too
  })
@param level ('weak'/'smart') optional; default 'smart'
@param maxWaits (number) optional; max options to give that land on no clue. Default: no limit
@param maxJumps (number) optional; most stair jumps allowed in a move. Default: no limit
@yield { cell, target, tier, score, why, mp, path }
*/
function* movePlan(state, level, maxWaits, maxJumps)
{
    const a = state.dice[0],
        b = state.dice[1],
        mps = [a, b, a + b].filter((mp, i, list) => list.indexOf(mp) === i).sort((x, y) => x - y),
        limited = (maxJumps !== undefined) && (maxJumps !== Infinity),
        fromStart = !limited? moveDistancesFrom(state.start, state):
            moveDistancesByJumps(state.start,
                (c) => !state.blocked[c] || state.targets[c],
                (c) => state.blocked[c],
                maxJumps)[maxJumps],
        scorer = (level === 'weak')? moveWeakScorer(state): moveSmartScorer(state),
        candidates = [];
    Object.keys(fromStart).forEach((cell) => {
        if ((cell === state.start) || (fromStart[cell] > a + b)) return;
        const target = state.targets[cell];
        if (!target && state.noStop[cell]) return;
        let tier = MOVE_TIER_POSITIONING;
        if (target)
        {
            tier = (target.kind === 'counter')? MOVE_TIER_COUNTER: MOVE_TIER_SUPER_CLUE;
        }
        const option = { cell, target, tier };
        candidates.push(Object.assign(option, scorer(option)));
    });
    candidates.sort((x, y) => y.score - x.score);

    let numWaits = 0;
    for (let i = 0; i < candidates.length; ++i)
    {
        const option = candidates[i],
            budget = option.target? MOVE_SEARCH_BUDGET: MOVE_SEARCH_BUDGET_POSITIONING;
        if (!option.target && (numWaits >= maxWaits)) continue;
        const tries = mps.filter((mp) => mp >= fromStart[option.cell]);
        for (let j = 0; j < tries.length; ++j)
        {
            const path = moveFindPath(state.start, option.cell, tries[j], state.blocked, budget, maxJumps);
            if (path)
            {
                if (!option.target) ++numWaits;
                option.mp = tries[j];
                option.path = path;
                yield option;
                break;
            }
        }
    }
}

//----------------------------------------------------------------------------
// UI
//----------------------------------------------------------------------------

//@retval false if human player; else 'weak' or 'smart' for the level of AI player
function moveAiLevel(playerId)
{
    return moveAiPlayers[playerId] || false;
}

//Gather what the planner needs from the current game board
//@param fooledByDummy (boolean) optional; true to take the dummy clue counter for a real one
function moveGatherState(fooledByDummy)
{
    const blocked = {},
        noStop = {},
        targets = {};
    playerPositions.forEach((cellId, playerId) => {
        if ((playerId !== who) && !ignoredPlayers[playerId])
        {
            blocked[moveSpaceOf(cellId)] = true; //a player anywhere on a giant stair blocks all of it
        }
    });
    Object.keys(placedWeapons).forEach((cellId) => {
        const wpnId = placedWeapons[cellId];
        blocked[cellId] = true;
        if (activeClues.indexOf(wpnId) >= 0)
        {
            targets[cellId] = { kind: 'weapon', name: `${WEAPONS[wpnId]} (weapon)`, value: MOVE_VALUE_SUPER_CLUE };
        }
    });
    Object.keys(placedOrns).forEach((cellId) => {
        const ornId = placedOrns[cellId];
        blocked[cellId] = true;
        if (activeClues.indexOf(ornId + WEAPONS.length) >= 0)
        {
            targets[cellId] = { kind: 'ornament', name: `${ORNAMENTS[ornId]} (garden ornament)`, value: MOVE_VALUE_SUPER_CLUE };
        }
    });
    Object.keys(placedClues).forEach((cellId) => {
        if (!MOVE_PASS_OVER_CLUE_COUNTERS)
        {
            blocked[cellId] = true;
        }
        if ((placedClues[cellId] === 0) && !fooledByDummy) //the dummy is face up for all to see, so no point landing on it
        {
            noStop[cellId] = true;
        }
        else
        {
            targets[cellId] = { kind: 'counter', name: 'clue counter', value: MOVE_VALUE_COUNTER };
        }
    });
    const start = moveSpaceOf(playerPositions[who]),
        others = []; //the other players in the game
    playerPositions.forEach((cellId, playerId) => {
        if ((playerId !== who) && !ignoredPlayers[playerId])
        {
            others.push({ id: playerId, cell: cellId, smart: (moveAiLevel(playerId) === 'smart') });
        }
    });
    delete blocked[start]; //whatever player is standing on is not in own way
    return {
        start,
        startCell: playerPositions[who],
        dice: [diceOne.val, diceTwo.val],
        blocked,
        noStop,
        targets,
        others,
        roomOf: allRoomSlots //cellId: key of the room it is in
    };
}

function moveCellCoords(cellId)
{
    const coords = cellId.split('_');
    return [parseInt(coords[0], 10), parseInt(coords[1], 10)];
}

//@retval degrees (clockwise from up) to turn the (toes up) shoeprint by, to point from one cell to another
function moveBearing(fromId, toId)
{
    const from = moveCellCoords(fromId),
        to = moveCellCoords(toId);
    return Math.round(Math.atan2(to[1] - from[1], from[0] - to[0]) * 180 / Math.PI);
}

//@retval cell to draw on (and click) for a step: for a giant stair, its cell nearest to where the step is from
function moveShowCell(step, fromCell)
{
    const cells = getMoveGraph().giants[step.cell];
    if (!cells)
    {
        return step.cell;
    }
    const from = moveCellCoords(fromCell),
        gap = (c) => {
            const coords = moveCellCoords(c);
            return Math.abs(coords[0] - from[0]) + Math.abs(coords[1] - from[1]);
        };
    return cells.reduce((best, c) => (gap(c) < gap(best))? c: best);
}

function moveAddPrint(cellId, image, deg, num, styleClass)
{
    $(`#cell${cellId}_container .cell_container2`).append(
        `<div class='move_print ${styleClass}'>
            <img src='images/${image}' style='transform: rotate(${deg}deg);'>
            <span class='move_print_num'>${num}</span>
        </div>`);
}

function moveClearPrints()
{
    $('.move_print').remove();
}

/*
Show shoeprints, 1 per step and numbered by step, on the spaces stepped onto.
Each points to the next space of the move (straight at the other stair, if that is a jump);
the last one points the way it was arrived at.
@param start (cellId) cell that player token is on
*/
function moveShowPrints(start, path)
{
    moveClearPrints();
    const last = path.length - 1;
    if (path[0].jump) //extra print, to show that the move begins with a jump off the stairs player is on
    {
        moveAddPrint(start, 'token-shoeprints-jumping.png', moveBearing(start, path[0].show), 0, 'move_print_start');
    }
    path.forEach((step, i) => {
        const from = (i > 0)? path[i - 1].show: start,
            next = path[i + 1],
            deg = next? moveBearing(step.show, next.show): moveBearing(from, step.show);
        let image = 'token-shoeprints.png',
            styleClass = 'move_print_walk';
        if (step.jump)
        {
            image = 'token-shoeprints-landing.png';
            styleClass = '';
        }
        else if (next && next.jump)
        {
            image = 'token-shoeprints-jumping.png';
            styleClass = '';
        }
        if (i === last)
        {
            styleClass += ' move_print_last';
        }
        else if (i === 0)
        {
            styleClass += ' move_print_first';
        }
        moveAddPrint(step.show, image, deg, i + 1, styleClass);
    });
}

//@retval [x, y] of centre of cell, in pixels from top left of playing area
function moveCellCentre(cellId)
{
    const board = $('#divPlayingArea')[0].getBoundingClientRect(),
        cell = $(`#cell${cellId}_container`)[0].getBoundingClientRect();
    return [cell.left - board.left + cell.width / 2, cell.top - board.top + cell.height / 2];
}

//@retval SVG path data of a wavy line from p to q ([x, y] each); starts with a 'move to' if 1st of its path
//@param gap (pixels) optional; if 1st of its path: how far out from p the line starts, so as not to cover what is at p
function moveWavyLine(p, q, amplitude, wavelength, isFirst, gap)
{
    const dx = q[0] - p[0],
        dy = q[1] - p[1],
        len = Math.sqrt(dx * dx + dy * dy),
        waves = Math.max(1, Math.round(len / wavelength)), //whole waves, so that line meets both ends
        numPts = waves * 8,
        skip = isFirst? Math.min(gap || 0, len / 2): 0;
    let d = '';
    for (let i = isFirst? 0: 1; i <= numPts; ++i)
    {
        const t = i / numPts,
            off = amplitude * Math.sin(t * waves * 2 * Math.PI),
            x = p[0] + dx * t - (dy / len) * off,
            y = p[1] + dy * t + (dx / len) * off;
        if (t * len < skip) continue;
        d += `${(d === '')? 'M': 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
}

function moveClearRoutes()
{
    $('#divMoveRoutes').remove();
}

/*
Overlay the routes of all move options on the board, as wavy dotted lines (bigger waves for stair jumps),
each ending in its option number, which can be clicked to show that option. Current option stands out.
*/
function moveShowRoutes()
{
    moveClearRoutes();
    const start = playerPositions[who],
        table = $('#divPlayingArea table')[0];
    let lines = '',
        labels = '';
    moveOptions.forEach((option, i) => {
        const isCurrent = (option === moveCurrent),
            colour = MOVE_ROUTE_COLOURS[i % MOVE_ROUTE_COLOURS.length],
            styleClass = isCurrent? 'move_route move_route_current': 'move_route';
        if (moveAutoLocked && !isCurrent) return; //AI has made its choice; show only that
        let from = moveCellCentre(start),
            d = '';
        option.path.forEach((step, j) => {
            const to = moveCellCentre(step.show);
            d += step.jump? moveWavyLine(from, to, 8, 44, j === 0, MOVE_ROUTE_START_GAP):
                moveWavyLine(from, to, 4, 27, j === 0, MOVE_ROUTE_START_GAP);
            from = to;
        });
        //route number in a rectangle at top right of its last space; shoeprint is top left, step number bottom right
        const line = `${isCurrent? `<path class='move_route_halo' d='${d}'/>`: ''}<path class='${styleClass}' d='${d}' stroke='${colour}'/>`,
            label = `<g class='move_route_label${isCurrent? ' move_route_label_current': ''}' onclick='if (!moveAutoBusy) showMoveOption(${i + 1});'>
                <rect x='${from[0] + 10}' y='${from[1] - 38}' width='28' height='18' rx='3' fill='${colour}'/>
                <text x='${from[0] + 24}' y='${from[1] - 24}'>${i + 1}</text>
            </g>`;
        //current option goes last, so as to be on top
        lines = isCurrent? lines + line: line + lines;
        labels = isCurrent? labels + label: label + labels;
    });
    $('#divPlayingArea').append(`<div id='divMoveRoutes'>
        <svg width='${table.offsetWidth}' height='${table.offsetHeight}'>${lines}${labels}</svg>
    </div>`);
}

function moveShowPanel(s)
{
    $('#divMovePlan')[0].innerHTML = s;
}

//@param playerId (number) optional; default: current player
//@retval HTML of the player's token at half size; heads the messages about the player
function movePlayerIcon(playerId)
{
    return `<span class='move_player_icon cell_player_${playerId ?? who}'></span>`;
}

//@retval e.g. 'Mrs White (Weak AI)'
function movePlayerString()
{
    const level = moveAiLevel(who);
    return `<b>${PLAYERS[who]}</b>${level? ` (${MOVE_AI_LEVELS[level]})`: ''}`;
}

//Preview given move option (base1) of the options worked out for current roll
function showMoveOption(optionNum)
{
    if (!moveOptions || !moveOptions[optionNum - 1])
    {
        return;
    }
    const option = moveOptions[optionNum - 1],
        numJumps = option.path.filter((step) => step.jump).length,
        coords = moveCellCoords(option.path[option.path.length - 1].show);
    let what = getMoveGraph().isStair[option.cell]? 'stairs': 'space',
        advice = '';
    if (option.target)
    {
        what = `<b>${option.target.name}</b>`;
    }
    else
    {
        what = `wait at ${what}`;
    }
    if (diceOne.val === diceTwo.val)
    {
        advice = option.target? '<br>Doubles: may re-roll instead, but this move gets a clue.':
            '<br>Doubles and nothing to land on: <b>re-roll</b> recommended.';
    }
    moveOptionNum = optionNum;
    moveCurrent = option;
    moveShowPrints(playerPositions[who], option.path);
    moveShowRoutes();
    moveShowTokenTip();
    moveShowPlanBubble();
    //buttons 1st, so that they are not pushed under the card decks' popups on the right
    let buttons = `<button onclick='acceptMove();' class='button_ai'>Accept Move</button>`;
    if (!moveConfirmOnly())
    {
        buttons += `<span data-tooltip-position='bottom' data-tooltip='Or click on the player token'>
                <button onclick='nextMoveOption();'>Next Route</button></span>
            <span data-tooltip-position='bottom' data-tooltip='Or right-click on the player token'>
                <button onclick='clearMovePlan();'>Clear</button></span>`;
    }
    if (moveAutoBusy) //computer is making the move by itself
    {
        buttons = moveAutoLocked? '<b>Chosen:</b>': '<i>Thinking...</i>';
    }
    moveShowPanel(`${buttons}
        ${movePlayerIcon()} Route #${optionNum} of ${moveOptions.length} for ${movePlayerString()}
        (dice ${diceOne.val} &amp; ${diceTwo.val}): <b>${option.mp}</b> step${(option.mp > 1)? 's': ''}${(numJumps > 0)? ` (${numJumps} by stair jump)`: ''}
        to ${what} @ ${coords[1]}, ${coords[0]}${advice}
        <br><span class='move_plan_why'>Why: ${option.why} = ${option.score.toFixed(1)}.${moveStairsNote}</span>`);
}

//@retval true if human player can only view and accept the route chosen by AI player; i.e. not debugging its choices
function moveConfirmOnly()
{
    return moveAiLevel(who) && !MOVE_SHOW_ALL_ROUTES;
}

//@retval what a route is for, e.g. 'Clue Counter', 'Dagger (weapon)', 'Stairs'; or '' if just an empty space
function moveObjective(option)
{
    if (option.target)
    {
        return (option.target.kind === 'counter')? 'Clue Counter': option.target.name;
    }
    return getMoveGraph().isStair[option.cell]? 'Stairs': '';
}

//Add 'Route #X of Y' and its objective to the dice tooltip of current player's token;
//or take them away if no route is shown
function moveShowTokenTip()
{
    const cell = $(`#cell_played${playerPositions[who]}`);
    if (cell.length <= 0)
    {
        return;
    }
    if (moveCurrent && (cell.children('span').length <= 0))
    {
        cell[0].innerHTML = diceString();
    }
    let tip = `${diceOne.val}+${diceTwo.val}=${diceOne.val + diceTwo.val}`;
    if (moveCurrent)
    {
        const objective = moveObjective(moveCurrent);
        tip += ` | Route #${moveOptionNum} of ${moveOptions.length}${objective? `: ${objective}`: ''}`;
    }
    cell.children('span').attr('data-tooltip', tip);
}

/*
Work out the route options for current player with the dice as rolled, and preview the 1st:
that is the route an AI player of its level chooses (as Smart AI, if a human player).
Options are: every clue that can be landed on, and the best few spaces to wait at;
or just the chosen route, if human player is only to confirm it.
*/
function suggestMove()
{
    if (ignoredPlayers[who]) //has left the game
    {
        return;
    }
    clearMovePlan();
    const start = playerPositions[who],
        level = moveAiLevel(who) || 'smart',
        //Weak AI always takes the dummy clue counter for a real one; Smart AI only now and then
        fooledByDummy = (moveAiLevel(who) === 'weak')
            || ((moveAiLevel(who) === 'smart') && (Math.random() < MOVE_SMART_DUMMY_CHANCE)),
        state = moveGatherState(fooledByDummy),
        //@retval route options, when at most given number of stair jumps can be made
        plan = (maxJumps) => {
            const list = [];
            for (const option of movePlan(state, level, MOVE_MAX_WAIT_OPTIONS, maxJumps))
            {
                option.path.forEach((step, i) => {
                    step.show = moveShowCell(step, (i > 0)? option.path[i - 1].show: start);
                });
                list.push(option);
                if (moveConfirmOnly()) break;
            }
            return list;
        };
    let options;
    moveStairsNote = '';
    moveBumpPreferSmart = undefined;
    if (level !== 'weak')
    {
        options = plan(Infinity);
        //Smart AI: with a weapon/ornament clue to be had but out of reach this throw, it looks to bump someone instead
        const hasSuperClue = Object.keys(state.targets).some((cell) => state.targets[cell].kind !== 'counter');
        if (MOVE_AI_BUMP && (moveAiLevel(who) === 'smart') && hasSuperClue
            && !options.some((option) => option.tier === MOVE_TIER_SUPER_CLUE))
        {
            moveBumpPreferSmart = (Math.random() < MOVE_SMART_BUMP_SMART_CHANCE);
            state.bump = { preferSmart: moveBumpPreferSmart };
            options = plan(Infinity);
            moveStairsNote += ` Cannot reach the weapon/ornament clue, so out to bump ${moveBumpPreferSmart? 'a Smart AI player': 'any player'}.`;
        }
    }
    else if (Math.random() < MOVE_WEAK_FORGET_STAIRS) //Weak AI forgets the stairs now and then, and walks instead
    {
        moveStairsNote = ' Forgot about the stairs this time.';
        options = plan(0);
        if (options.length <= 0) //has to move, so it remembers after all
        {
            moveStairsNote = ' Nearly forgot about the stairs.';
            options = plan(MOVE_WEAK_MAX_JUMPS);
        }
    }
    else
    {
        options = plan(MOVE_WEAK_MAX_JUMPS);
    }
    if (fooledByDummy && (level === 'smart'))
    {
        moveStairsNote += ' Not telling the dummy clue counter from the real ones this time.';
    }
    if (options.length <= 0)
    {
        moveShowPanel(`${movePlayerIcon()} No move possible for ${movePlayerString()}
            with dice ${diceOne.val} &amp; ${diceTwo.val}.
            <button onclick='clearMovePlan();'>Clear</button>`);
        return;
    }
    moveOptions = options;
    showMoveOption(1);
    const cell = $(`#cell_played${start}`)[0];
    if (cell)
    {
        cell.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
}

function nextMoveOption()
{
    if (!moveOptions)
    {
        return;
    }
    showMoveOption((moveOptionNum % moveOptions.length) + 1);
}

//Make the previewed move
function acceptMove()
{
    if (!moveCurrent || moveAutoBusy)
    {
        return;
    }
    moveMakeMove(moveCurrent.path[moveCurrent.path.length - 1].show, moveCurrent.path);
}

//Move current player to given cell at once, by the game's own click handling, so that whatever is there gets triggered
function moveMakeMoveNow(cellId)
{
    const coords = moveCellCoords(cellId),
        hadCounter = (placedClues[cellId] !== undefined);
    clearMovePlan();
    moveGameCellClicked(coords[0], coords[1]);
    //game leaves the token behind for 'take card from player' clue counters; bring it over
    if (hadCounter && (playerPositions[who] !== cellId) && !bumpMode && !$(`#cell${cellId}`).hasClass('cell_occupied'))
    {
        movePlayerThere(who, cellId);
    }
}

//Walk the walking token along given route, step by step; a stair jump takes longer
//@retval false if stopped meanwhile
async function moveWalkPath(walker, path, stopped)
{
    for (const step of path)
    {
        const to = moveCellCentre(step.show);
        await moveSleep(30); //let walker be drawn where it is, before it is sent on
        if (stopped()) return false;
        walker.toggleClass('move_walker_jump', !!step.jump);
        moveFitBubble(walker.children('.move_bubble'), to[0]);
        //takes most of the step's time to get there, then stands a moment
        walker.css({
            'transition-duration': `${Math.round((step.jump? MOVE_AUTO_JUMP_MS: MOVE_AUTO_STEP_MS) * 0.85)}ms`,
            left: `${to[0]}px`,
            top: `${to[1]}px`
        });
        $(`#cell${step.show}_container`)[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        await moveSleep(step.jump? MOVE_AUTO_JUMP_MS: MOVE_AUTO_STEP_MS);
    }
    if (stopped()) return false;
    walker.removeClass('move_walker_jump');
    return true;
}

//Move current player (human or AI) to given cell.
//If a route is given (the one shown, on 'Accept Move'): the token walks it step by step, as in auto-mode.
//If the move takes a clue counter/weapon/ornament: the token goes over to it first, then the item pops off the board,
//and only then is the move made in the game.
//@param path (array) optional; steps of the route to walk, that ends on given cell
async function moveMakeMove(cellId, path)
{
    const takesItem = moveTakesItemAt(cellId);
    if (!path)
    {
        clearMovePlan();
        if (!takesItem)
        {
            moveMakeMoveNow(cellId);
            return;
        }
    }
    moveAutoStop();
    const run = moveAutoRun,
        stopped = () => (run !== moveAutoRun),
        start = playerPositions[who],
        from = moveCellCentre(start),
        walker = $(`<div id='divMoveWalker' class='cell_player_${who}'><div class='move_swirl'></div></div>`);
    moveAutoBusy = true; //no clicks nor rolls meanwhile
    walker.css({ left: `${from[0]}px`, top: `${from[1]}px` });
    $('#divPlayingArea').append(walker);
    $(`#cell_played${start}`).addClass('move_token_hidden');
    moveUpdateSwirl(); //swirl is with the walking token now
    if (path) //route stays on show while it is walked
    {
        moveAutoLocked = true;
        showMoveOption(moveOptionNum);
        const bubble = $(`<div class='move_bubble'>${moveBubbleHtml(moveCurrent, moveCurrent.target? '&#x1F603;': '&#x1F605;')}</div>`);
        walker.append(bubble);
        moveFitBubble(bubble, from[0]);
    }
    if (!await moveWalkPath(walker, path || [{ show: cellId }], stopped)) return;
    if (takesItem)
    {
        await moveTakeItem(cellId);
        if (stopped()) return;
    }
    moveAutoStop();
    moveMakeMoveNow(cellId);
}

//@retval true if moving onto given cell takes the clue counter/weapon/ornament there
function moveTakesItemAt(cellId)
{
    if (bumpMode) //a click now is to place the bumped player
    {
        return false;
    }
    if (placedClues[cellId] !== undefined)
    {
        return true;
    }
    if (placedWeapons[cellId] !== undefined)
    {
        return (activeClues.indexOf(placedWeapons[cellId]) >= 0);
    }
    if (placedOrns[cellId] !== undefined)
    {
        return (activeClues.indexOf(placedOrns[cellId] + WEAPONS.length) >= 0);
    }
    return false;
}

//@retval style class(es) that give the picture of the clue counter/weapon/ornament on given cell
function moveItemClass(cellId)
{
    return $(`#cell${cellId}`)[0].className.split(' ').filter((c) => /^cell_(clue_counter|wpn_|orn_)/.test(c)).join(' ');
}

//@retval HTML of the pictures of where given cell is: its room, or the garden (the outer 2 rings of the board);
//none for the corridors. Then that of the stairs, if it is one.
function movePlaceIcons(cellId)
{
    const coords = moveCellCoords(cellId),
        numRows = BOARD.length,
        numCols = BOARD[0].length / 2,
        room = allRoomSlots[cellId],
        icon = (name) => `<img class='move_bubble_place' src='images/${name}.png'>`;
    let icons = '';
    if (room)
    {
        icons = icon(CARD_IMAGES[MOVE_ROOM_CARDS[room]]);
    }
    else if ((coords[0] < 2) || (coords[1] < 2) || (coords[0] >= numRows - 2) || (coords[1] >= numCols - 2))
    {
        icons = icon('room-garden');
    }
    if (getMoveGraph().isStair[moveSpaceOf(cellId)])
    {
        icons += icon('stair');
    }
    return icons;
}

//@retval HTML for a speech bubble about given route: where it ends, what it gets there (if anything), and given emoji
function moveBubbleHtml(option, emoji)
{
    const end = option.path[option.path.length - 1].show,
        item = option.target? `<span class='move_bubble_item ${moveItemClass(end)}'></span>`: '';
    return movePlaceIcons(end) + item + emoji;
}

//Keep a speech bubble within the page when its token is near the left/right edge: it is shifted sideways,
//while its tail stays over the token
//@param x (pixels) centre of the token, from left of the playing area
function moveFitBubble(bubble, x)
{
    if (bubble.length <= 0)
    {
        return;
    }
    const half = bubble[0].offsetWidth / 2,
        centre = $('#divPlayingArea').offset().left + x,
        pageWidth = document.documentElement.scrollWidth,
        margin = 4;
    let shift = 0;
    if (centre - half < margin)
    {
        shift = margin - (centre - half);
    }
    else if (centre + half > pageWidth - margin)
    {
        shift = pageWidth - margin - (centre + half);
    }
    shift = Math.max(20 - half, Math.min(half - 20, shift)); //tail stays on the bubble
    bubble[0].style.setProperty('--move-bubble-shift', `${Math.round(shift)}px`);
}

//Speech bubble over the token of current player, about the route on show: a suggestion for a human player,
//or an AI player's choice that is to be accepted. The token's tooltip (dice rolled etc.) then opens above the bubble.
//None while the token is out walking: its stand-in has the bubble then.
function moveShowPlanBubble()
{
    $('.move_plan_bubble').remove();
    $('.move_has_bubble').removeClass('move_has_bubble');
    if (!moveCurrent || moveAutoBusy)
    {
        return;
    }
    const start = playerPositions[who],
        at = moveCellCentre(start),
        cell = $(`#cell_played${start}`),
        holder = $(`<div class='move_cell_bubble move_plan_bubble' style='left: ${at[0]}px; top: ${at[1]}px;'>
            <div class='move_bubble'>${moveBubbleHtml(moveCurrent, '&#x1F914;')}</div></div>`),
        bubble = holder.children('.move_bubble');
    $('#divPlayingArea').append(holder);
    moveFitBubble(bubble, at[0]);
    const tip = cell.children('span')[0];
    if (tip)
    {
        const lift = tip.getBoundingClientRect().top - bubble[0].getBoundingClientRect().top + 6;
        cell.addClass('move_has_bubble');
        cell[0].style.setProperty('--move-tip-lift', `${Math.round(lift)}px`);
    }
}

/*
Pop the clue counter/weapon/ornament on given cell off the board, with a triumphant speech bubble
over the walking token. For when that token has arrived on the cell.
@return promise that is done when the item is gone
*/
function moveTakeItem(cellId)
{
    const at = moveCellCentre(cellId),
        itemClass = moveItemClass(cellId),
        walker = $('#divMoveWalker');
    $('#divPlayingArea').append(`<div class='move_take ${itemClass}'
        style='left: ${at[0]}px; top: ${at[1]}px; animation-duration: ${MOVE_AUTO_TAKE_MS}ms;'></div>`);
    $(`#cell${cellId}`).addClass('move_item_taken');
    if (walker.children('.move_bubble').length <= 0)
    {
        walker.append(`<div class='move_bubble'></div>`);
    }
    let says = `${movePlaceIcons(cellId)}<span class='move_bubble_item ${itemClass}'></span>&#x1F973;`;
    const clueId = placedClues[cellId];
    if (clueId !== undefined)
    {
        //clue counter flips over to show its number; then triumph, or tears if it is the dummy
        const ms = (part) => `${Math.round(MOVE_AUTO_TAKE_MS * part)}ms`;
        says = `${movePlaceIcons(cellId)}<span class='move_flip'>
                <span class='move_flip_inner' style='animation-delay: ${ms(0.1)}; animation-duration: ${ms(0.3)};'>
                    <span class='move_flip_front ${itemClass}'></span>
                    <span class='move_flip_back'>${clueId}</span>
                </span>
            </span><span class='move_flip_emoji' style='animation-delay: ${ms(0.45)};'>${(clueId === 0)? '&#x1F62D;': '&#x1F973;'}</span>`;
    }
    walker.children('.move_bubble')[0].innerHTML = says;
    moveFitBubble(walker.children('.move_bubble'), at[0]);
    return moveSleep(MOVE_AUTO_TAKE_MS);
}

//----------------------------------------------------------------------------
// Auto-play: computer makes the whole move of an AI player by itself
//----------------------------------------------------------------------------

function moveSleep(ms)
{
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

//Stop an auto-play that is underway (if any), and tidy up its animations
function moveAutoStop()
{
    ++moveAutoRun;
    moveAutoBusy = false;
    moveAutoLocked = false;
    $('#divMoveWalker, #divMoveBumped, .move_take, .move_cell_bubble').remove();
    $('.move_token_hidden').removeClass('move_token_hidden');
    $('.move_item_taken').removeClass('move_item_taken');
    $('.move_button_pressed').removeClass('move_button_pressed');
    moveUpdateSwirl();
}

//----------------------------------------------------------------------------
// Bumping (rule #13): AI player that has just entered a room and stopped next to another player,
// may put that player somewhere else on the board
//----------------------------------------------------------------------------

//@retval true if nothing is on given cell: no player, weapon, ornament nor clue counter
function moveIsFreeCell(cellId)
{
    if ((placedClues[cellId] !== undefined) || (placedWeapons[cellId] !== undefined) || (placedOrns[cellId] !== undefined))
    {
        return false;
    }
    return !playerPositions.some((pos, playerId) => !ignoredPlayers[playerId] && (pos === cellId));
}

//@retval { cellId: steps } on foot (no stair jumps; only walls in the way) from the nearest of the given cells
function moveWalkDistances(sources)
{
    const g = getMoveGraph(),
        dist = {},
        queue = [];
    sources.forEach((cellId) => {
        const space = moveSpaceOf(cellId);
        if (dist[space] === undefined)
        {
            dist[space] = 0;
            queue.push(space);
        }
    });
    for (let i = 0; i < queue.length; ++i)
    {
        g.walk[queue[i]].forEach((c) => {
            if (dist[c] === undefined)
            {
                dist[c] = dist[queue[i]] + 1;
                queue.push(c);
            }
        });
    }
    return dist;
}

//@retval IDs of the other players in the same room as given player, on a space next to it (diagonals count, as in the game's check)
function moveNextTo(playerId)
{
    const own = playerPositions[playerId],
        at = moveCellCoords(own),
        list = [];
    playerPositions.forEach((pos, otherId) => {
        if ((otherId === playerId) || ignoredPlayers[otherId] || !allRoomSlots[own] || (allRoomSlots[pos] !== allRoomSlots[own])) return;
        const coords = moveCellCoords(pos);
        if ((Math.abs(coords[0] - at[0]) <= 1) && (Math.abs(coords[1] - at[1]) <= 1))
        {
            list.push(otherId);
        }
    });
    return list;
}

//Weak AI just puts the bumped player out of the room: any free space of the corridors & garden that is
//within a few steps of the nearest one; be it towards the middle of the board or outwards.
//@retval cellId; or false if there is none
function moveBumpSpotWeak(bumpedId)
{
    const g = getMoveGraph(),
        dist = moveWalkDistances([playerPositions[bumpedId]]),
        spots = Object.keys(dist).filter((c) => !allRoomSlots[c] && !g.isStair[c] && moveIsFreeCell(c));
    if (spots.length <= 0)
    {
        return false;
    }
    const nearest = Math.min(...spots.map((c) => dist[c])),
        near = spots.filter((c) => dist[c] <= nearest + MOVE_WEAK_BUMP_SPREAD);
    return near[randInt(near.length)];
}

//Smart AI puts the bumped player where it is of least use: a free space in a room with no players, or in the
//corridors & garden, that is the most steps (on foot) from any stairs, weapon/ornament clue and clue counter.
//@retval cellId; or false if there is none
function moveBumpSpotSmart(bumpedId)
{
    const g = getMoveGraph(),
        useful = [...g.stairs, ...Object.keys(placedClues)],
        roomsInUse = {}; //key of room: true if a player (other than the bumped one) is in it
    Object.keys(placedWeapons).forEach((c) => {
        if (activeClues.indexOf(placedWeapons[c]) >= 0) useful.push(c);
    });
    Object.keys(placedOrns).forEach((c) => {
        if (activeClues.indexOf(placedOrns[c] + WEAPONS.length) >= 0) useful.push(c);
    });
    playerPositions.forEach((pos, playerId) => {
        if (!ignoredPlayers[playerId] && (playerId !== bumpedId) && allRoomSlots[pos])
        {
            roomsInUse[allRoomSlots[pos]] = true;
        }
    });
    const dist = moveWalkDistances(useful),
        spots = Object.keys(dist).filter((c) => !g.isStair[c] && !roomsInUse[allRoomSlots[c]] && moveIsFreeCell(c));
    if (spots.length <= 0)
    {
        return false;
    }
    const furthest = Math.max(...spots.map((c) => dist[c])),
        far = spots.filter((c) => dist[c] === furthest);
    return far[randInt(far.length)];
}

/*
If AI player has, by the move just made, entered a room and stopped next to other player(s), it bumps one of them:
  > Weak AI: any one of them, to just outside the room.
  > Smart AI: half the time any one of them, half the time a Smart AI player among them (if any); to a useless place.
Shown on the board (bumped token flies off), then done by the game's own bumping.
@param stopped (function) true if auto-play has been stopped
*/
async function moveAutoBump(player, level, stopped)
{
    if (!MOVE_AI_BUMP || !enteredRoom)
    {
        return;
    }
    const others = moveNextTo(player);
    if (others.length <= 0)
    {
        return;
    }
    let pool = others;
    if (level === 'smart')
    {
        const smart = others.filter((playerId) => moveAiLevel(playerId) === 'smart'),
            preferSmart = moveBumpPreferSmart ?? (Math.random() < MOVE_SMART_BUMP_SMART_CHANCE);
        if (preferSmart && (smart.length > 0))
        {
            pool = smart;
        }
    }
    const bumped = pool[randInt(pool.length)],
        spot = (level === 'weak')? moveBumpSpotWeak(bumped): moveBumpSpotSmart(bumped);
    if (!spot)
    {
        return;
    }

    //show it on the board: a wicked grin from the one bumping; the bumped token flies off, dizzy
    const own = playerPositions[player],
        from = playerPositions[bumped],
        at = moveCellCentre(own),
        start = moveCellCentre(from),
        flyer = $(`<div id='divMoveBumped' class='cell_player_${bumped}'><div class='move_bubble'>&#x1F635;</div></div>`);
    $(`#cell${own}_container`)[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    $('#divPlayingArea').append(`<div class='move_cell_bubble' style='left: ${at[0]}px; top: ${at[1]}px;'>
        <div class='move_bubble'>&#x1F608;</div></div>`);
    flyer.css({ left: `${start[0]}px`, top: `${start[1]}px` });
    $('#divPlayingArea').append(flyer);
    $(`#cell_played${from}`).addClass('move_token_hidden');
    await moveSleep(MOVE_AUTO_BUMP_MS / 2);
    if (stopped()) return;
    const end = moveCellCentre(spot);
    flyer.addClass('move_walker_jump');
    flyer.css({ 'transition-duration': `${Math.round(MOVE_AUTO_BUMP_MS * 0.85)}ms`, left: `${end[0]}px`, top: `${end[1]}px` });
    $(`#cell${spot}_container`)[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    await moveSleep(MOVE_AUTO_BUMP_MS * 1.5);
    if (stopped()) return;

    //do it by the game's own bumping: click on the player, then on where to. That replaces what the game
    //has said of the move just made, so put that back after
    const said = $('#divStatus')[0].innerHTML,
        a = moveCellCoords(from),
        b = moveCellCoords(spot);
    $('#divMoveBumped, .move_cell_bubble').remove();
    $('.move_token_hidden').removeClass('move_token_hidden');
    moveGameCellClicked(a[0], a[1]);
    if (bumpMode)
    {
        moveGameCellClicked(b[0], b[1]);
    }
    bumpMode = false;
    $('#divStatus')[0].innerHTML = said;
    if (playerPositions[bumped] === spot)
    {
        appendStatus(`${movePlayerIcon(player)} <b>${PLAYERS[player]}</b> entered the ${MOVE_ROOM_NAMES[allRoomSlots[own]]}
            and bumped ${movePlayerIcon(bumped)} <b>${PLAYERS[bumped]}</b> out, to @ ${b[1]}, ${b[0]}.`, undefined, true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await moveSleep(MOVE_AUTO_BUTTON_MS);
}

//Click a button of the page on behalf of the AI player, showing it as pressed for a moment
function moveAutoPress(button)
{
    button.addClass('move_button_pressed');
    button[0].click();
    setTimeout(() => {
        button.removeClass('move_button_pressed');
    }, 800);
}

//Tell human player to roll the dice for the AI player whose turn it is
function moveShowRollPrompt()
{
    moveShowPanel(`${movePlayerIcon()} ${movePlayerString()} is a computer player: roll the dice for its move.`);
}

//AI player rolls the dice by itself to start its turn, after a while in which human player may interrupt
async function moveAutoRollStart()
{
    moveAutoStop();
    const run = moveAutoRun;
    moveShowPanel(`${movePlayerIcon()} ${movePlayerString()} is looking for the dice...
        <button onclick='moveAutoInterrupt();'>Interrupt</button>`);
    await moveSleep(MOVE_ROLL_START_MS);
    if (run !== moveAutoRun) return; //interrupted; or dice rolled, or turn passed on, by human player meanwhile
    moveShowPanel('');
    moveGameDiceClicked('dice1');
}

//Auto-mode: dice have just been thrown for an AI player. The dice are left in view until they have come to rest;
//only then is its move worked out (which goes to its token), and made or re-rolled.
async function moveAutoAfterRoll()
{
    moveAutoStop();
    clearMovePlan();
    const run = moveAutoRun;
    if (MOVE_DICE_ROLL_MS > 0)
    {
        moveAutoBusy = true; //no clicks nor rolls meanwhile
        await moveSleep(MOVE_DICE_ROLL_MS);
        if (run !== moveAutoRun) return; //stopped
        moveAutoBusy = false;
    }
    suggestMove();
    if (moveAutoWantsReroll())
    {
        moveAutoReroll();
    }
    else if (moveOptions)
    {
        moveAutoPlay();
    }
}

//Human player stops the AI player from rolling the dice by itself; it is then for the human to roll for it
function moveAutoInterrupt()
{
    moveAutoStop();
    moveShowRollPrompt();
}

//Put the circling swirl on the token of the player whose turn it is
function moveUpdateSwirl()
{
    $('.cell_container2 > .move_swirl').remove();
    if ($('#divMoveWalker').length > 0) //token is out walking; its stand-in has the swirl
    {
        return;
    }
    const cellId = playerPositions[who];
    if ((cellId === undefined) || ignoredPlayers[who])
    {
        return;
    }
    $(`#cell${cellId}_container .cell_container2`).append(`<div class='move_swirl'></div>`);
}

//@retval true if AI player, with routes worked out for the dice as rolled, would rather roll again:
//got low doubles (which may be re-rolled) that get it no clue, or no move at all
function moveAutoWantsReroll()
{
    if (diceOne.val !== diceTwo.val)
    {
        return false;
    }
    if (!moveOptions)
    {
        return true;
    }
    return (diceOne.val <= MOVE_REROLL_DOUBLES_UP_TO) && !moveOptions[0].target;
}

//AI player chooses to re-roll its doubles: goes to top of page, says why, waits a bit, then clicks the dice
async function moveAutoReroll()
{
    moveAutoStop();
    const run = moveAutoRun,
        val = diceOne.val,
        why = moveOptions? `cannot land on any clue with ${val} or ${val * 2} steps`: 'cannot move with that';
    moveAutoBusy = true;
    clearMovePlan();
    showStatus(`${movePlayerIcon()} ${movePlayerString()} rolled a low double (${val} &amp; ${val}), and ${why}.
        Doubles may be re-rolled, so it chooses to <b>roll again</b>...`, undefined, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await moveSleep(MOVE_REROLL_MS);
    if (run !== moveAutoRun) return; //stopped
    moveAutoStop();
    moveGameDiceClicked('dice1');
}

//@retval true if the game was waiting on a choice from the player, and one has been made for the AI player
function moveAutoAnswer()
{
    if (curActionCard) //Super Clue card waiting to be opened
    {
        handleActionCard();
        return true;
    }
    let button = $('#divChoiceOfPlayers button').last(); //'Random' player to take a card from
    if (button.length <= 0)
    {
        button = $('#divChoiceOfCards button').last(); //'Random' card of a player
    }
    if (button.length > 0)
    {
        moveAutoPress(button);
        return true;
    }
    const div = $('div[id^=divChoiceOfCards]').first(); //a card from each player: 1 div per player
    if (div.length > 0)
    {
        const playerId = parseInt(div[0].id.substring('divChoiceOfCards'.length), 10);
        transferCard2(div[0].id, randInt(playerCardDecks[playerId].length), playerId);
        return true;
    }
    return false;
}

/*
Make the move of the AI player all by itself, for the routes already worked out and shown:
  1. look over a few of the routes, as if thinking,
  2. lock in on its choice (route #1),
  3. walk the token along it step by step, and take what is there,
  4. go to top of page and trigger the game's handling of the move,
  5. press the buttons that follow: choices asked by the game, then 'Analyze' and 'Act' of its level
     if it has gained Murder cards or flaps to look under.
Then it is back to the human, to roll again (if a new clue is revealed) or click 'Next Player'.
*/
async function moveAutoPlay()
{
    moveAutoStop();
    const run = moveAutoRun,
        stopped = () => (run !== moveAutoRun),
        player = who,
        level = moveAiLevel(player),
        start = playerPositions[player];
    moveAutoBusy = true;
    //the token that will do the walking takes the place of the real one, with a speech bubble that goes along
    const centre = moveCellCentre(start),
        walker = $(`<div id='divMoveWalker' class='cell_player_${player}'><div class='move_swirl'></div><div class='move_bubble'></div></div>`),
        //put in the bubble: what the route being shown is for (clue counter/weapon/ornament, if any), and given emoji
        say = (emoji) => {
            walker.children('.move_bubble')[0].innerHTML = moveBubbleHtml(moveCurrent, emoji);
            moveFitBubble(walker.children('.move_bubble'), centre[0]);
        };
    walker.css({ left: `${centre[0]}px`, top: `${centre[1]}px` });
    $('#divPlayingArea').append(walker);
    $(`#cell_played${start}`).addClass('move_token_hidden');
    moveUpdateSwirl(); //swirl is with the walking token now
    showMoveOption(1); //again, for panel to show that computer is at it
    say('&#x1F914;');

    //1. look over a few routes, thinking
    const numViews = Math.min(MOVE_AUTO_VIEWS, moveOptions.length - 1);
    await moveSleep(MOVE_AUTO_VIEW_MS);
    for (let i = 0; i < numViews; ++i)
    {
        if (stopped()) return;
        let choice = 1 + randInt(moveOptions.length);
        if (choice === moveOptionNum) //always switch to another
        {
            choice = (choice % moveOptions.length) + 1;
        }
        showMoveOption(choice);
        say('&#x1F914;');
        await moveSleep(MOVE_AUTO_VIEW_MS);
    }
    if (stopped()) return;

    //2. lock in: happy with what it is going for; or embarrassed, if there is nothing to get
    moveAutoLocked = true;
    showMoveOption(1);
    const option = moveCurrent,
        dest = option.path[option.path.length - 1].show;
    say(option.target? '&#x1F603;': '&#x1F605;');
    await moveSleep(MOVE_AUTO_VIEW_MS);
    if (stopped()) return;

    //3. walk the token there
    if (!await moveWalkPath(walker, option.path, stopped)) return;
    if (option.target) //take the clue counter/weapon/ornament: pop it off the board
    {
        await moveTakeItem(dest);
        if (stopped()) return;
    }

    //4. pause a bit, then let the game handle the move, at top of page where it tells what happens
    await moveSleep(MOVE_AUTO_PAUSE_MS);
    if (stopped()) return;
    const numCards = playerCardDecks[player].length,
        clueObj = moveClueObjectAt(dest);
    moveAccusation = false;
    $('#divMoveWalker, .move_take').remove();
    $('.move_token_hidden').removeClass('move_token_hidden');
    moveMakeMoveNow(dest); //item has been popped off already
    $('.move_item_taken').removeClass('move_item_taken');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    //5. press the buttons that follow
    for (let i = 0; i < 12; ++i) //choices that the game asks for
    {
        await moveSleep(MOVE_AUTO_BUTTON_MS);
        if (stopped()) return;
        if (!moveAutoAnswer()) break;
    }
    await moveAutoBump(player, level, stopped); //if it has entered a room and stopped next to another player
    if (stopped()) return;
    if ((playerCardDecks[player].length > numCards) || (numKeys > 0)) //got Murder cards to study, or flaps to look under
    {
        const buttons = MOVE_AUTO_BUTTONS[level];
        if (MOVE_AUTO_ANALYZE)
        {
            moveAutoPress($(`button[onclick="${buttons.analyze}"]`).first());
            await moveSleep(MOVE_AUTO_BUTTON_MS * 2);
            if (stopped()) return;
        }
        moveAutoPress($(`button[onclick="${MOVE_AUTO_ACT_ALOUD? buttons.act: buttons.actSecretly}"]`).first());
        await moveSleep(MOVE_AUTO_BUTTON_MS * 2); //'Act' studies again shortly after each flap looked under
        if (stopped()) return;
    }

    //6. tell how things stand
    moveAutoLocked = false;
    if (!moveAccusation && clueObj && (activeClues.indexOf(clueObj.id) >= 0) && MOVE_AUTO_ROLL_AGAIN)
    {
        //the game gives another turn for finding where a clue is: roll for it, after a pause
        appendStatus(`${movePlayerIcon()} ${movePlayerString()} found that there is a clue on the <b>${clueObj.name}</b>,
            so has <b>another turn</b>: rolling the dice again...`, undefined, true);
        await moveSleep(MOVE_ROLL_AGAIN_MS);
        if (stopped()) return;
        moveAutoStop();
        moveGameDiceClicked('dice1');
        return;
    }
    moveAutoBusy = false;
    let outcome = `has ended ${PLAYER_PRONOUNS[player]} turn: click <b>Next Player</b>.${moveTurnEndSmile(player)}`;
    if ((moveAccusation === 'right') && moveFinishedPlayers[player]) //has left the game, and that has been told
    {
        return;
    }
    if (moveAccusation === 'right')
    {
        outcome = 'has solved the mystery &#x1F3C6; Game over.';
    }
    else if (moveAccusation === 'wrong')
    {
        outcome = 'made a wrong accusation. Click <b>Next Player</b>.';
    }
    else if (clueObj && (activeClues.indexOf(clueObj.id) >= 0)) //the game gives another turn for finding where a clue is
    {
        outcome = `found that there is a clue on the <b>${clueObj.name}</b>, so has <b>another turn</b>: roll the dice for it.`;
    }
    appendStatus(`${movePlayerIcon()} ${movePlayerString()} ${outcome}`, undefined, true);
}

/*
AI player that has solved the mystery (current player) leaves the game, and the rest play on:
its token is taken off the board, and its turns are skipped from now on, as for a player taken out of the game.
What the game shows of the accusation (hidden, with its reveal buttons) and its accusation boxes are left as they are.
Not done if it is the only player left: then the game is over.
*/
function moveSolverLeaves()
{
    const player = who;
    if (!PLAYERS.some((name, playerId) => (playerId !== player) && !ignoredPlayers[playerId]))
    {
        return;
    }
    const cellId = playerPositions[player],
        cell = $(`#cell_played${cellId}`);
    ignoredPlayers[player] = true;
    moveFinishedPlayers[player] = true;
    $(`#cb_player_${player}`)[0].checked = false; //the game makes out who is playing from these
    NUM_PLAYERS = 9 - Object.keys(ignoredPlayers).length;
    cell.removeClass(`cell_player_${player} shimmer pulsate`);
    cell[0].innerHTML = '';
    $(`#cell${cellId}`).removeClass('cell_occupied');
    moveUpdateSwirl();
    appendStatus(`<span id='spanMoveSolved'>${movePlayerIcon()} ${movePlayerString()} has solved the mystery &#x1F3C6; and leaves the game.
        The others play on: click <b>Next Player</b>.</span>`, undefined, true);
}

//@retval true if current player has left the game, so can do nothing but have 'Next Player' clicked
function moveHasLeft()
{
    return !!ignoredPlayers[who];
}

//@retval true if given player has looked under at least 1 flap of each of the 3 card holders
function moveHasSeenAllHolders(playerId)
{
    const data = playersData[playerId];
    if (!data || !data.clues || !data.clues.cardHolders)
    {
        return false;
    }
    return data.clues.cardHolders.every((flaps) => flaps.some((code) => code > 0));
}

//@retval HTML of huge grins, for an AI player that has seen into all 3 card holders and cannot always hide it;
//else ''
function moveTurnEndSmile(playerId)
{
    if (!moveHasSeenAllHolders(playerId) || (Math.random() >= MOVE_SMILE_CHANCE))
    {
        return '';
    }
    return ` <span class='move_grin'>&#x1F601;&#x1F601;&#x1F601;</span>`;
}

//Throw a flourish of confetti up from the status printout, to celebrate
function moveThrowConfetti()
{
    const at = $('#divStatus')[0].getBoundingClientRect(),
        colours = ['#f44', '#fc0', '#3c3', '#39f', '#c5f', '#f80', '#0cc'],
        rand = (from, to) => from + Math.random() * (to - from);
    let pieces = '';
    for (let i = 0; i < MOVE_CONFETTI_PIECES; ++i)
    {
        //each piece shoots up and sideways from around the middle, then flutters down
        pieces += `<span style='left: ${rand(35, 65).toFixed(1)}%;
            width: ${rand(7, 13).toFixed(0)}px; height: ${rand(10, 20).toFixed(0)}px;
            background: ${colours[i % colours.length]};
            --dx: ${rand(-650, 650).toFixed(0)}px; --up: ${rand(-60, -260).toFixed(0)}px; --turn: ${rand(-900, 900).toFixed(0)}deg;
            animation-duration: ${rand(MOVE_CONFETTI_MS * 0.55, MOVE_CONFETTI_MS).toFixed(0)}ms; animation-delay: ${rand(0, 0.5).toFixed(2)}s;'></span>`;
    }
    const confetti = $(`<div class='move_confetti' style='top: ${Math.round(at.top + window.scrollY)}px;'>${pieces}</div>`);
    $('body').append(confetti);
    setTimeout(() => {
        confetti.remove();
    }, MOVE_CONFETTI_MS + 1000);
}

//@retval { id, name } of the weapon/ornament that the clue counter on given cell says has a clue; else false
function moveClueObjectAt(cellId)
{
    const clue = CLUES[placedClues[cellId]];
    if (!clue || (clue[1] !== 'clue'))
    {
        return false;
    }
    return { id: clue[2], name: clue[3] };
}

function clearMovePlan()
{
    moveOptions = false;
    moveCurrent = false;
    moveOptionNum = 0;
    moveClearPrints();
    moveClearRoutes();
    moveShowTokenTip();
    moveShowPlanBubble();
    const div = $('#divMovePlan')[0];
    if (div)
    {
        div.innerHTML = '';
    }
}

//Put sparkles on the weapons/ornaments on the board that have an active Super Clue, and off the rest
function moveUpdateSparkles()
{
    $('.move_sparkle').remove();
    const sparkle = (cellId) => {
        $(`#cell${cellId}_container .cell_container2`).append(
            `<div class='move_sparkle'><span>&#x2728;</span><span>&#x2728;</span><span>&#x2728;</span></div>`);
    };
    Object.keys(placedWeapons).forEach((cellId) => {
        if (activeClues.indexOf(placedWeapons[cellId]) >= 0)
        {
            sparkle(cellId);
        }
    });
    Object.keys(placedOrns).forEach((cellId) => {
        if (activeClues.indexOf(placedOrns[cellId] + WEAPONS.length) >= 0)
        {
            sparkle(cellId);
        }
    });
}

function setMovePassOverClueCounters(choice)
{
    MOVE_PASS_OVER_CLUE_COUNTERS = choice;
    clearMovePlan();
}

function setMoveShowAllRoutes(choice)
{
    MOVE_SHOW_ALL_ROUTES = choice;
    clearMovePlan();
}

//Set who are the AI players, and tick them in the Players selection table
//@param aiPlayers ({ playerId: 'weak'/'smart' })
function moveSetAiPlayers(aiPlayers)
{
    moveAiPlayers = {};
    for (let i = 0; i < PLAYERS.length; ++i)
    {
        const level = MOVE_AI_LEVELS[aiPlayers[i]]? aiPlayers[i]: false,
            sel = $(`#sel_ai_${i}`);
        $(`#cb_ai_${i}`)[0].checked = !!level;
        sel.css('display', level? '': 'none');
        if (level)
        {
            sel[0].value = level;
            moveAiPlayers[i] = level;
        }
    }
    moveRememberAiPlayers();
}

//Keep who are the AI players across page reloads, whether or not a saved game is restored then
function moveRememberAiPlayers()
{
    localStorage.aiPlayers = JSON.stringify(moveAiPlayers);
}

//Set the AI players as they were when the page was last open
function moveRecallAiPlayers()
{
    if (localStorage.aiPlayers === undefined)
    {
        return;
    }
    try
    {
        moveSetAiPlayers(JSON.parse(localStorage.aiPlayers));
    }
    catch (e)
    {
        console.log('Cannot recall AI players', e);
    }
}

//'AI' checkbox or its level of given player has been changed
function updateAiSelection(playerId)
{
    const isAi = $(`#cb_ai_${playerId}`)[0].checked,
        sel = $(`#sel_ai_${playerId}`);
    sel.css('display', isAi? '': 'none');
    if (isAi)
    {
        moveAiPlayers[playerId] = sel[0].value;
    }
    else
    {
        delete moveAiPlayers[playerId];
    }
    moveRememberAiPlayers();
    if (playerId === who)
    {
        clearMovePlan();
    }
}

//Rearrange each player's cell in the Players selection table:
//'use player' checkbox top left, 'AI' checkbox bottom left, and AI level below
function moveSetupPlayersTable()
{
    for (let i = 0; i < PLAYERS.length; ++i)
    {
        const cb = $(`#cb_player_${i}`),
            td = cb.parent(),
            label = td.children('label');
        let levels = '';
        Object.keys(MOVE_AI_LEVELS).forEach((level) => {
            levels += `<option value='${level}'>${MOVE_AI_LEVELS[level]}</option>`;
        });
        cb.detach();
        label.detach();
        td.empty();
        td.append(`<div class='player_pick'>
                <div class='player_pick_opts'>
                    <span data-tooltip-position='${(i!==0)?'top':'top-right'}' data-tooltip='Computer makes the moves of this player'>
                        <input type='checkbox' class='big_checkbox checkbox_ai' id='cb_ai_${i}' name='cb_ai_${i}' onclick='updateAiSelection(${i});'>
                        <label for='cb_ai_${i}' class='player_pick_ai'>AI</label></span>
                </div>
            </div>
            <select id='sel_ai_${i}' class='player_pick_level' style='display: none;' onchange='updateAiSelection(${i});'>${levels}</select>`);
        td.find('.player_pick_opts').prepend(cb);
        td.find('.player_pick').append(label);
    }
}

//Hook into the game: suggest move for AI player upon dice roll; and drop a preview once the board changes
function moveInstallHooks()
{
    if (!diceOne) //dice are created upon document ready too; so wait for that
    {
        setTimeout(moveInstallHooks, 50);
        return;
    }
    const rollHandler = diceOne.rollHandler,
        gameCellClicked = cellClicked,
        gameDiceClicked = onDiceClicked,
        gameNextPlayer = nextPlayer,
        gameNewGameBoard = newGameBoard,
        gameSaveGame = saveGame,
        gameRestoreSavedGame = restoreSavedGame;
    diceOne.rollHandler = (diceId, val) => {
        rollHandler(diceId, val);
        moveUpdateSparkles(); //6+6 puts everything back on the board, elsewhere
        if (!moveAiLevel(who))
        {
            clearMovePlan();
        }
        else if (MOVE_AI_AUTO_PLAY)
        {
            moveAutoAfterRoll();
        }
        else
        {
            suggestMove();
        }
    };
    moveGameDiceClicked = gameDiceClicked;
    onDiceClicked = function(id)
    {
        if (moveAutoBusy) return; //no rolling while computer is making its move
        if (moveHasLeft()) return;
        gameDiceClicked(id);
    };
    moveGameCellClicked = function(y, x)
    {
        gameCellClicked(y, x);
        moveUpdateSparkles(); //a clue may have been revealed or taken
    };
    cellClicked = function(y, x)
    {
        const cellId = `${y}_${x}`,
            onOwnToken = (cellId === playerPositions[who]);
        if (moveAutoBusy || moveHasLeft()) //computer is making its move; or current player has left the game
        {
            return;
        }
        if (moveCurrent && onOwnToken && !moveConfirmOnly()) //each click on the token shows the next route
        {
            nextMoveOption();
            return;
        }
        if (moveCurrent && !moveAiLevel(who)) //human player: routes are only a suggestion; free to move anywhere
        {
            moveMakeMove(cellId);
            return;
        }
        if (moveCurrent) //AI player: can only be moved to where one of its routes ends
        {
            const optionNum = moveOptions.findIndex((option) => option.cell === moveSpaceOf(cellId)) + 1;
            if (onOwnToken) //(only its chosen route is shown, to be accepted)
            {
                showStatus(movePlayerIcon() + ' This is the move of the computer player: click <b>Accept Move</b> to go on.', undefined, true);
            }
            else if (optionNum > 0)
            {
                showMoveOption(optionNum);
                moveMakeMove(moveCurrent.path[moveCurrent.path.length - 1].show); //at once, as a click does
            }
            else
            {
                showStatus(movePlayerIcon() + ' Computer player can only be moved to the end of one of its routes (the numbered spaces).', undefined, true);
            }
            return;
        }
        if (onOwnToken && moveAiLevel(who))
        {
            suggestMove();
            return;
        }
        if (moveTakesItemAt(cellId)) //pop the item off the board, then make the move
        {
            moveMakeMove(cellId);
            return;
        }
        moveGameCellClicked(y, x);
    };
    nextPlayer = function(freshStart, dontSave)
    {
        moveAutoStop();
        clearMovePlan();
        gameNextPlayer(freshStart, dontSave);
        moveUpdateSwirl();
        if (!moveAiLevel(who))
        {
            return;
        }
        //(not at the start of a game: human player may still be deciding whether to restore a saved game instead)
        if (MOVE_AI_AUTO_PLAY && MOVE_AUTO_ROLL_START && !freshStart)
        {
            moveAutoRollStart();
        }
        else
        {
            moveShowRollPrompt();
        }
    };
    newGameBoard = function()
    {
        moveAutoStop();
        clearMovePlan();
        //AI players that solved the last game and left it, are back in
        Object.keys(moveFinishedPlayers).forEach((playerId) => {
            $(`#cb_player_${playerId}`)[0].checked = true;
        });
        moveFinishedPlayers = {};
        gameNewGameBoard();
        moveUpdateSparkles();
        moveUpdateSwirl();
    };
    //the swirl goes wherever the token of the current player goes
    const gameMovePlayerThere = movePlayerThere,
        gameUpdatePlayersSelection = updatePlayersSelection;
    movePlayerThere = function(playerId, cellId)
    {
        gameMovePlayerThere(playerId, cellId);
        moveUpdateSwirl();
    };
    updatePlayersSelection = function(playerId)
    {
        gameUpdatePlayersSelection(playerId);
        moveUpdateSwirl();
    };
    //right-click on the token of current player, while its routes are shown, clears them
    $('#divPlayingArea').on('contextmenu', 'td.cell_container', function(event) {
        if (!moveCurrent || moveAutoBusy || moveConfirmOnly() || (this.id !== `cell${playerPositions[who]}_container`))
        {
            return;
        }
        event.preventDefault();
        clearMovePlan();
    });
    //note how an accusation went: only the game's own check knows, and it tells by its message
    const gameAccuse = accuse;
    accuse = function()
    {
        gameAccuse();
        const said = $('#divStatus')[0].innerHTML;
        if (said.indexOf('You are Right') >= 0)
        {
            moveAccusation = 'right';
            moveThrowConfetti();
            if (moveAiLevel(who))
            {
                moveSolverLeaves();
            }
        }
        else if (said.indexOf('You are Wrong') >= 0)
        {
            moveAccusation = 'wrong';
        }
    };
    //who is AI, and of what level, goes into the saved game too
    saveGame = function()
    {
        gameSaveGame();
        const gameData = JSON.parse(localStorage.savedGame);
        gameData.aiPlayers = moveAiPlayers;
        gameData.finishedPlayers = moveFinishedPlayers; //{ playerId: true }
        localStorage.savedGame = JSON.stringify(gameData);
    };
    restoreSavedGame = function()
    {
        moveAutoStop();
        clearMovePlan();
        moveSetAiPlayers(JSON.parse(localStorage.savedGame).aiPlayers || {});
        gameRestoreSavedGame();
        moveFinishedPlayers = JSON.parse(localStorage.savedGame).finishedPlayers || {};
        //no rolling by itself right after a restore: the next message would wipe what the game says of the restore
        //(e.g. faults fixed in the saved game) before human player has read it
        if (moveAiLevel(who))
        {
            moveAutoInterrupt();
        }
        moveUpdateSparkles();
        moveUpdateSwirl();
    };
    //'Reset Options' puts the players back to default; so no AI players either
    const gameResetOptions = resetOptions;
    resetOptions = function()
    {
        moveSetAiPlayers({});
        moveFinishedPlayers = {};
        gameResetOptions();
    };
    moveUpdateSparkles();
    moveUpdateSwirl();
    //the game has begun already by now; if it is with an AI player, say so
    if (moveAiLevel(who))
    {
        moveShowRollPrompt();
    }
}

$(document).ready(() => {
    MOVE_PASS_OVER_CLUE_COUNTERS = $('#option_move_pass_counters')[0].checked;
    MOVE_SHOW_ALL_ROUTES = $('#option_move_show_all')[0].checked;
    moveSetupPlayersTable();
    moveRecallAiPlayers();
    moveInstallHooks();
});
