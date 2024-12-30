/*
Legend:
0-?: Characters starting spot
  > 0: Mrs White
  > 1: Reverend Green
  > 2: Mrs Peacock
  > 3: Mr Slate Gray
  > 4: Captain Brown
  > 5: Colonel Mustard
  > 6: Professor Plum
  > 7: Ms Scarlett
  > 8: Ms Peach
c: clue counter spot
g: garden clue/ornament counter spot
s: stairs spot
r: room spot, exlude 'c', 's' - can put weapons
R: same as above, but is room entrance, so Not recommended to put weapons
p: corridor path spot - cannot put clues/weapons
K: Kitchen
B: Ballroom
C: Convervatory
D: Dining room
I: Billiard room
L: Library
O: Lounge
H: Hall
S: Study
*/
const ROOM_KEYS = ['K', 'B', 'C', 'D', 'I', 'L', 'O', 'H', 'S'];
const BOARD = [ //2 ch's per grid square
    'x x x x 3 x x x g x x g x x x 5 x g x x ',
    'x p p p p p p p p p p p p p p p p p p x ',
    'g p KrKrKcKrp BsBrBrBcBrBrCRCrCrCcCrp x ',
    'x p KRKrKrKRp BrBrBrBrBrBRCRCrCrCrCrp x ',
    'x p KrKcKrKsp BcBrBrBrBrBrCrCcCrCrCsp 7 ',
    '4 p DsDrDrDcp BrBRBrBcBRBrp IcIrIrIcp x ',
    'x p DcDrDrDrp p p p p p p p IRIrIrIRp g ',
    'x p DRDrDrDrp p x x x x p pcIsIrIrIrp x ',
    'g p DrDrDrDRp p x x x x p p p p p p p x ',
    'x p DrDrDcDrp p s s s s p p LrLRLrLrp x ',
    'x p DrDrDRDrpcp s s s s pcp LcLrLrLcp 2 ',
    'x p p p p p p p s s s s p p LrLrLrLrp x ',
    'x p OsOrOrOrp p p pcp p p p LRLcLrLrp g ',
    'x p OrOrOrOrp p p p p p p p LrLrLRLsp x ',
    '0 p OrOcOrOrOROrOrHsHRHcSrSRSrScSRSrp x ',
    'x p OrOrOrOrOrOrORHRHrHRSRSrSrSrSrScp 6 ',
    'x p OrOrOrOrOrOcOrHcHrHrScSrSrSrSrSrp x ',
    'g p OrOROcOrOrOrOrHrHRHrSrSrSrSrSRSsp g ',
    'x p p p p p p p p p p p p p p p p p p x ',
    'x x x g x 1 x x g x x x g x 8 x x g x x '];

//shorter names for map display
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

