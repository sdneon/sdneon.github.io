//hotels
const Boomerang = 'Boomerang',
    Fujiyama = 'Fujiyama',
    Grand = 'Le Grand',
    President = 'President',
    Royal = 'Park Royal',
    Waikiki = 'Waikiki',
    Taj = 'Taj Mahal',
    Safari = 'Safari',
    Bank = 'Bank',
    Townhall = 'Town Hall';
const START_AREA = [1488, 644], //start/holding area
    ROAD = [
    /*
    Format: [x, y, action, left/outer owner, left entrance slot, right/inner owner, right entrance slot,
        angle of entrance]
    where;
        entrance is 0: nil, 1: yes, 2: primary entrance
        action is b: build, $: buy, e: 1 free entrance, p: 1 free phase
    */
    [1277,  639,  '', Boomerang, 0, Fujiyama, 0, 0], //empty
    [1230,  773, 'b', Boomerang, 1, Fujiyama, 1, 273],
    [1250,  883, '$', Boomerang, 2, Fujiyama, 0, 241], //note: opposite '2' primary entrance must Not be an entrance for opposing hotel
    [1307,  987, 'b', Boomerang, 1, Fujiyama, 1, 250],
    [1282, 1095, '$', Boomerang, 1, Fujiyama, 1, 305],
    [1182, 1153, 'b', Boomerang, 1, Fujiyama, 1, 352], //5
    [1086, 1124, 'e', Boomerang, 1, Fujiyama, 1, 32],
    [ 994, 1059, 'b', Bank, 0, Fujiyama, 2, 27],
    [ 867, 1028, '$', Bank, 0, Grand, 2, 24],
    [ 743, 1027, '$', President, 1, Grand, 1, 15],
    [ 632,  958, 'p', President, 1, Grand, 1, 40], //10
    [ 531,  883, '$', President, 1, Royal, 1, 34],
    [ 427,  835, 'b', President, 1, Royal, 1, 21],
    [ 316,  814, '$', President, 2, Royal, 0, 18],
    [ 191,  759, 'b', President, 1, Royal, 1, 36],
    [ 125,  675, '$', Waikiki, 1, Royal, 1, 69], //15
    [ 111,  550, 'b', Waikiki, 2, Royal, 0, 98],
    [ 156,  441, '$', Waikiki, 1, Royal, 1, 130],
    [ 262,  369, 'e', Waikiki, 1, Royal, 1, 159],
    [ 388,  373, 'b', Waikiki, 1, Royal, 1, 187],
    [ 492,  397, '$', Taj, 0, Royal, 2, 199], //20
    [ 610,  429, '$', Taj, 1, Royal, 1, 192],
    [ 725,  448, 'b', Taj, 1, Grand, 1, 169],
    [ 822,  386, '$', Taj, 1, Grand, 1, 131],
    [ 869,  282, 'p', Taj, 1, Grand, 1, 117],
    [ 933,  168, 'b', Taj, 2, Townhall, 0, 139], //25
    [1055,  122, 'b', Safari, 2, Townhall, 0, 178],
    [1174,  160, 'b', Safari, 1, Grand, 1, 218],
    [1244,  268, '$', Safari, 1, Grand, 1, 253],
    [1244,  392, 'e', Safari, 1, Grand, 1, 270],
    [1244,  523, 'b', Safari, 1, Fujiyama, 1, 272] //30
];
const INDEX_ACTION = 2,
    INDEX_HOTEL_L = 3, //outer
    INDEX_ENTRANCE_L = 4,
    INDEX_HOTEL_R = 5, //inner
    INDEX_ENTRANCE_R = 6;
const INDEX_ANGLE = 7;
const HOTEL_MAP_SIZE = [1600, 1278];
const CELL_WIDTH = 80; //px
//Lines across the road: a car has passed one upon reaching (or going beyond) this road space
const BANK_LINE = 8,
    TOWNHALL_LINE = 26;
const NOTES = [5000, 1000, 500, 100, 50]; //bank notes; pictures are images/note-<value>.svg

