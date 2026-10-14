//Ferrules computer players ('AI'). Works on a plain copy of the game (aiState() in ferrules.js), so the same
//code runs on the page and in test/aitest.js. Design notes: ferrules-ai-design.md.

//A level is a row of numbers; the choosing code is the same for all levels.
const AI_TRAITS = {
    Friendly: { takesWin: 0.9, blocks: 0.6, centreShy: 0.8, budget: 0, solves: false, noise: 6 },
    Aggressive: { takesWin: 1, blocks: 1, centreShy: 0, budget: 20000, solves: false, noise: 0.5 },
    Perfect: { takesWin: 1, blocks: 1, centreShy: 0, budget: 60000, solves: true, noise: 0.5 },
};
const AI_LEVELS = Object.keys(AI_TRAITS),
    AI_WIN = 100000,
    AI_CENTRE = 13, //medium piece in the centre cell
    AI_SOLVE_BUDGET = 400000, //positions the exact solver may visit for one move
    AI_OUT_OF_TIME = { outOfTime: true };

//Slot i = (y * 3 + x) * 3 + s; s: 0 big, 1 medium, 2 small. A pattern is 3 slots that win together.
const AI_PATTERNS = (() =>
{
    const at = (y, x, s) => (y * 3 + x) * 3 + s,
        lines = [[[0, 0], [1, 1], [2, 2]], [[2, 0], [1, 1], [0, 2]]],
        pats = [];
    for (let i = 0; i < 3; ++i)
    {
        lines.push([[i, 0], [i, 1], [i, 2]], [[0, i], [1, i], [2, i]]);
    }
    for (const line of lines)
    {
        for (let s = 0; s < 3; ++s)
        {
            pats.push(line.map(([y, x]) => at(y, x, s))); //same size
        }
        pats.push(line.map(([y, x], k) => at(y, x, k))); //shrinking
        pats.push(line.map(([y, x], k) => at(y, x, 2 - k))); //enlarging
    }
    for (let c = 0; c < 9; ++c)
    {
        pats.push([c * 3, c * 3 + 1, c * 3 + 2]); //concentric
    }
    return pats;
})();
const AI_SLOT_PATTERNS = Array.from({ length: 27 }, (_, i) =>
    AI_PATTERNS.map((p, k) => (p.includes(i) ? k : -1)).filter((k) => k >= 0));
//Slots in the order worth trying: those in most patterns first
const AI_ORDER = Array.from({ length: 27 }, (_, i) => i)
    .sort((a, b) => AI_SLOT_PATTERNS[b].length - AI_SLOT_PATTERNS[a].length);

function aiCopy(st)
{
    return { ...st, cells: st.cells.slice(), pieces: st.pieces.map((p) => p.slice()) };
}

function aiCanPlay(st, p, i)
{
    return (st.cells[i] === -1) && !(st.banCentre && (i === AI_CENTRE))
        && (st.unlimited || (st.pieces[p][i % 3] > 0));
}

function aiMoves(st, p)
{
    return AI_ORDER.filter((i) => aiCanPlay(st, p, i));
}

//Would p win by playing slot i? (Slot i is taken to be empty.)
function aiWinsAt(st, p, i)
{
    const c = st.cells;
    for (const k of AI_SLOT_PATTERNS[i])
    {
        const pat = AI_PATTERNS[k];
        if (((pat[0] === i) || (c[pat[0]] === p)) && ((pat[1] === i) || (c[pat[1]] === p))
            && ((pat[2] === i) || (c[pat[2]] === p))) return true;
    }
    return false;
}

//Whether p has a line or concentric set on the board.
function aiWins(cells, p)
{
    return AI_PATTERNS.some((pat) => pat.every((j) => cells[j] === p));
}

//Player to move after p, once p has played (played already counted): the next one with a legal move;
//-1 when the game is over without a winner.
function aiNext(st, p)
{
    if (st.played >= st.maxPlayed) return -1;
    for (let k = 1; k <= st.players; ++k)
    {
        const q = (p + k) % st.players;
        for (let i = 0; i < 27; ++i)
        {
            if (aiCanPlay(st, q, i)) return q;
        }
    }
    return -1;
}

function aiPlay(st, i)
{
    const p = st.who;
    st.cells[i] = p;
    st.pieces[p][i % 3]--;
    st.played++;
    st.who = aiNext(st, p);
}