const WALLS = {
    //'y_x': ... l:left, t:top, ...; x: wall, w: window, W:window entry, ' ': open/door entry
    //Kitchen
    '2_2': 'lx,tx',
    '2_3': 'tw',
    '2_4': 'tw',
    '2_5': 'tx,rx',
    //Ballroom
    '2_7': 'lx,tx',
    '2_8': 'tw',
    '2_9': 'tw',
    '2_10': 'tw',
    '2_11': 'tw',
    '2_12': 'tx,rx',
    //Convervatory
    '2_13': 'lx,tW',
    '2_14': 'tw',
    '2_15': 'tw',
    '2_16': 'tw',
    '2_17': 'tx,rx',

    '3_7': 'lx',
    '3_17': 'rw',

    '4_2': 'lx,bx',
    '4_4': 'bx',
    '4_5': 'rx,bx',
    '4_7': 'lx',
    '4_12': 'rx',
    '4_13': 'lx,bx',
    '4_14': 'bx',
    '4_15': 'bx',
    '4_16': 'bx',
    '4_17': 'rw,bx',

    '5_2': 'lx,tx',
    '5_4': 'tx',
    '5_5': 'rx,tx',
    '5_7': 'lx,bx',
    '5_9': 'bx',
    '5_10': 'bx',
    '5_12': 'bx,rx',
    '5_14': 'lx,tx',
    '5_15': 'tx',
    '5_16': 'tx',
    '5_17': 'rx,tx',

    '6_2': 'lw',
    '6_5': 'rx',
    '6_17': 'rW',

    '7_2': 'lW',
    '7_5': 'rx',
    '7_14': 'lx,bx',
    '7_15': 'bx',
    '7_16': 'bx',
    '7_17': 'bx,rx',

    '8_2': 'lw',

    //title box
    '7_8': 'lx,tx',
    '7_9': 'tx',
    '7_10': 'tx',
    '7_11': 'tx,rx',
    '8_8': 'lx,bx',
    '8_9': 'bx',
    '8_10': 'bx',
    '8_11': 'bx,rx',

    '9_2': 'lw',
    '9_5': 'rx',
    '9_8': 'lx',
    '9_9': 'rx',
    '9_10': 'lx',
    '9_11': 'rx',
    '9_14': 'lx,tx',
    '9_16': 'tx',
    '9_17': 'tx,rx',

    '10_2': 'lx,bx',
    '10_3': 'bx',
    '10_5': 'bx,rx',
    '10_8': 'lx',
    '10_9': 'rx',
    '10_10': 'lx',
    '10_11': 'rx',
    '10_14': 'lx',
    '10_17': 'rw',

    '11_8': 'lx',
    '11_9': 'rx',
    '11_10': 'lx',
    '11_11': 'rx',
    '11_14': 'lx',
    '11_17': 'rw',

    //Lounge
    '12_2': 'lx,tx',
    '12_3': 'tx',
    '12_4': 'tx',
    '12_5': 'tx,rx',
    '12_17': 'rw',

    '13_2': 'lw',
    '13_5': 'rx',
    '13_14': 'lx,bx',
    '13_15': 'bx',
    '13_17': 'bx,rx',

    '14_2': 'lw',
    '14_7': 'tx',
    '14_8': 'tx,rx',
    '14_9': 'tx,lx',
    '14_11': 'tx,rx',
    '14_12': 'tx,lx',
    '14_14': 'tx',
    '14_15': 'tx',
    '14_17': 'tx,rx',

    '15_2': 'lw',
    '15_17': 'rw',

    '16_2': 'lw',
    '16_8': 'rx',
    '16_9': 'lx',
    '16_11': 'rx',
    '16_12': 'lx',
    '16_17': 'rw',

    '17_2': 'lx,bx',
    '17_3': 'bW',
    '17_4': 'bw',
    '17_5': 'bw',
    '17_6': 'bw',
    '17_7': 'bw',
    '17_8': 'bx,rx',
    '17_9': 'bx,lx',
    '17_11': 'bx,rx',
    '17_12': 'bx,lx',
    '17_13': 'bw',
    '17_14': 'bw',
    '17_15': 'bw',
    '17_16': 'bW',
    '17_17': 'bx,rx'
};

