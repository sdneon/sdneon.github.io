//Careers: pictures for the board. Emoji for now; any entry may be swapped for a picture file, e.g.
//  'images/sports-penalty.webp' (a path ending in .png, .jpg, .gif, .webp or .svg, relative to careers.html).

//Title in the middle of the board: '' for the text 'Careers', or a picture file (the owner's cut from box-front.jpg)
const TITLE_ART = '';

/*
Look of each career path:
    icon: its emblem; tint: background of its squares; disc: colour behind its emblem
    emblemShift: [dx, dy] in path squares, to move the emblem off the path's squares
*/
const PATH_THEMES = {
    Ecology: { icon: '\u{1F331}', tint: '#eef7e4', disc: '#9ccc65' },
    College: { icon: '\u{1F393}', tint: '#e3f3f1', disc: '#4db6ac', emblemShift: [0, 1] },
    'Big Business': { icon: '\u{1F4BC}', tint: '#e9ecf7', disc: '#7986cb' },
    Teaching: { icon: '\u{1F34E}', tint: '#fbf8dd', disc: '#dce775', emblemShift: [0, 1] },
    Politics: { icon: '\u{1F3DB}️', tint: '#efe9f7', disc: '#9575cd' },
    Entertainment: { icon: '\u{1F3AC}', tint: '#fbe8ee', disc: '#f06292', emblemShift: [-1, 0] },
    Sports: { icon: '⚽', tint: '#e5f0fb', disc: '#66bb6a' },
    'Computer Science': { icon: '\u{1F4BB}', tint: '#e2f6f8', disc: '#4dd0e1', emblemShift: [0, -2] }
};