function aiUnplay(st, i, p)
{
    st.cells[i] = -1;
    st.pieces[p][i % 3]++;
    st.played--;
    st.who = p;
}

//Slots where p wins on its next move.
function aiThreats(st, p)
{
    const t = [];
    for (let i = 0; i < 27; ++i)
    {
        if (aiCanPlay(st, p, i) && aiWinsAt(st, p, i)) t.push(i);
    }
    return t;
}

//Who moves after p if p plays a slot that leaves the board as it is otherwise (-1: nobody).
function aiNextAfter(st, p)
{
    st.played++;
    st.pieces[p][0]--; //any piece will do for whether p itself can move again; rarely matters
    const q = aiNext(st, p);
    st.pieces[p][0]++;
    st.played--;
    return q;
}

//The moves p must consider: a win at once (alone), else the one slot that stops the next player's
//single threat, else (more than one threat, or one p cannot fill) no move saves p: [] with lost true.
function aiCandidates(st, p)
{
    const moves = aiMoves(st, p);
    for (const i of moves)
    {
        if (aiWinsAt(st, p, i)) return { moves: [i], win: true };
    }
    const q = aiNextAfter(st, p);
    if ((q < 0) || (q === p)) return { moves };
    const threats = aiThreats(st, q);
    if (!threats.length) return { moves };
    if ((threats.length === 1) && moves.includes(threats[0])) return { moves: [threats[0]] };
    return { moves: [], lost: true, winner: q };
}

//Board value for me: every pattern held by one player alone counts for that player,
//most when 2 of its 3 slots are taken and the owner can fill the 3rd.
function aiEval(st, me)
{
    const score = new Array(st.players).fill(0),
        c = st.cells;
    for (const pat of AI_PATTERNS)
    {
        let owner = -1, n = 0, empty = -1, mixed = false;
        for (const j of pat)
        {
            const v = c[j];
            if (v === -1)
            {
                empty = j;
            }
            else if ((owner === -1) || (owner === v))
            {
                owner = v;
                ++n;
            }
            else
            {
                mixed = true;
                break;
            }
        }
        if (mixed || (n === 0)) continue;
        score[owner] += (n === 2) ? (aiCanPlay(st, owner, empty) ? 10 : 1) : 1;
    }
    let v = score[me];
    for (let q = 0; q < st.players; ++q)
    {
        if (q !== me) v -= score[q];
    }
    return v;
}

//Alpha-beta, 'paranoid' for 3 or 4 players: every other player is taken to play against me.
function aiSearch(st, me, depth, alpha, beta, ctx)
{
    if (++ctx.nodes > ctx.budget) throw AI_OUT_OF_TIME;
    const p = st.who;
    if (p < 0) return 0; //no winner
    const c = aiCandidates(st, p);
    if (c.win) return (p === me) ? (AI_WIN + depth) : (-AI_WIN - depth); //sooner wins, later losses
    if (c.lost) return (c.winner === me) ? (AI_WIN + depth - 1) : (-AI_WIN - depth + 1);
    if (depth === 0) return aiEval(st, me);
    const max = (p === me);
    let best = max ? -Infinity : Infinity;
    for (const i of c.moves)
    {
        aiPlay(st, i);
        const v = aiSearch(st, me, depth - 1, alpha, beta, ctx);
        aiUnplay(st, i, p);
        if (max)
        {
            if (v > best) best = v;
            if (best > alpha) alpha = best;
        }
        else
        {
            if (v < best) best = v;
            if (best < beta) beta = best;
        }
        if (alpha >= beta) break;
    }
    return best;
}

//Scores of the root moves at one depth; moves worse than the best by more than margin may be under-scored.
function aiRootScores(st, me, moves, depth, margin, ctx)
{
    const scores = [];
    let best = -Infinity;
    for (const i of moves)
    {
        aiPlay(st, i);
        const v = aiSearch(st, me, depth - 1, best - margin, Infinity, ctx);
        aiUnplay(st, i, me);
        scores.push({ i, v });
        if (v > best) best = v;
    }
    return scores;
}