const CLUES = [
    ['False Alarm - No Clue &#x1f635;', 'falseAlarm'],//0
    //1
    ['Collect 1 of the spare Murder Cards', 'murderCardFromDeck', 1],
    ['There is a Clue on the Dagger', 'clue', 0, 'Dagger'],
    ['Look under ANY 1 flap of the BLACK Murder Card Holder', 'look', 'black', 1, 'any'],
    ['Collect 1 of the spare Murder Cards', 'murderCardFromDeck', 1],
    ['There is a Clue on the Bird Table', 'clue', 9, 'BirdTable'],
    //6
    ['Look under the Bottom Left flap of the GREEN Murder Card Holder', 'look', 'green', 1, 'BL'],
    ['Take a Murder Card from each player', 'murderCardFromPlayer', 1, 'everyone'],
    ['There is a Clue on the Revolver', 'clue', 1, 'Revolver'],
    ['There is a Clue on the Spanner', 'clue', 2, 'Spanner'],
    ['Take a Murder Card from the player of your choice', 'murderCardFromPlayer', 1, 'anyone'],
    //11
    ['Look under the Bottom Right flap of the BEIGE Murder Card Holder', 'look', 'beige', 1, 'BR'],
    ['Look under ANY 1 flap of the GREEN Murder Card Holder', 'look', 'green', 1, 'any'],
    ['There is a Clue on the Poison', 'clue', 3, 'Poison'],
    ['There is a Clue on the Sun Dial', 'clue', 11, 'SunDial'],
    ['Look under the Top Right flap of the BEIGE Murder Card Holder', 'look', 'beige', 1, 'TR'],
    //16
    ['Collect 1 of the spare Murder Cards', 'murderCardFromDeck', 1],
    ['There is a Clue on the Blunderbuss', 'clue', 4, 'Blunderbuss'],
    ['Look under the Top Left flap of the BLACK Murder Card Holder', 'look', 'black', 1, 'TL'],
    ['Take a Murder Card from the player of your choice', 'murderCardFromPlayer', 1, 'anyone'],
    ['There is a Clue on the Rope', 'clue', 5, 'Rope'],
    //21
    ['There is a Clue on the Urn', 'clue', 12, 'Urn'],
    ['Look under the Top Right flap of the GREEN Murder Card Holder', 'look', 'green', 1, 'TR'],
    ['Take a Murder Card from each player', 'murderCardFromPlayer', 1, 'everyone'],
    ['There is a Clue on the Axe', 'clue', 6, 'Axe'],
    ['There is a Clue on the Candlestick', 'clue', 7, 'Candlestick'],
    //26
    ['Look under ANY 1 flap of the BEIGE Murder Card Holder', 'look', 'beige', 1, 'any'],
    ['Collect 1 of the spare Murder Cards', 'murderCardFromDeck', 1],
    ['There is a Clue on the Lead Piping', 'clue', 8, 'LeadPiping'],
    ['There is a Clue on the Orb', 'clue', 10, 'Orb'],
    ['Look under the Bottom Right flap of the BLACK Murder Card Holder', 'look', 'black', 1, 'BR']
];

const CARD_HOLDERS = {
    'beige': 0,
    'green': 1,
    'black': 2
};
const ORNAMENTS = [
    'BirdTable', //9 <- CLUE_OBJECTS index
    'Orb',       //10
    'SunDial',   //11
    'Urn'];      //12

const WEAPONS = [
    //0       1           2          3         4
    'Dagger', 'Revolver', 'Spanner', 'Poison', 'Blunderbuss',
    //5     6      7              8
    'Rope', 'Axe', 'Candlestick', 'LeadPiping'];

const CLUE_OBJECTS = [...WEAPONS, ...ORNAMENTS];

const LABELS_UNUSED = { //for rooms, etc.
    '3_3': 'Kitchen',
    '3_9': 'Ballroom',
    '3_14': 'Conservatory',
    '6_15': 'Billiard Room',
    '7_3': 'Dining Room',
    '10_15': 'Library',
    '15_4': 'Lounge',
    '15_10': 'Hall',
    '15_15': 'Study',
    '7_9': 'Super Cluedo',
    '8_9': 'Challenge'
};

//need to break up to avoid click being absorbed by left cell!
const LABELS = { //for rooms, etc.
    '3_3': 'Kitc',
    '3_4': 'hen',
    '3_9': 'Ballr',
    '3_10': 'oom',
    '3_13': 'Co',
    '3_14': 'nse',
    '3_15': 'rva',
    '3_16': 'tory',
    '6_15': 'Bill',
    '6_16': 'iard',
    '7_15': 'Ro',
    '7_16': 'om',
    '7_3': 'Din',
    '7_4': 'ing',
    '8_3': 'Ro',
    '8_4': 'om',
    '10_15': 'Libr',
    '10_16': 'ary',
    '15_4': 'Lou',
    '15_5': 'nge',
    '15_10': 'Hall',
    '15_15': 'Stu',
    '15_16': 'dy',
    '7_9': 'Super Cluedo',
    '8_9': 'Challenge'
};

