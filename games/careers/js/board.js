//Careers board: Tiger Electronics edition, 1992 ('The Choice is Yours'), read off dl/careers/game_board*.
const BOARD_EDITION = 'Tiger 1992';

/*
Layout: the board is a square of 20 x 20 units.
    Outer track: 32 squares, clockwise from Pay Day (top right). Corners are 3 x 3 units, the 7 squares on each
        side 2 units along the side and 3 deep.
    Inner area: 14 x 14 units (units 3 to 16); a career path square is 1 x 1 unit at [col, row] of the inner area.
*/
const BOARD_UNITS = 20,
    CORNER_UNITS = 3,
    SIDE_UNITS = 2,
    INNER_UNITS = 14,
    OUTER_COUNT = 32;

//Squares on the outer track, clockwise; index 0 is Pay Day.
//  [kind, name, small print], where kind is one of:
//  payday, opp (Opportunity Knocks), entry (career path entrance; name is the path in PATHS), corner (hospital,
//  unemployment, hawaii) or a one-off: tax, auto, inflation, hobby, rent, shop, vegas, paris, charity
const OUTER = [
    ['payday', 'Pay Day', 'As you pass... Collect Salary. Double if you land here!'], //0, top right corner
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['tax', 'taxes due', "If your salary is $3,000 or less, Pay 10%; $3,001-$9,999, Pay 50%; $10,000 up, Pay 90% of 1 year's salary."],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['entry', 'Ecology', 'May enter: Ecology. Must Donate $1,000 or have Science Degree or have previous Ecological experience.'],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'], //5
    ['auto', 'auto show', "May spend up to 1 year's salary for car. Score 1 ♥ per $1,000 spent. Lose 1 ♥ for 'just looking'."],
    ['entry', 'College', 'May enter: College. Tuition: Pay $500. A College Degree earns you free admission to Big Business and Sports. Graduates landing here must Roll again.'],
    ['hospital', 'Hospital', 'Roll 5 or less to be released... or Pay Doctor 1/2 your salary and take your turn. If there is no Doctor, pay the bank. Do not use an Experience Card.'], //8, bottom right corner
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['inflation', 'inflation', 'Lose 1/4 your cash-on-hand to the bank!'], //10
    ['entry', 'Big Business', 'May enter: Big Business. Must Invest $500 or have College Degree or Business experience.'],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['hobby', 'hobby', 'May buy 1 or 2 race horses for $3,000 each. Score 1 ★ x number rolled on one die... (for each horse bought).'],
    ['entry', 'Teaching', 'May enter: Teaching. Must Pay $100 Union dues or have previous Teaching experience.'],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'], //15
    ['unemployment', 'Unemployment', 'Roll 7, 11 or Doubles to move... or Pay 1/2 your cash, and take your turn. Do not use an Experience Card.'], //16, bottom left corner
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['rent', 'rent due', 'Pay 1/4 your annual salary.'],
    ['entry', 'Politics', 'May enter: Politics. Must Contribute $3,000 or have Law Degree or Political experience.'],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'], //20
    ['shop', 'shop', 'Spend 10% of your cash-on-hand x roll of 1 die.'],
    ['entry', 'Entertainment', 'May go into: Entertainment. Must Spend $1,000 for supplies or have experience in Entertainment.'],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['hawaii', 'Hawaii Holiday', 'Score 4 ♥ if you land here... Score 2 ♥ each turn you stay. To stay, roll 7 or less. Do not use an Experience Card.'], //24, top left corner
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'], //25
    ['vegas', 'las vegas', 'Voluntary participation. For each $3,000 you bet, Win $1000 x roll of 1 die. No house limit.'],
    ['entry', 'Sports', 'May enter: Sports. Immediate Expenses: $4,000 or must have College Degree or Sports experience.'],
    ['opp', 'Opportunity Knocks!', 'Draw an Opportunity card'],
    ['paris', 'Paris weekend', 'Pay: $2,000 Score: 4 ♥; $8,000: 8 ♥; $16,000: 12 ♥'],
    ['entry', 'Computer Science', 'May enter: Computer Science. Requirements: Contribute $5,000 or have Engineering Degree or Computer Science experience.'], //30
    ['charity', 'charity', 'Voluntary contribution. Donate: $4,000 Score: 4 ★; $8,000: 10 ★; $12,000: 16 ★']
];
const INDEX_KIND = 0,
    INDEX_NAME = 1,
    INDEX_PRINT = 2;
const PAYDAY = 0,
    HOSPITAL = 8,
    UNEMPLOYMENT = 16,
    HAWAII = 24;