/*
Entrance spots that are not where they are worked out to be (see drawBoard() in hotels.js: beside the road space, at
its angle in ROAD). Key: road space + side (L: left/outer, R: right/inner). Value: [left, top] of the spot's rectangle
in pixels on the map, and optionally the angle to turn it by, in place of the angle in ROAD.
On the demo page (?demo=1) drag an entrance to where it belongs; its line for here is printed in History.
E.g.:   '5L': [1160, 1190], '12R': [440, 780, 25],
*/
const ENTRANCE_SPOTS = {
    '1L': [1227, 754],
    '2L': [1259, 839],
    '3L': [1311, 955, 260],
    '4L': [1278, 1103],
    '5R': [1143, 1085],
    '6R': [1051, 1064],
    '7R': [965, 1002],
    '8R': [833, 958, 180],
    '14L': [110, 777],
    '14R': [178, 712],
    '15L': [39, 656],
    '16L': [21, 533],
    '17L': [86, 393],
    '17R': [154, 454],
    '18L': [202, 311],
    '18R': [235, 397],
    '19L': [347, 301],
    '19R': [334, 400],
    '21L': [576, 366],
    '21R': [545, 458],
    '25L': [856, 114],
    '26L': [1020, 57],
    '27L': [1150, 102],
    '28L': [1234, 229],
    '27R': [1100, 184],
    '28R': [1148, 261],
    '29R': [1153, 370],
    '29L': [1249, 373],
};