const CARD_NAMES = [
    //people from #0 to #8
    'Col. Mustard', 'Ms Scarlett', 'Captain Brown',
    'Mrs White','Mr Slate-Grey', 'Rev Green',
    'Prof Plum', 'Mrs Peacock', 'Ms Peach',
    //weapons from #9 to #17
    'Poison', 'Blunderbuss', 'Revolver', //9, 10, 11
    'Axe', 'Rope', 'Spanner', //12, 13, 14
    'Lead Piping', 'Dagger', 'CandleStick', //15, 16, 17
    //rooms from #18 to #26
    'Hall', 'Conservatory', 'Study',
    'Library', 'Lounge', 'Kitchen',
    'Billiard Rm', 'Dining Rm', 'Ballroom'
];
const CARD_CODES = [
    //people
    0x206080C, 0x104080A, 0x102070A,
    0x305070B, 0xC070105, 0xC090205,
    0xB090304, 0x80B0306, 0x90A0406,
    //weapons
    0x206070C, 0x104090A, 0x102080A,
    0x305080B, 0x90C0406, 0x80C0306,
    0xB070304, 0xB090205, 0xA070105,
    //rooms
    0x104070A, 0x102090A, 0x305090B,
    0x206080B, 0xC070205, 0xC080105,
    0xC090304, 0x70B0306, 0x80A0406
];
const ELEMENT_MAP = [
    '?', 'R', 'G', 'B', 'P', 'W',
    'Y', '0', '1', '2', '4', '5', '7'
];
const ELEMENT_MAP2 = [
    '?', 'Red', 'Green', 'Blue', 'Purple', 'White',
    'Yellow', '0', '1', '2', '4', '5', '7'
];
const ELEMENT_COLOURS = [
    '', '#ff1e0d', '#77bb41', '#0061ff', '#7b219f', 'white', '#f5ec00'
];
const ELEMENT_TEXT_COLOURS = [
    '', 'white', 'black', 'white', 'white', 'black', 'black'
];
const ELEMENT_MAP3 = {
    R: 'Red', G: 'Green', B: 'Blue', P: 'Purple', W: 'White',
    Y: 'Yellow', 0: '0', 1: '1', 2: '2', 4: '4', 5: '5', 7: '7'
};

const ACTION_CARDS = {
    "Look in 1 of the four corners of <i>any</i> card holder": [7, 'look', 1], //number of this card type, action, count for action
    "Look in 2 of the four corners of <i>any</i> card holder": [5, 'look', 2],
    "Take 1 Murder Card": [2, 'murderCardFromDeck', 1],
    "Take 2 Murder Cards": [1, 'murderCardFromDeck', 2],
    "Take 3 Murder Cards": [1, 'murderCardFromDeck', 3],
    "Take 4 Murder Cards": [1, 'murderCardFromDeck', 4],
    "False Alarm - No Clue &#x1f631;&#x1f622d;": [1, 'falseAlarm', 0]
};

const CARD_IMAGES = [
    'player-yellow',
    'player-red',
    'player-brown',
    'player-white',
    'player-gray',
    'player-green',
    'player-purple',
    'player-blue',
    'player-pink',
    'wpn-poison',
    'wpn-blunderbuss',
    'wpn-revolver',
    'wpn-axe',
    'wpn-rope',
    'wpn-spanner',
    'wpn-leadpiping',
    'wpn-dagger',
    'wpn-candlestick',
    'room-hall',
    'room-conservatory',
    'room-study',
    'room-library',
    'room-lounge',
    'room-kitchen',
    'room-billiard',
    'room-dining',
    'room-ballroom'
];