/*
Career paths, by name (as on its entrance square in OUTER).
    entry: the outer square it is entered from; exit: the outer square that the 1st step after its last square lands on
    exitPrint: fine print at the way out, if not 'Collect Experience'
    fee: entrance fee ($); degree: a College Degree that lets you in free ('any': any degree; '' none)
    squares: in the order they are walked; [col, row, story, reward as printed, effect]
    effect (for the rules, later): f: fame (stars), h: happiness (hearts), cash: $ received, salary: pay rise,
        die: $ x roll of 1 die, exp / opp: draw that many Experience / Opportunity cards, goTo: hospital or
        unemployment, loseTurn: 1, again: throw again, half: halve salary/cash/fame, lose: lose all hearts/fame/cash,
        fine: [$, or else goTo]
    onExit: what completing the path gives; an Experience card unless noExperience
*/
const PATHS = {
    Ecology: {
        entry: 4, exit: 5, fee: 1000, degree: 'Science', colour: '#7cb342',
        squares: [
            [13, 7, 'Plant organic vegetable garden', '2 ♥', { h: 2 }],
            [12, 7, 'Head clean-up campaign', 'Draw 1 Experience card', { exp: 1 }],
            [11, 7, 'Swim in unpolluted river', '2 ♥', { h: 2 }],
            [10, 7, 'Win solar car race', 'WIN BET: $1000 x roll of 1 die', { die: 1000 }],
            [10, 8, 'Promote rock concert to save rain forest', '2 ★ 4 ♥', { f: 2, h: 4 }],
            [10, 9, 'Set up recycling center in your garage', '6 ♥', { h: 6 }],
            [11, 9, 'Invent recyclable diaper', 'EARN $5,000 in royalties', { cash: 5000 }],
            [12, 9, 'Take Girl Scouts on litter walk', '2 ♥', { h: 2 }],
            [13, 9, 'Caught littering', 'FINE: 1/2 your cash on hand', { half: 'cash' }]
        ]
    },
    College: {
        entry: 7, exit: 10, fee: 500, degree: '', colour: '#00897b',
        exitPrint: 'Increase Salary $2,000', onExit: { salary: 2000, degree: true, noExperience: true },
        squares: [
            [13, 12, 'Co-Ed Dorm', '4 ♥', { h: 4 }],
            [12, 12, 'On probation', 'Miss 1 turn', { loseTurn: 1 }],
            [12, 11, "Make Dean's List", '2 ♥', { h: 2 }],
            [11, 11, 'Join sorority', '2 ♥', { h: 2 }],
            [10, 11, 'Win 4 year Scholarship', 'Draw 2 Opportunity cards', { opp: 2 }],
            [10, 12, 'Football Hero', '6 ★', { f: 6 }],
            [10, 13, 'Graduate with honors', 'Draw 2 Opportunity cards', { opp: 2 }]
        ]
    },
    'Big Business': {
        entry: 11, exit: 12, fee: 500, degree: 'any', colour: '#2e7d32',
        squares: [
            [8, 13, 'Appointed Mail Clerk', 'Draw 1 Experience card', { exp: 1 }],
            [8, 12, 'Coffee with Boss', 'Draw 1 Opportunity card', { opp: 1 }],
            [8, 11, 'Your uncle is Treasurer', 'Salary UP $1,000', { salary: 1000 }],
            [8, 10, 'Wildcat Strike', 'LOSE next turn', { loseTurn: 1 }],
            [7, 10, 'Sell freezers to Eskimos', 'Bonus: $2,000', { cash: 2000 }],
            [6, 10, 'Promoted to V.P.', 'Salary UP $2,000', { salary: 2000 }],
            [5, 10, 'Sales trip to North Dakota', 'Draw 1 Experience card', { exp: 1 }],
            [5, 11, 'Transferred to Hawaii', '4 ♥', { h: 4 }],
            [5, 12, "You're Fired!", 'Go to Unemployment', { goTo: 'unemployment' }],
            [6, 12, 'Sales plummet', 'Salary Cut by 1/2', { half: 'salary' }],
            [6, 13, 'Elected President', 'Salary UP $3,000', { salary: 3000 }]
        ]
    },
    Teaching: {
        entry: 14, exit: 17, fee: 100, degree: '', colour: '#9e9d24',
        squares: [
            [3, 13, 'Eat wormy apple', 'Go to Hospital', { goTo: 'hospital' }],
            [3, 12, 'Snow storm, no school', '2 ♥', { h: 2 }],
            [3, 11, "Teacher's Convention", 'Draw 2 Opportunity cards', { opp: 2 }],
            [3, 10, '9th grade substitute', 'Draw 1 Experience card', { exp: 1 }],
            [2, 10, 'Survive first year', 'Award: $1000 x roll of 1 die', { die: 1000 }],
            [1, 10, 'Class troublemaker moves away', '4 ♥', { h: 4 }],
            [1, 11, 'Your class wins honors', '6 ♥', { h: 6 }],
            [1, 12, 'Kicked in shins', 'LOSE next turn', { loseTurn: 1 }],
            [0, 12, "School's out", '8 ♥', { h: 8 }]
        ]
    },
    Politics: {
        entry: 19, exit: 20, fee: 3000, degree: 'Law', colour: '#00796b',
        squares: [
            [0, 8, 'Lose in primaries', 'Go to Unemployment', { goTo: 'unemployment' }],
            [1, 8, 'Lunch with President', 'Draw 2 Opportunity cards', { opp: 2 }],
            [2, 8, 'Debate Opponent on TV', '4 ★', { f: 4 }],
            [3, 8, 'Junket to Paris', '2 ♥', { h: 2 }],
            [3, 7, 'Testify to sub-committee', 'Draw 2 Experience cards', { exp: 2 }],
            [3, 6, 'Lobby for minority rights', '6 ★', { f: 6 }],
            [3, 5, 'Arrange truce', '2 ★ 4 ♥', { f: 2, h: 4 }],
            [2, 5, 'Attend summit meeting', '8 ★', { f: 8 }],
            [1, 5, 'Sell memoirs', 'Receive: $5,000 4 ★', { cash: 5000, f: 4 }],
            [1, 6, 'Vote fraud', 'LOSE 1/2 your Fame', { half: 'fame' }],
            [0, 6, 'Win by a landslide', '12 ★', { f: 12 }]
        ]
    },
    Entertainment: {
        entry: 22, exit: 25, fee: 1000, degree: '', colour: '#8bc34a',
        squares: [
            [0, 3, 'Create new dance craze', '2 ★', { f: 2 }],
            [1, 3, 'Do stand-up comedy in shopping malls', 'Draw 1 Experience card', { exp: 1 }],
            [2, 3, "Neighbor's 3rd cousin is a movie producer", 'Draw 2 Opportunity cards', { opp: 2 }],
            [3, 3, 'Star in sneaker commercial', '6 ★ 2 ♥', { f: 6, h: 2 }],
            [3, 2, 'Your ratings are up', 'Salary up $1,000', { salary: 1000 }],
            [3, 1, 'Your rap musical flops', 'Cut salary in half', { half: 'salary' }],
            [2, 1, 'Tabloids explore your love life', '10 ★ but LOSE ALL your ♥s', { f: 10, lose: 'hearts' }],
            [1, 1, 'Write steamy novel', '$1,000 x 1 roll of die', { die: 1000 }],
            [1, 0, 'Win an Oscar', '12 ★', { f: 12 }]
        ]
    },
    Sports: {
        entry: 27, exit: 28, fee: 4000, degree: 'any', colour: '#689f38',
        squares: [
            [5, 0, 'Play touch football with the girls', '2 ♥', { h: 2 }],
            [5, 1, 'Instant replay', 'Throw again', { again: true }],
            [5, 2, 'Bet against your own team', 'FINE: $2,000 or go to Unemployment', { fine: [2000, 'unemployment'] }],
            [5, 3, 'Score goal from penalty box', '2 ♥', { h: 2 }],
            [6, 3, 'Tackled by eight men', 'Draw 1 Experience card', { exp: 1 }],
            [7, 3, 'Perfect your spitball', '4 ♥', { h: 4 }],
            [8, 3, 'Rollerblades out of control', 'Go to Hospital', { goTo: 'hospital' }],
            [8, 2, "You're M.V.P.", '$10,000 Bonus', { cash: 10000 }],
            [8, 1, 'The fans love you', '2 ★ 2 ♥', { f: 2, h: 2 }],
            [7, 1, 'Hole-in-one', '6 ♥', { h: 6 }],
            [7, 0, 'Win the Derby', '$20,000 Prize', { cash: 20000 }]
        ]
    },
    'Computer Science': { //comes out past Pay Day: no pay
        entry: 30, exit: 1, fee: 5000, degree: 'Engineering', colour: '#00695c',
        squares: [
            [10, 0, 'Invest in talking computer', '2 ♥', { h: 2 }],
            [10, 1, 'Fight virus!', '10 ★ but go to Hospital', { f: 10, goTo: 'hospital' }],
            [10, 2, 'Become computer artist', '6 ★', { f: 6 }],
            [10, 3, 'Reporter reveals computer did all the work', 'Lose all your Fame', { lose: 'fame' }],
            [10, 4, 'Caught hacking into CIA files', 'FINE: Lose all your cash', { lose: 'cash' }],
            [10, 5, 'Write book: "How to Fight Computer Addiction"', '2 ★ 4 ♥', { f: 2, h: 4 }],
            [11, 5, 'Analyze your stocks by computer', 'EARN $2,000', { cash: 2000 }],
            [12, 5, 'Become computer consultant', 'Draw 2 Experience cards', { exp: 2 }],
            [12, 4, 'Invent revolutionary chip', '16 ★', { f: 16 }],
            [12, 3, 'Teach computer science to pre-schoolers', '10 ♥', { h: 10 }],
            [12, 2, 'Software Salesperson of the Year', 'EARN $10,000', { cash: 10000 }],
            [12, 1, 'Print wrestling magazine on your new computer', '6 ★ 4 ♥', { f: 6, h: 4 }],
            [13, 1, 'Invent program for doing housework', 'COLLECT $5,000', { cash: 5000 }]
        ]
    }
};
const INDEX_COL = 0,
    INDEX_ROW = 1,
    INDEX_STORY = 2,
    INDEX_REWARD = 3,
    INDEX_EFFECT = 4;