/*
Where things of each hotel go on the map, and the look of its buildings.
    label: [x, y] of the hotel's name
    plots: [x, y] of the centre of each building's footprint; in building order, with the leisure facilities last.
    style: the look of its buildings; see BUILDING_STYLES in buildings.js
    leisure: its leisure facilities; see LEISURE_ART in buildings.js
    wall, side, top, win: colours of the buildings' 2 walls, roof and windows
    turn and sizes are optional, and go by plot: their 1st entry is for the 1st plot (the main building), and so on
    turn: compass heading (in degs; 0 north / up, 90 east / right) for the building's front to face:
            the wall with the door of a long building, the wall on the right of others
        OR true if a long building's long side runs up to the left, false if up to the right
        OR undefined: the default. No effect on leisure facilities.
    sizes: size of the building or facility; 1 is a main building, and a facility as it comes
        OR false / undefined: the default (extensions: 0.74, 0.66, 0.8, 0.7 of the main building)
*/
const HOTEL_SITES = {
    Boomerang: {
        colour: '#1e88e5', label: [1428, 1196],
        plots: [[1476, 1108], [1462, 943]],
        style: 'slab', leisure: 'boomerang', wall: '#f4f8ff', side: '#b9cdea', top: '#3f7fd0', win: '#2f6fbf',
        outline: [[1577, 867], [1582, 1256], [965, 1249], [995, 1136], [1100, 1216], [1185, 1223], [1257, 1200], [1299, 1172], [1342, 1120], [1369, 1064], [1378, 994], [1359, 920], [1317, 866], [1290, 818], [1287, 769], [1303, 728], [1336, 697], [1344, 693], [1347, 782], [1354, 829], [1409, 865]]
    },
    Fujiyama: {
        colour: '#d8576b', label: [1055, 526],
        plots: [[1066, 726], [1043, 842], [1051, 967], [1148, 1012]],
        style: 'pagoda', leisure: 'garden', wall: '#fff5f0', side: '#e4c4bd', top: '#c62828', win: '#7a2323',
        outline: [[1182, 463], [1183, 680], [1157, 744], [1155, 800], [1168, 870], [1215, 944], [1245, 982], [1248, 1032], [1235, 1068], [1200, 1093], [1138, 1097], [1072, 1046], [1008, 997], [958, 969], [974, 851], [981, 719], [988, 643], [1012, 561], [1056, 505], [1111, 475]]
    },
    'Le Grand': {
        colour: '#1b9e77', label: [1039, 415],
        //mansions in a ring of 150 around the fountain, at NNE, WNW, E, SW and SE of it
        plots: [[824, 638], [677, 706], [929, 755], [679, 840], [872, 879], [789, 744]],
        turn: [203, 110, 270, 75, 310],
        sizes: [1.3, 0.9, 1, 1, 1, 1.5],
        style: 'mansard', leisure: 'fountain', wall: '#fff8e1', side: '#dcc98e', top: '#4e6b5a', win: '#8a6d1c',
        outline: [[1179, 459], [1094, 478], [1035, 523], [990, 618], [978, 694], [973, 852], [947, 972], [882, 960], [791, 966], [740, 966], [662, 916], [612, 866], [597, 814], [593, 745], [620, 612], [653, 512], [743, 516], [829, 490], [874, 439], [912, 370], [941, 274], [964, 252], [988, 256], [1018, 356], [1122, 320], [1093, 234], [1096, 200], [1136, 210], [1170, 265], [1177, 294]]
    },
    President: {
        colour: '#2e7d32', label: [574, 1158],
        plots: [[100, 1184], [75, 971], [222, 1196], [341, 1195], [318, 972]],
        sizes: [false,false,false,false,3],
        style: 'tower', leisure: 'tennis', wall: '#aebbc6', side: '#7d8d9a', top: '#455a64', win: '#e6f4ff', //silvery glass
        outline: [[826, 1105], [807, 1253], [30, 1254], [16, 836], [110, 766], [162, 819], [256, 860], [317, 879], [376, 885], [437, 900], [521, 947], [577, 1008], [624, 1052], [706, 1089], [763, 1101]]
    },
    'Park Royal': {
        colour: '#6a5acd', label: [457, 704],
        plots: [[403, 546], [287, 559], [380, 624], [478, 624], [262, 629]],
        style: 'castle', leisure: 'golf', wall: '#f6f1ff', side: '#cbbfe6', top: '#5e4b9a', win: '#4a3a86',
        outline: [[650, 510], [617, 601], [602, 667], [586, 746], [591, 817], [594, 849], [467, 786], [376, 759], [270, 744], [223, 713], [178, 650], [173, 568], [198, 503], [235, 451], [314, 423], [339, 422], [496, 460]]
    },
    Waikiki: {
        colour: '#e65100', label: [153, 68],
        plots: [[63, 339], [164, 268], [249, 239], [336, 229], [434, 239], [454, 87]],
        turn: [90, 76, 85, 90, 98],
        sizes: [1.6, 1.1, 1.1, 1.1, 1.1, 2.2],
        style: 'beachhut', leisure: 'beach', wall: '#fff3e0', side: '#f0c79a', top: '#c49a4a', win: '#00838f',
        outline: [[109, 766], [11, 838], [19, 19], [595, 14], [610, 66], [599, 121], [568, 174], [518, 207], [479, 236], [458, 282], [453, 322], [349, 307], [263, 312], [193, 340], [125, 391], [76, 461], [49, 542], [55, 648], [80, 714]]
    },
    'Taj Mahal': {
        colour: '#00897b', label: [601, 295],
        plots: [[743, 145], [652, 140], [820, 167], [691, 205]],
        style: 'dome', leisure: 'canal', wall: '#ffffff', side: '#d5dde0', top: '#f2f2f2', win: '#607d8b',
        outline: [[454, 325], [694, 387], [748, 380], [778, 347], [804, 287], [848, 170], [901, 111], [965, 72], [947, 19], [600, 17], [612, 70], [598, 125], [572, 170], [535, 202], [496, 231], [472, 257]]
    },
    Safari: {
        colour: '#c77700', label: [1415, 378],
        plots: [[1462, 112], [1536, 224], [1540, 362], [1397, 252]],
        sizes: [false, 0.7, 0.7, 1.5],
        style: 'hut', leisure: 'waterhole', wall: '#f3e2bd', side: '#cdb07a', top: '#8d5a1b', win: '#6d4c1b',
        outline: [[950, 19], [1576, 22], [1579, 431], [1397, 434], [1362, 464], [1348, 503], [1353, 563], [1305, 568], [1306, 287], [1279, 197], [1239, 137], [1199, 100], [1127, 66], [1073, 57], [1016, 63], [970, 68]]
    }
};
const ROAD_OUTLINE = [[1585, 436], [1584, 864], [1410, 870], [1366, 847], [1352, 815], [1345, 752], [1343, 696], [1318, 717], [1290, 764], [1293, 829], [1334, 892], [1371, 972], [1377, 1032], [1368, 1075], [1335, 1126], [1294, 1171], [1265, 1193], [1192, 1221], [1111, 1223], [1039, 1171], [994, 1137], [960, 1253], [811, 1259], [825, 1102], [793, 1103], [703, 1091], [604, 1039], [538, 966], [478, 924], [396, 888], [305, 873], [211, 844], [148, 814], [96, 749], [56, 655], [49, 573], [56, 512], [87, 438], [139, 380], [197, 338], [278, 309], [387, 306], [480, 331], [695, 390], [760, 366], [785, 340], [809, 271], [836, 195], [875, 139], [926, 94], [973, 67], [1037, 60], [1133, 72], [1197, 100], [1258, 171], [1291, 229], [1304, 305], [1308, 422], [1309, 567], [1183, 583], [1179, 396], [1177, 307], [1164, 257], [1134, 203], [1101, 196], [1087, 221], [1109, 274], [1123, 316], [1020, 351], [989, 258], [966, 250], [943, 268], [915, 357], [891, 414], [844, 466], [802, 491], [728, 513], [644, 506], [464, 452], [331, 421], [275, 436], [226, 460], [181, 528], [169, 607], [201, 688], [240, 724], [279, 749], [352, 758], [422, 773], [496, 799], [565, 828], [617, 869], [656, 907], [717, 949], [739, 967], [777, 968], [855, 961], [922, 966], [961, 979], [1024, 1006], [1071, 1045], [1131, 1091], [1158, 1096], [1202, 1090], [1238, 1066], [1249, 1023], [1243, 985], [1209, 945], [1177, 888], [1162, 830], [1153, 776], [1163, 726], [1186, 679], [1183, 585], [1310, 572], [1320, 563], [1353, 559], [1357, 484], [1378, 453], [1402, 434]];
const BUILDING_SCALE = 1.7; //size of the buildings on the map
//Each player's car: a classic known for its colour where there is one. shape: wedge, coupe or cruiser (CAR_SHAPES in buildings.js)
const CARS = [
    { name: 'Lamborghini', shape: 'wedge', colour: '#f5c400' },
    { name: 'Ferrari', shape: 'wedge', colour: '#d40000' },
    { name: 'Bentley', shape: 'cruiser', colour: '#7b4a2a' },
    { name: 'Porsche', shape: 'coupe', colour: '#f7f7f7' },
    { name: 'Mercedes Silver Arrow', shape: 'coupe', colour: '#b8bcc2' },
    { name: 'Aston Martin', shape: 'coupe', colour: '#0b5d3b' },
    { name: 'Plymouth Prowler', shape: 'cruiser', colour: '#6a1b9a' },
    { name: 'Bugatti', shape: 'coupe', colour: '#1565c0' },
    { name: 'Cadillac', shape: 'cruiser', colour: '#f48fb1' }
];
//The Bank and the Town Hall: label and plot as for the hotels; they are always there
const PLACES = {
    Bank: { label: [905, 1250], plot: [905, 1180], style: 'bank', wall: '#eceff1', side: '#b0bec5', top: '#607d8b' },
    'Town Hall': { label: [1050, 350], plot: [1052, 285], style: 'townhall', wall: '#d7a86e', side: '#b08350', top: '#6d4c41', win: '#4e342e' }
};