//Exact value of a 2 player position for the player to move: 1 win, 0 no winner, -1 loss.
//Positions solved are kept for the rest of the page's life (a few hundred thousand at most).
const AI_SOLVED = new Map();
function aiSolve(st, ctx)
{
    const p = st.who;
    if (p < 0) return 0;
    const key = `${st.cells.map((v) => v + 1).join('')}${p}${st.banCentre ? 'b' : ''}${st.unlimited ? 'u' : ''}${st.maxPlayed}`;
    const known = AI_SOLVED.get(key);
    if (known !== undefined) return known;
    if (++ctx.nodes > ctx.budget) throw AI_OUT_OF_TIME;
    const c = aiCandidates(st, p);
    let best = -1;
    if (c.win) best = 1;
    else if (c.lost) best = (c.winner === p) ? 1 : -1;
    else
    {
        for (const i of c.moves)
        {
            aiPlay(st, i);
            const v = (st.who === p) ? aiSolve(st, ctx) : -aiSolve(st, ctx);
            aiUnplay(st, i, p);
            if (v > best) best = v;
            if (best === 1) break;
        }
    }
    AI_SOLVED.set(key, best);
    return best;
}

function aiPick(a, rng)
{
    return a[Math.floor(rng() * a.length)];
}

//Depth-limited search of the given moves; returns [{i, v}].
function aiSearchMoves(st, me, moves, t)
{
    const ctx = { nodes: 0, budget: t.budget };
    let scored = moves.map((i) => ({ i, v: 0 }));
    for (let d = 1; d <= st.maxPlayed - st.played; ++d)
    {
        try
        {
            scored = aiRootScores(aiCopy(st), me, moves, d, t.noise, ctx);
        }
        catch (e)
        {
            if (e !== AI_OUT_OF_TIME) throw e;
            break;
        }
        aiChooseMove.depth = d; //for tests
        if (scored.some((m) => Math.abs(m.v) >= AI_WIN / 2)) break; //a forced result is in sight
    }
    return scored;
}

//The slot (0..26) the player to move plays, or null if it has no move.
function aiChooseMove(state, level, rng = Math.random)
{
    const t = AI_TRAITS[level] || AI_TRAITS.Friendly,
        st = aiCopy(state),
        me = st.who;
    let moves = aiMoves(st, me);
    if (!moves.length) return null;

    const wins = moves.filter((i) => aiWinsAt(st, me, i));
    if (wins.length && (rng() < t.takesWin)) return aiPick(wins, rng);

    //The next player's winning slots that I can fill
    const next = aiNextAfter(st, me),
        blocks = ((next >= 0) && (next !== me)) ? aiThreats(st, next).filter((i) => moves.includes(i)) : [];
    if (blocks.length && (rng() < t.blocks)) moves = blocks;

    //Friendly does not know the page's hint (the medium centre piece is the strong one)
    if ((moves.length > 1) && moves.includes(AI_CENTRE) && (rng() < t.centreShy)) moves = moves.filter((i) => i !== AI_CENTRE);

    let scored;
    if (t.solves && (st.players === 2))
    {
        try
        {
            const ctx = { nodes: 0, budget: AI_SOLVE_BUDGET };
            scored = moves.map((i) =>
            {
                const after = aiCopy(st);
                aiPlay(after, i);
                const v = aiWins(after.cells, me) ? 1 : ((after.who === me) ? aiSolve(after, ctx) : -aiSolve(after, ctx));
                return { i, v };
            });
            const best = Math.max(...scored.map((m) => m.v));
            moves = scored.filter((m) => m.v === best).map((m) => m.i);
            aiChooseMove.solved = best; //for tests
        }
        catch (e)
        {
            if (e !== AI_OUT_OF_TIME) throw e;
            aiChooseMove.solved = null;
        }
        if (moves.length === 1) return moves[0];
    }
    if (t.budget)
    {
        scored = aiSearchMoves(st, me, moves, t);
    }
    else
    {
        scored = moves.map((i) =>
        {
            const after = aiCopy(st);
            aiPlay(after, i);
            return { i, v: aiEval(after, me) + t.noise * rng() };
        });
    }
    const best = Math.max(...scored.map((m) => m.v)),
        top = scored.filter((m) => m.v >= best - (t.budget ? t.noise : 0));
    return aiPick(top, rng).i;
}

if ((typeof module !== 'undefined') && module.exports)
{
    module.exports = { AI_TRAITS, AI_LEVELS, AI_PATTERNS, aiChooseMove, aiMoves, aiWins, aiWinsAt, aiNext, aiPlay,
        aiUnplay, aiCopy, aiSolve };
}