/*
College Degrees, chosen on completing College, first come first served. Each special degree is unique: once
they are all taken, graduates get a plain College degree. Any degree lets you into Big Business and Sports free
(an option: or only the plain College degree).
Medical: no career; its holder is the Doctor, who is paid the fees to leave Hospital, and leaves it free.
*/
const DEGREES = { Science: 'Ecology', Law: 'Politics', Engineering: 'Computer Science', Medical: '' }, //degree: the career it lets you into free
    PLAIN_DEGREE = 'College',
    DOCTOR_DEGREE = 'Medical';

//Opportunity Knocks cards (28, and BUMP_CARD): [count, career path or special, text, special]
const OPPORTUNITY_CARDS = [
    [3, 'Ecology', 'Ecology... meet normal requirements'],
    [3, 'College', 'College... meet normal requirements'],
    [3, 'Big Business', 'Big Business... meet normal requirements'],
    [2, 'Teaching', 'Teaching... meet normal requirements'],
    [1, 'Teaching', 'Teaching... SPECIAL... Double all Happiness earned during tenure... meet normal requirements', 'doubleHearts'],
    [2, 'Politics', 'Politics... meet normal requirements'],
    [1, 'Politics', 'Politics... SPECIAL... because of your great charisma all expense paid', 'free'],
    [2, 'Entertainment', 'Arts... meet normal requirements'],
    [1, 'Entertainment', 'Arts... SPECIAL... because of your great talent all expense paid', 'free'],
    [2, 'Hawaii', 'Holiday in Hawaii'],
    [2, 'Sports', 'Sports... meet normal requirements'],
    [1, 'Sports', 'Sports... SPECIAL... because of your great skill as a mountain climber all expense paid', 'free'],
    [2, 'Computer Science', 'Computer Science... meet normal requirements'],
    [1, 'Computer Science', 'Computer Science... SPECIAL... because of your great skill as a white hat hacker, all expense paid', 'free'],
    [2, 'any', 'GOLDEN OPPORTUNITY... Occupation of your choice... meet normal requirements']
];
//From the 1979 rules (which had 2 of them); in the deck unless the option is unticked. Played instead of a throw.
const BUMP_CARD = [1, 'Unemployment', 'Send any opponent to UNEMPLOYMENT', 'bump'];
//Experience cards (28): [count, squares to move]
const EXPERIENCE_CARDS = [[8, 1], [8, 2], [6, 3], [6, 4]];

//Players: Cluedo's characters (as in Hotels); their tokens are ../cluedo/images/token-<TOKENS[i]>.png
const PLAYERS = [
    'Col Mustard', //Colonel Mustard
    'Ms Scarlett',
    'Capt Brown', //Captain Brown
    'Mrs White',
    'Mr Slate Gray',
    'Rev Green', //Reverend Green
    'Prof Plum', //Professor Plum
    'Mrs Peacock',
    'Ms Peach'];
const PLAYER_COLORS = [
    '#aa0', 'red', 'brown',
    'black', '#333', 'green',
    'purple', 'blue', '#d11d53'];
const TOKENS = ['yellow', 'red', 'brown', 'white', 'gray', 'green', 'purple', 'blue', 'pink'];
const MAX_PLAYERS = 6;
