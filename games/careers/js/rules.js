//Careers: the rules as this page plays them, for the Rules window (as Cluedo's and Hotels')
const RULES = `<div id="divRules">
<h3>Object</h3>
Be the first to reach your own <b>Success Formula</b>: money ($1,000 of cash is 1 point) + fame (&#x2605;) +
happiness (&#x2665;), adding up to 60 points (Options: more for a longer game). Choose it secretly on your score sheet
before the game starts, each in turn while the others look away (e.g. 20 + 20 + 20, or 5 + 45 + 10), and lock it in:
it cannot be changed after. You win the moment all three parts are reached.<br>
Players can join (at Pay Day, with the starting cash and salary) or leave during a game: tick or untick them under
Players.

<h3>Your turn</h3>
Throw 2 dice on the outer track (1 die inside a career), then click the glowing square to move there; do what it
says. Or, instead of throwing, play <b>one card</b>. Then <b>Next Player</b>.<br>
Passing <b>Pay Day</b> pays your salary; landing on it pays double.<br>
Landing on another player bumps them to <b>Unemployment</b> (not in Hospital or Unemployment).

<h3>Careers</h3>
Landing on a career's entrance, you may go in by one of its requirements: the fee, a College degree that admits
you, experience in it (you completed it before), or an all-expense-paid card. Going in ends your turn; from your
next turn, throw 1 die to move along it. Step past its last square to come out onto the track: you collect an
Experience card (you hold at most 3), and the career goes on your score sheet. A career left part way (Hospital,
Unemployment, a card) gives nothing.<br>
<b>College</b>: tuition $500; finishing it raises your salary $2,000 and gives a degree, first come first served:
Science (free into Ecology), Law (Politics), Engineering (Computer Science), Medical (you become the <b>Doctor</b>,
paid by those leaving Hospital); after those, a plain College degree. Any degree lets you into Big Business and
Sports free (Options). Graduates may not go back to College.<br>
<b>Computer Science</b> comes out past Pay Day: no pay.

<h3>Cards</h3>
<b>Opportunity Knocks</b> (drawn on its squares and some career squares): takes you to a career's entrance
(clockwise, collecting Pay Day on the way); the 'all expense paid' ones let you in free. Golden Opportunity: any
career. Holiday in Hawaii. Send any opponent to Unemployment. You may use one the moment you draw it, or keep it
for the start of a later turn.<br>
<b>Experience</b>: move that many squares instead of throwing, on the track or in a career.<br>
Cards drawn appear face down: click to turn them over. Your cards show at the top right on your turn; the ones you
can play now glow: click one to play it.

<h3>Corners and other squares</h3>
<b>Hospital</b>: throw 5 or less to leave, or pay half your salary (to the Doctor). <b>Unemployment</b>: throw 7,
11 or doubles, or pay half your cash. No Experience cards there.<br>
<b>Hawaii Holiday</b>: 4 &#x2665; for landing; each turn you may try to stay (throw 7 or less) for 2 &#x2665; more.<br>
Taxes, rent, inflation and the shop take money (never more than you have); the auto show, race horses, Las Vegas,
Paris and charity are yours to take or leave. Throws they ask for are yours to make: click the dice.

<h3>Secrets</h3>
Your formula, cash, salary, scores and cards are yours alone: they show only on your turn (and to nobody for a
computer player). Click a player in the table for their score sheet.

<h3>Computer players</h3>
Tick AI under a character in Options, Friendly or Smart. 'Pause computer players' makes each wait for Go!.

<h3>Saving</h3>
The game is saved at the start of every turn, and offered back when you open the page again. Export game / Load game
keep a game in a file.
</div>`;

let popupRules = null;
function showRules()
{
    if (!popupRules)
    {
        popupRules = new WinBox({
            title: 'Rules',
            x: '10px',
            y: '100px',
            width: '60%',
            height: `${Math.max(300, window.innerHeight - 160)}px`,
            html: RULES,
            onclose: function ()
            {
                this.minimize();
                return true;
            }
        });
    }
    else popupRules.restore();
}