//A picture for each path square, in the order of PATHS[name].squares in board.js
const SQUARE_ART = {
    Ecology: [
        '\u{1F955}\u{1F331}', //Plant organic vegetable garden
        '\u{1F9F9}\u{1F5D1}️', //Head clean-up campaign
        '\u{1F3CA}\u{1F3DE}️', //Swim in unpolluted river
        '☀️\u{1F3CE}️', //Win solar car race
        '\u{1F3B8}\u{1F333}', //Promote rock concert to save rain forest
        '♻️\u{1F3E0}', //Set up recycling center in your garage
        '\u{1F476}♻️', //Invent recyclable diaper
        '\u{1F467}\u{1F6AE}', //Take Girl Scouts on litter walk
        '\u{1F6AF}\u{1F46E}' //Caught littering
    ],
    College: [
        '\u{1F6CF}️\u{1F46B}', //Co-Ed Dorm
        '⚠️\u{1F4C9}', //On probation
        '\u{1F4DC}⭐', //Make Dean's List
        '\u{1F46D}\u{1F389}', //Join sorority
        '\u{1F3C5}\u{1F4DA}', //Win 4 year Scholarship
        '\u{1F3C8}\u{1F9B8}', //Football Hero
        '\u{1F393}\u{1F396}️' //Graduate with honors
    ],
    'Big Business': [
        '\u{1F4EC}✉️', //Appointed Mail Clerk
        '☕\u{1F454}', //Coffee with Boss
        '\u{1F474}\u{1F4B0}', //Your uncle is Treasurer
        '✊\u{1FAA7}', //Wildcat Strike
        '\u{1F9CA}\u{1F3D4}️', //Sell freezers to Eskimos
        '\u{1F4C8}\u{1FA9C}', //Promoted to V.P.
        '\u{1F9F3}\u{1F33E}', //Sales trip to North Dakota
        '\u{1F33A}\u{1F3DD}️', //Transferred to Hawaii
        '\u{1F525}\u{1F4E6}', //You're Fired!
        '\u{1F4C9}\u{1F631}', //Sales plummet
        '\u{1F3E2}\u{1F451}' //Elected President
    ],
    Teaching: [
        '\u{1F34E}\u{1F41B}', //Eat wormy apple
        '❄️\u{1F3EB}', //Snow storm, no school
        '\u{1F9D1}‍\u{1F3EB}\u{1F3A4}', //Teacher's Convention
        '\u{1F4DD}\u{1F9D1}‍\u{1F3EB}', //9th grade substitute
        '\u{1F4AA}\u{1F4C5}', //Survive first year
        '\u{1F69A}\u{1F608}', //Class troublemaker moves away
        '\u{1F3C6}\u{1F469}‍\u{1F393}', //Your class wins honors
        '\u{1F9B5}\u{1F4A5}', //Kicked in shins
        '\u{1F392}☀️' //School's out
    ],
    Politics: [
        '\u{1F5F3}️\u{1F44E}', //Lose in primaries
        '\u{1F37D}️\u{1F3DB}️', //Lunch with President
        '\u{1F4FA}\u{1F399}️', //Debate Opponent on TV
        '\u{1F5FC}✈️', //Junket to Paris
        '⚖️\u{1F399}️', //Testify to sub-committee
        '\u{1F91D}\u{1F4E3}', //Lobby for minority rights
        '\u{1F54A}️\u{1F91D}', //Arrange truce
        '\u{1F310}\u{1F91D}', //Attend summit meeting
        '\u{1F4D6}✍️', //Sell memoirs
        '\u{1F5F3}️\u{1F6A8}', //Vote fraud
        '\u{1F3C6}\u{1F5F3}️' //Win by a landslide
    ],
    Entertainment: [
        '\u{1F483}\u{1F57A}', //Create new dance craze
        '\u{1F3A4}\u{1F602}', //Do stand-up comedy in shopping malls
        '\u{1F3A5}\u{1F91D}', //Neighbor's 3rd cousin is a movie producer
        '\u{1F45F}\u{1F4FA}', //Star in sneaker commercial
        '\u{1F4FA}\u{1F4C8}', //Your ratings are up
        '\u{1F3A4}\u{1F345}', //Your rap musical flops
        '\u{1F4F0}\u{1F494}', //Tabloids explore your love life
        '\u{1F4D5}\u{1F525}', //Write steamy novel
        '\u{1F3C6}\u{1F3AC}' //Win an Oscar
    ],
    Sports: [
        '\u{1F3C8}\u{1F467}', //Play touch football with the girls
        '⏪\u{1F4FA}', //Instant replay
        '\u{1F3B2}\u{1F6AB}', //Bet against your own team
        '⚽\u{1F945}', //Score goal from penalty box
        '\u{1F3C9}\u{1F4A5}', //Tackled by eight men
        '⚾\u{1F4A6}', //Perfect your spitball
        '\u{1F6FC}\u{1F4A5}', //Rollerblades out of control
        '\u{1F3C5}⭐', //You're M.V.P.
        '\u{1F4E3}❤️', //The fans love you
        '⛳\u{1F3CC}️', //Hole-in-one
        '\u{1F3C7}\u{1F3C6}' //Win the Derby
    ],
    'Computer Science': [
        '\u{1F4BB}\u{1F5E3}️', //Invest in talking computer
        '\u{1F9A0}\u{1F6E1}️', //Fight virus!
        '\u{1F5A5}️\u{1F3A8}', //Become computer artist
        '\u{1F4F0}\u{1F916}', //Reporter reveals computer did all the work
        '\u{1F575}️\u{1F4BE}', //Caught hacking into CIA files
        '\u{1F4D8}\u{1F5B1}️', //Write book: "How to Fight Computer Addiction"
        '\u{1F4CA}\u{1F4BB}', //Analyze your stocks by computer
        '\u{1F4BC}\u{1F4BB}', //Become computer consultant
        '\u{1F52C}\u{1F4A1}', //Invent revolutionary chip
        '\u{1F9D2}\u{1F4BB}', //Teach computer science to pre-schoolers
        '\u{1F4BF}\u{1F3C6}', //Software Salesperson of the Year
        '\u{1F93C}\u{1F5A8}️', //Print wrestling magazine on your new computer
        '\u{1F916}\u{1F9F9}' //Invent program for doing housework
    ]
};

function theme_(name)
{
    return PATH_THEMES[name] || { icon: '', tint: '#f3e7c4', disc: '#ccc' };
}

//HTML for an art entry: a picture file, or the emoji themselves
function artHtml(art, cls)
{
    if (!art) return '';
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(art)) return `<img class="${cls} art_img" src="${art}" alt="">`;
    return `<span class="${cls}">${art}</span>`;
}