//Hotels actually is for 4 cars/players only! Just in case of expansion, let's reuse Cluedo's players =)
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

const HOTELS_DATA = {
    Boomerang: {
        land: 500, //land cost
        entrance: 100,
        entrances: [2, 1, 3, 4, 5, 6],
        maxEntrances: 6,
        build: [1800, 250], //cost of each phase, including leisure facilities
        ratings: [1, 2],
        rent: [
            [400,  800, 1200, 1600, 2000, 2400],
            [600, 1200, 1800, 2400, 3000, 3600]]
     },
     Fujiyama: {
        land: 1000,
        entrance: 100,
        entrances: [7, 1, 3, 4, 5, 6, 30],
        maxEntrances: 7,
        build: [2200, 1400, 1400, 500],
        ratings: [1, 1, 2, 3],
        rent: [
            [100,  200,  300,  400,  500,  600],
            [100,  200,  300,  400,  500,  600],
            [200,  400,  600,  800, 1000, 1200],
            [400,  800, 1200, 1600, 2000, 2400]]
     },
     'Le Grand': {
        land: 3000,
        entrance: 250,
        entrances: [8, 9, 10, 22, 23, 24, 27, 28, 29],
        maxEntrances: 9,
        build: [3300, 2200, 1800, 1800, 1800, 4000],
        ratings: [1, 2, 2, 2, 3, 4],
        rent: [
            [150,  300,  450,  600,  750,  900],
            [300,  600,  900, 1200, 1500, 1800],
            [300,  600,  900, 1200, 1500, 1800],
            [300,  600,  900, 1200, 1500, 1800],
            [450,  900, 1350, 1800, 2250, 2700],
            [750, 1500, 2250, 3000, 3750, 4500]]
     },
     President: {
        land: 3500,
        entrance: 250,
        entrances: [13, 9, 10, 11, 12, 14],
        maxEntrances: 6,
        build: [5000, 3000, 2250, 1750, 5000],
        ratings: [1, 2, 3, 4, 5],
        rent: [
            [ 200,  400,  600,  800, 1000, 1200],
            [ 400,  800, 1200, 1600, 2000, 2400],
            [ 600, 1200, 1800, 2400, 3000, 3600],
            [ 800, 1600, 2400, 3200, 4000, 4800],
            [1100, 2200, 3300, 4400, 5500, 6600]]
     },
     'Park Royal': {
        land: 2500,
        entrance: 200,
        entrances: [20, 11, 12, 14, 15, 17, 18, 19, 21],
        maxEntrances: 9,
        build: [3600, 2600, 1800, 1800, 3000],
        ratings: [1, 2, 2, 3, 4],
        rent: [
            [150,  300,  450,  600,  750,  900],
            [300,  600,  900, 1200, 1500, 1800],
            [300,  600,  900, 1200, 1500, 1800],
            [450,  900, 1350, 1800, 2250, 2700],
            [600, 1200, 1800, 2400, 3000, 3600]]
     },
     Waikiki: {
        land: 2500,
        entrance: 200,
        entrances: [16, 15, 17, 18, 19],
        maxEntrances: 5,
        build: [3500, 2500, 2500, 1750, 1750, 2500],
        ratings: [1, 2, 3, 3, 4, 5],
        rent: [
            [ 200,  400,  600,  800, 1000, 1200],
            [ 350,  700, 1050, 1400, 1750, 2100],
            [ 500, 1000, 1500, 2000, 2500, 3000],
            [ 500, 1000, 1500, 2000, 2500, 3000],
            [ 650, 1300, 1950, 2600, 3250, 3900],
            [1000, 2000, 3000, 4000, 5000, 6000]]
     },
     'Taj Mahal': {
        land: 1500,
        entrance: 100,
        entrances: [25, 21, 22, 23, 24],
        maxEntrances: 5,
        build: [2400, 1000, 500, 1000],
        ratings: [1, 1, 2, 3],
        rent: [
            [100,  200,  300,  400,  500,  600],
            [100,  200,  300,  400,  500,  600],
            [200,  400,  600,  800, 1000, 1200],
            [300,  600,  900, 1200, 1500, 1800]]
     },
     Safari: {
        land: 2000,
        entrance: 150,
        entrances: [26, 27, 28, 29, 30],
        maxEntrances: 5,
        build: [2600, 1200, 1200, 2000],
        ratings: [1, 1, 2, 3],
        rent: [
            [100,  200,  300,  400,  500,  600],
            [100,  200,  300,  400,  500,  600],
            [250,  500,  750, 1000, 1250, 1500],
            [500, 1000, 1500, 2000, 2500, 3000]]
     }
};