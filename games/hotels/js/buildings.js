//Pictures drawn as SVG: the buildings of each hotel (every hotel has its own look), leisure facilities, and the players' cars.
//A building is put together from boxes, ridged roofs, pyramids, cylinders, cones and domes, back to front.
//The map is seen from the south, looking down at an angle: a step north on the ground is half a step up the picture.

/*
A picture being drawn. Its origin is the centre of the building's footprint on the ground; y goes down, so up is negative.
art.rot turns the whole building on the ground about that centre, clockwise in radians; at 0 a box stands corner on,
with its walls running up to the left and up to the right.
*/
function newArt()
{
    const art = { s: '', x0: 0, x1: 0, y0: 0, y1: 0, rot: 0 },
        fix = (v) => v.toFixed(1);
    art.see = (x, y) => {
        art.x0 = Math.min(art.x0, x);
        art.x1 = Math.max(art.x1, x);
        art.y0 = Math.min(art.y0, y);
        art.y1 = Math.max(art.y1, y);
    };
    art.poly = (pts, fill, more) => {
        pts.forEach((p) => art.see(p[0], p[1]));
        art.s += `<polygon points='${pts.map((p) => `${fix(p[0])},${fix(p[1])}`).join(' ')}' fill='${fill}' ${more || "stroke='#0008' stroke-width='0.6'"}/>`;
    };
    art.path = (d, fill, more) => {
        art.s += `<path d='${d}' fill='${fill}' ${more || "stroke='#0008' stroke-width='0.6'"}/>`;
    };
    //where a point on the ground of the unturned building goes once the building is turned
    art.spin = (p) => {
        if (!art.rot) return p;
        const east = p[0],
            north = -2 * p[1],
            cos = Math.cos(art.rot),
            sin = Math.sin(art.rot);
        return [(east * cos) + (north * sin), -((north * cos) - (east * sin)) / 2];
    };
    return art;
}

//Which way a face on the edge from p to q looks, given a point inside the shape: [x, y] with y > 0 towards the viewer
function artOutward(p, q, inside)
{
    const n = [q[1] - p[1], p[0] - q[0]],
        away = (n[0] * (((p[0] + q[0]) / 2) - inside[0])) + (n[1] * (((p[1] + q[1]) / 2) - inside[1]));
    return (away >= 0)? n: [-n[0], -n[1]];
}

/*
A box. cx, cy: centre of its footprint; z: height of its base above the ground;
aL, aR: lengths of its left and right walls (as they are when the building is not turned); h: height;
c: { wall, side, top, win, rows } colours (no win: no windows; no side: wall, shaded)
@return the box: its corners L, F, R, B on the picture, at its base; and patch(), to paint on its walls
*/
function artBox(art, cx, cy, z, aL, aR, h, c)
{
    const front = [cx - ((aR - aL) / 2), cy + ((aL + aR) / 4)], //front corner, before any turning
        place = (p) => {
            const turned = art.spin(p);
            return [turned[0], turned[1] - z];
        },
        F = place(front),
        L = place([front[0] - aL, front[1] - (aL / 2)]),
        R = place([front[0] + aR, front[1] - (aR / 2)]),
        B = place([front[0] + aR - aL, front[1] - ((aL + aR) / 2)]),
        centre = [(F[0] + B[0]) / 2, (F[1] + B[1]) / 2],
        up = (p) => [p[0], p[1] - h],
        on = (p, q, u, v) => [p[0] + (u * (q[0] - p[0])), p[1] + (u * (q[1] - p[1])) - h + (v * h)], //on the wall from p to q; u across, v down
        walls = { L: [L, F, aL], R: [F, R, aR], BR: [R, B, aL], BL: [B, L, aR] },
        seen = {}, //walls that face the viewer
        rows = c.rows || Math.max(1, Math.floor(h / 11));
    Object.keys(walls).forEach((name) => {
        const [p, q, a] = walls[name],
            out = artOutward(p, q, centre);
        if (out[1] <= 0.01) return;
        seen[name] = true;
        const lit = (out[0] <= 0); //light comes from the left
        art.poly([p, q, up(q), up(p)], (lit || !c.side)? c.wall: c.side);
        if (!lit && !c.side)
        {
            art.poly([p, q, up(q), up(p)], '#000', "fill-opacity='0.2'");
        }
        if (!c.win) return;
        const cols = Math.max(1, Math.round(a / 9));
        for (let row = 0; row < rows; ++row)
        {
            for (let col = 0; col < cols; ++col)
            {
                const u0 = (col + 0.22) / cols,
                    u1 = (col + 0.78) / cols,
                    v0 = (row + 0.25) / (rows + 0.2),
                    v1 = (row + 0.8) / (rows + 0.2);
                art.poly([on(p, q, u0, v0), on(p, q, u1, v0), on(p, q, u1, v1), on(p, q, u0, v1)], c.win, `fill-opacity='${lit? 1: 0.75}'`);
            }
        }
    });
    art.poly([up(F), up(R), up(B), up(L)], c.top);
    return {
        F, L, R, B, h, aL, aR,
        //paint a patch on the left ('L') or right ('R') wall, if it can be seen; u across and v down, each 0 to 1. slant: how far its top leans across
        patch: (side, u0, v0, u1, v1, fill, more, slant) => {
            if (!seen[side]) return;
            const [p, q] = walls[side],
                lean = slant || 0;
            art.poly([on(p, q, u0 + lean, v0), on(p, q, u1 + lean, v0), on(p, q, u1, v1), on(p, q, u0, v1)], fill, more || "stroke='none'");
        }
    };
}

//Paint faces that share an inside point, the far ones first; each face: [points..]. Faces looking right are shaded.
function artFaces(art, faces, inside, fill)
{
    faces.map((pts) => ({ pts, y: pts.reduce((sum, p) => sum + p[1], 0) / pts.length }))
        .sort((a, b) => a.y - b.y)
        .forEach((face) => {
            art.poly(face.pts, fill);
            if (artOutward(face.pts[0], face.pts[1], inside)[0] > 0)
            {
                art.poly(face.pts, '#000', "fill-opacity='0.2'");
            }
        });
}

//A ridged roof, p high, on top of given box (as returned by artBox); the ridge runs along the longer walls
function artGable(art, box, p, fill)
{
    const up = (pt, more) => [pt[0], pt[1] - box.h - (more || 0)],
        mid = (a, b) => up([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], p),
        [L, F, R, B] = [box.L, box.F, box.R, box.B].map((pt) => up(pt)),
        inside = [(F[0] + B[0]) / 2, (F[1] + B[1]) / 2];
    if (box.aR >= box.aL)
    {
        const m1 = mid(box.L, box.F),
            m2 = mid(box.B, box.R);
        artFaces(art, [[F, R, m2, m1], [L, B, m2, m1], [L, F, m1], [R, B, m2]], inside, fill);
    }
    else
    {
        const m1 = mid(box.F, box.R),
            m2 = mid(box.L, box.B);
        artFaces(art, [[L, F, m1, m2], [B, R, m1, m2], [F, R, m1], [L, B, m2]], inside, fill);
    }
}

//A pyramid roof, p high, over a square whose walls are a long (as artBox's aL and aR)
function artPyramid(art, cx, cy, z, a, p, fill)
{
    const place = (pt) => {
            const turned = art.spin(pt);
            return [turned[0], turned[1] - z];
        },
        F = place([cx, cy + (a / 2)]),
        L = place([cx - a, cy]),
        R = place([cx + a, cy]),
        B = place([cx, cy - (a / 2)]),
        centre = place([cx, cy]),
        apex = [centre[0], centre[1] - p];
    artFaces(art, [[L, F, apex], [F, R, apex], [R, B, apex], [B, L, apex]], centre, fill);
}

//An upright cylinder; stripes: gap between rings around it (balconies), or 0
function artCylinder(art, cx, cy, z, r, h, wall, top, stripes, stripeColour)
{
    [cx, cy] = art.spin([cx, cy]);
    const y = cy - z,
        ry = r / 2;
    art.see(cx - r, y + ry);
    art.see(cx + r, y - h - ry);
    art.path(`M ${cx - r},${y - h} L ${cx - r},${y} A ${r} ${ry} 0 0 0 ${cx + r},${y} L ${cx + r},${y - h} Z`, wall);
    art.path(`M ${cx},${y + ry} A ${r} ${ry} 0 0 0 ${cx + r},${y} L ${cx + r},${y - h} L ${cx},${y - h} Z`, '#000', "fill-opacity='0.15'");
    for (let up = stripes; stripes && (up < h - 3); up += stripes)
    {
        art.path(`M ${cx - r},${y - up} A ${r} ${ry} 0 0 0 ${cx + r},${y - up}`, 'none', `stroke='${stripeColour}' stroke-width='2.2'`);
    }
    art.s += `<ellipse cx='${cx}' cy='${y - h}' rx='${r}' ry='${ry}' fill='${top}' stroke='#0008' stroke-width='0.6'/>`;
}

function artCone(art, cx, cy, z, r, h, fill)
{
    [cx, cy] = art.spin([cx, cy]);
    const y = cy - z,
        ry = r / 2;
    art.see(cx - r, y + ry);
    art.see(cx + r, y - h);
    art.path(`M ${cx - r},${y} A ${r} ${ry} 0 0 0 ${cx + r},${y} L ${cx},${y - h} Z`, fill);
    art.path(`M ${cx},${y + ry} A ${r} ${ry} 0 0 0 ${cx + r},${y} L ${cx},${y - h} Z`, '#000', "fill-opacity='0.22'");
}

function artDome(art, cx, cy, z, r, fill)
{
    [cx, cy] = art.spin([cx, cy]);
    const y = cy - z;
    art.see(cx - r, y + (r / 2));
    art.see(cx + r, y - (r * 1.15) - 7);
    art.path(`M ${cx - r},${y} A ${r} ${r * 1.15} 0 0 1 ${cx + r},${y} A ${r} ${r / 2} 0 0 1 ${cx - r},${y} Z`, fill);
    art.path(`M ${cx},${y + (r / 2)} A ${r} ${r / 2} 0 0 0 ${cx + r},${y} A ${r} ${r * 1.15} 0 0 0 ${cx},${y - (r * 1.15)} Z`, '#000', "fill-opacity='0.12'");
    art.s += `<line x1='${cx}' y1='${y - (r * 1.15)}' x2='${cx}' y2='${y - (r * 1.15) - 6}' stroke='#b8860b' stroke-width='2'/>`;
}

/*
The look of each hotel's buildings. k: size (1 for the main building, less for extensions);
odd: which way a long building lies, or every other one for variety; angled: turned by an angle (art.rot), so odd is not about how it lies
    slab: 2 long white wings at a right angle, like a boomerang; one runs up the picture and one to the left
    pagoda: tiers with jutting eaves, getting smaller
    mansard: long French mansion of 3 storeys, with a cornice and a slate roof
    tower: silvery glass skyscraper in setbacks, with a mast
    castle: keep with a pointed roof and round corner turrets
    beachhut: long beach hut of 1 storey under a thatched roof
    dome: white block under a dome, with minarets
    hut: round lodge under a wide thatched roof
    bank: columns all round, on steps, under a low roof
    townhall: block with a clock tower
*/
const FRONT_HEADING = 135; //compass heading that the front of a building faces when it is not turned: south-east, down to the right
const BUILDING_STYLES = {
    slab: (art, c, k) => {
        const thick = 18 * k,
            len = 68 * k,
            h = 22 * k,
            shift = (len - thick) / 2, //the wings share the corner where they meet
            turned = art.rot,
            wings = [[-shift, len, thick], [shift, thick, len]];
        art.rot = turned - (Math.PI / 4); //unturned, one wing runs up the picture and one to the left
        wings.sort((a, b) => art.spin([a[0], 0])[1] - art.spin([b[0], 0])[1]); //the far one first
        wings.forEach(([x, aL, aR]) => artBox(art, x, 0, 0, aL, aR, h, c));
        art.rot = turned;
    },
    pagoda: (art, c, k, odd) => {
        const tiers = (k >= 1)? [[26, 20], [20, 16], [14, 13]]: (odd? [[22, 18], [15, 13]]: [[20, 15], [14, 12], [9, 10]]),
            eave = { wall: c.top, top: c.top };
        let z = 0;
        tiers.forEach(([a, h], i) => {
            artBox(art, 0, 0, z, a, a, h, c);
            z += h;
            if (i < tiers.length - 1)
            {
                artBox(art, 0, 0, z, a + 7, a + 7, 3, eave);
                z += 3;
            }
            else
            {
                artPyramid(art, 0, 0, z, a + 6, 15, c.top);
            }
        });
    },
    mansard: (art, c, k, odd, angled) => {
        const lying = odd && !angled, //turned by an angle, it starts from the one lie: front wall on the right
            [aL, aR] = lying? [54 * k, 22 * k]: [22 * k, 54 * k],
            h = 33 * k,
            long = lying? 'L': 'R',
            box = artBox(art, 0, 0, 0, aL, aR, h, Object.assign({}, c, { rows: 3 }));
        box.patch(long, 0.44, 0.7, 0.56, 1, '#5d4037'); //front door
        artBox(art, 0, 0, h, aL + 3, aR + 3, 2.5, { wall: c.wall, side: c.side, top: c.wall });
        const roof = artBox(art, 0, 0, h + 2.5, aL - 4, aR - 4, 7 * k, { wall: c.top, top: c.top });
        [0.15, 0.4, 0.65, 0.85].forEach((u) => roof.patch(long, u, 0.2, u + 0.07, 0.9, '#fff8e1')); //dormer windows
        artGable(art, roof, 6 * k, c.top);
    },
    tower: (art, c, k, odd) => {
        const tiers = (k >= 1)? [[22, 58], [16, 26], [10, 16]]: (odd? [[19, 50], [12, 18]]: [[17, 36], [12, 16], [7, 10]]),
            glint = "fill-opacity='0.4' stroke='none'";
        let z = 0;
        tiers.forEach(([a, h]) => {
            const box = artBox(art, 0, 0, z, a, a, h, c);
            box.patch('L', 0.1, 0, 0.3, 1, '#fff', glint, 0.3); //light on the glass
            box.patch('R', 0.45, 0, 0.55, 1, '#fff', glint, 0.3);
            z += h;
        });
        art.see(0, -z - 20);
        art.s += `<line x1='0' y1='${-z}' x2='0' y2='${-z - 18}' stroke='#333' stroke-width='1.5'/><circle cx='0' cy='${-z - 18}' r='2' fill='#e53935'/>`;
    },
    castle: (art, c, k, odd) => {
        const a = 25 * k,
            h = 34 * k;
        if (odd) //a round tower by itself
        {
            artCylinder(art, 0, 0, 0, 15 * k * 1.2, 46 * k, c.wall, c.top, 12, c.win);
            artCone(art, 0, 0, 46 * k, 20 * k * 1.2, 24 * k, c.top);
            return;
        }
        artBox(art, 0, 0, 0, a, a, h, c);
        artPyramid(art, 0, 0, h, a, 20 * k, c.top);
        [-a, a].forEach((x) => {
            artCylinder(art, x, 0, 0, 7 * k, h + (14 * k), c.wall, c.top, 0);
            artCone(art, x, 0, h + (14 * k), 9 * k, 16 * k, c.top);
        });
    },
    beachhut: (art, c, k, odd, angled) => {
        const lying = odd && !angled,
            [aL, aR] = lying? [52 * k, 20 * k]: [20 * k, 52 * k],
            long = lying? 'L': 'R',
            box = artBox(art, 0, 0, 0, aL, aR, 12, Object.assign({}, c, { rows: 1 })),
            roof = artBox(art, 0, 0, 12, aL + 6, aR + 6, 1.5, { wall: c.top, top: c.top }); //eaves
        box.patch(long, 0.46, 0.25, 0.56, 1, '#6d4c41'); //door
        artGable(art, roof, 11 * k, c.top);
    },
    dome: (art, c, k) => {
        const a = 27 * k,
            h = 30 * k;
        artBox(art, 0, 0, 0, a, a, h, c);
        artDome(art, 0, 0, h, a * 0.62, c.top);
        if (k < 1) return;
        [-a, a].forEach((x) => {
            artCylinder(art, x, 0, 0, 4, h + 22, c.wall, c.top, 14, c.win);
            artDome(art, x, 0, h + 22, 5, c.top);
        });
    },
    hut: (art, c, k) => {
        const r = 24 * k;
        artCylinder(art, 0, 0, 0, r, 18 * k, c.wall, c.wall, 0);
        art.path(`M -5,${r / 2} L -5,${(r / 2) - (12 * k)} L 5,${(r / 2) - (12 * k)} L 5,${r / 2} Z`, c.win); //doorway
        artCone(art, 0, 0, 16 * k, r * 1.4, 36 * k, c.top);
    },
    bank: (art, c) => {
        const column = "stroke='#0007' stroke-width='0.4'";
        artBox(art, 0, 0, 0, 32, 50, 4, { wall: '#bdbdbd', top: '#e0e0e0' }); //steps
        const box = artBox(art, 0, 0, 4, 26, 44, 24, c);
        for (let i = 0; i < 6; ++i)
        {
            box.patch('R', (i + 0.25) / 6, 0.04, (i + 0.6) / 6, 1, '#fff', column);
        }
        for (let i = 0; i < 3; ++i)
        {
            box.patch('L', (i + 0.25) / 3, 0.04, (i + 0.55) / 3, 1, '#fff', column);
        }
        const roof = artBox(art, 0, 0, 28, 29, 47, 3, { wall: c.wall, side: c.side, top: c.wall });
        artGable(art, roof, 10, c.top);
        const x = (roof.L[0] + roof.F[0]) / 2, //a gold coin on the gable end
            y = ((roof.L[1] + roof.F[1]) / 2) - 3 - 4;
        art.s += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='3.6' fill='#ffca28' stroke='#8d6e00' stroke-width='0.8'/>
            <text x='${x.toFixed(1)}' y='${(y + 2.2).toFixed(1)}' font-size='6' font-weight='bold' text-anchor='middle' fill='#6d4c00'>$</text>`;
    },
    townhall: (art, c) => {
        const box = artBox(art, 0, 0, 0, 30, 30, 26, Object.assign({}, c, { rows: 2 }));
        box.patch('L', 0.4, 0.5, 0.6, 1, '#4e342e'); //door
        artBox(art, 0, 0, 26, 32, 32, 2.5, { wall: c.top, top: c.top });
        const tower = artBox(art, 0, 0, 28.5, 11, 11, 26, { wall: c.wall, side: c.side, top: c.top }),
            x = (tower.L[0] + tower.F[0]) / 2,
            y = ((tower.L[1] + tower.F[1]) / 2) - 18;
        art.s += `<ellipse cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' rx='3.6' ry='4.2' fill='#fff' stroke='#000' stroke-width='0.7'/>
            <path d='M ${x.toFixed(1)},${(y - 3).toFixed(1)} L ${x.toFixed(1)},${y.toFixed(1)} L ${(x + 2).toFixed(1)},${(y + 1.5).toFixed(1)}' fill='none' stroke='#000' stroke-width='0.7'/>`;
        artPyramid(art, 0, 0, 54.5, 11, 16, c.top);
    }
};

/*
Picture of a building of given hotel (or of the Bank or Town Hall).
@param site (object) its entry in HOTEL_SITES or PLACES: style and colours; and optionally, per plot (same order as plots):
    turn: a compass heading in degrees (0 north / up, 90 east / right) for the building's front to face: the wall with
        the door of a long building, the wall on the right of others, the inside of Boomerang's angle at heading - 45;
        or true / false for a long building to lie up to the left / right; or nothing, for the default
    sizes: its size (1: a main building); or false or nothing, for the default
@param phase (int) 0: main building; 1 onwards: extensions
@param scale (number) of the picture
@return ({ svg, left, top }) left, top: where the picture's corner goes, from the centre of the building's footprint
*/
function buildingArt(site, phase, scale)
{
    const art = newArt(),
        turn = site.turn? site.turn[phase]: undefined,
        angled = (typeof turn === 'number'),
        size = site.sizes? site.sizes[phase]: undefined,
        k = (typeof size === 'number')? size: ((phase === 0)? 1: [0.74, 0.66, 0.8, 0.7][(phase - 1) % 4]);
    art.rot = angled? (turn - FRONT_HEADING) * Math.PI / 180: 0;
    BUILDING_STYLES[site.style](art, site, k, (typeof turn === 'boolean')? turn: (phase % 2) === 1, angled);
    const pad = 2,
        w = art.x1 - art.x0 + (2 * pad),
        h = art.y1 - art.y0 + (2 * pad);
    return {
        svg: `<svg xmlns='http://www.w3.org/2000/svg' width='${(w * scale).toFixed(0)}' height='${(h * scale).toFixed(0)}'
            viewBox='${(art.x0 - pad).toFixed(1)} ${(art.y0 - pad).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}'>${art.s}</svg>`,
        left: (art.x0 - pad) * scale,
        top: (art.y0 - pad) * scale
    };
}

//Leisure facilities, each to its hotel's theme; all drawn on 84 x 52, lying on the ground
const PARASOL = (x, y, colour) => `<line x1='${x}' y1='${y}' x2='${x}' y2='${y - 14}' stroke='#795548' stroke-width='1.5'/>
    <path d='M${x - 10} ${y - 12} q10 -14 20 0 z' fill='${colour}' stroke='#0006' stroke-width='0.5'/>`;
const PALM = (x, y) => `<path d='M${x} ${y} q2 -9 0 -16' fill='none' stroke='#795548' stroke-width='2'/>
    <path d='M${x} ${y - 16} q-9 -7 -12 1 q7 -5 12 -1 q-3 -10 -9 -9 q8 -1 9 9 q2 -10 9 -9 q-6 0 -9 9 q6 -5 12 0 q-4 -8 -12 0 z' fill='#2e7d32' stroke='#1b5e20' stroke-width='0.4'/>`;
const LEISURE_ART = {
    //a pool in the shape of a boomerang
    boomerang: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#e8d8a8' stroke='#0006' stroke-width='0.6'/>
        <path d='M16,38 Q30,6 68,12 Q76,15 70,22 Q46,20 32,43 Q22,47 16,38 Z' fill='#29b6f6' stroke='#0277bd' stroke-width='1.5'/>
        <path d='M26,32 q8,-12 22,-14' fill='none' stroke='#fff' stroke-width='1.2' stroke-opacity='0.8'/>
        ${PARASOL(62, 40, '#e53935')}${PARASOL(14, 24, '#fdd835')}`,
    //Japanese garden: carp pond, arched red bridge, cherry tree and a torii gate
    garden: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#a5d6a7' stroke='#0006' stroke-width='0.6'/>
        <path d='M14,30 Q20,18 38,22 Q54,16 68,26 Q74,36 56,40 Q36,46 22,40 Q12,36 14,30 Z' fill='#4fc3f7' stroke='#0277bd' stroke-width='1'/>
        <circle cx='30' cy='33' r='1.6' fill='#ff7043'/><circle cx='52' cy='30' r='1.6' fill='#fff'/><circle cx='44' cy='37' r='1.4' fill='#ff7043'/>
        <path d='M26,36 Q42,10 58,34' fill='none' stroke='#c62828' stroke-width='4'/>
        <path d='M26,32 Q42,6 58,30' fill='none' stroke='#c62828' stroke-width='1.2'/>
        <path d='M70,26 v-16 M80,28 v-16 M67,11 h16 M69,15 h12' fill='none' stroke='#c62828' stroke-width='2'/>
        <path d='M12,26 q1,-8 -1,-14' fill='none' stroke='#5d4037' stroke-width='2'/>
        <circle cx='8' cy='11' r='5' fill='#f8bbd0'/><circle cx='14' cy='8' r='5.5' fill='#f48fb1'/><circle cx='15' cy='14' r='4' fill='#f8bbd0'/>`,
    //formal French garden: clipped beds around a fountain
    fountain: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#efe6cf' stroke='#0006' stroke-width='0.6'/>
        <path d='M42,13 A34,17 0 0 0 9,28 L30,29 A12,6 0 0 1 42,24 Z M46,13 A34,17 0 0 1 75,28 L54,29 A12,6 0 0 0 46,24 Z
            M9,33 A34,17 0 0 0 40,47 L40,36 A12,6 0 0 1 30,32 Z M75,33 A34,17 0 0 1 44,47 L44,36 A12,6 0 0 0 54,32 Z' fill='#66bb6a' stroke='#2e7d32' stroke-width='0.8'/>
        <ellipse cx='42' cy='30' rx='11' ry='5.5' fill='#4fc3f7' stroke='#90a4ae' stroke-width='2'/>
        <ellipse cx='42' cy='28' rx='4' ry='2' fill='#cfd8dc' stroke='#78909c' stroke-width='0.6'/>
        <path d='M42,28 v-14 M42,14 q-7,2 -8,10 M42,14 q7,2 8,10 M42,17 q-4,2 -4,7 M42,17 q4,2 4,7' fill='none' stroke='#e1f5fe' stroke-width='1.3'/>`,
    //tennis court and a helicopter pad
    tennis: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#81c784' stroke='#0006' stroke-width='0.6'/>
        <polygon points='8,31 36,15 56,24 28,41' fill='#c75b39' stroke='#fff' stroke-width='1.2'/>
        <path d='M22,23 L42,32.5 M13,31.5 L39,18 M25,38 L51,24.5' fill='none' stroke='#fff' stroke-width='0.8'/>
        <path d='M22,23 L42,32.5' fill='none' stroke='#263238' stroke-width='1.6'/>
        <ellipse cx='64' cy='36' rx='12' ry='6' fill='#78909c' stroke='#fdd835' stroke-width='1.4'/>
        <text x='64' y='39' font-size='8' font-weight='bold' text-anchor='middle' fill='#fff'>H</text>`,
    //golf: green with a flag, bunker and pond
    golf: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#7cb342' stroke='#0006' stroke-width='0.6'/>
        <path d='M16,30 Q24,16 44,18 Q66,18 68,30 Q62,42 40,40 Q20,42 16,30 Z' fill='#aed581'/>
        <path d='M14,36 q6,-6 12,-1 q4,6 -4,7 q-8,1 -8,-6 z' fill='#f5e6a3' stroke='#c8b560' stroke-width='0.6'/>
        <path d='M58,38 q6,-5 12,-1 q2,5 -6,6 q-7,0 -6,-5 z' fill='#4fc3f7' stroke='#0277bd' stroke-width='0.8'/>
        <ellipse cx='46' cy='27' rx='2.2' ry='1.1' fill='#263238'/>
        <line x1='46' y1='27' x2='46' y2='8' stroke='#eee' stroke-width='1.2'/><path d='M46,8 l10,3.5 l-10,3.5 z' fill='#e53935'/>
        <circle cx='34' cy='31' r='1.3' fill='#fff' stroke='#0006' stroke-width='0.3'/>`,
    //beach: sand, surf, surfboards, a palm and a parasol
    beach: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#f3e0a8' stroke='#0006' stroke-width='0.6'/>
        <path d='M4,34 Q24,30 40,40 Q52,46 60,48 A40,20 0 0 1 4,34 Z' fill='#29b6f6'/>
        <path d='M6,33 Q24,29 40,39 Q52,45 62,47' fill='none' stroke='#fff' stroke-width='1.6'/>
        <ellipse cx='52' cy='22' rx='2.6' ry='9' fill='#ff7043' stroke='#0006' stroke-width='0.5' transform='rotate(12 52 22)'/>
        <ellipse cx='59' cy='23' rx='2.6' ry='9' fill='#26c6da' stroke='#0006' stroke-width='0.5' transform='rotate(-6 59 23)'/>
        <ellipse cx='66' cy='25' rx='2.6' ry='9' fill='#fdd835' stroke='#0006' stroke-width='0.5' transform='rotate(16 66 25)'/>
        ${PALM(20, 28)}${PARASOL(36, 30, '#e53935')}`,
    //long reflecting pool between rows of cypresses
    canal: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#eceff1' stroke='#0006' stroke-width='0.6'/>
        <polygon points='12,34 58,13 68,18 22,39' fill='#4fc3f7' stroke='#90a4ae' stroke-width='1.6'/>
        <path d='M24,32 L56,17.5' fill='none' stroke='#fff' stroke-width='1' stroke-opacity='0.8'/>
        ${[[14, 27], [26, 21.5], [38, 16], [50, 10.5], [30, 43], [42, 37.5], [54, 32], [66, 26.5]].map(([x, y]) =>
            `<ellipse cx='${x}' cy='${y - 6}' rx='2.6' ry='7' fill='#1b5e20' stroke='#0006' stroke-width='0.4'/>`).join('')}`,
    //watering hole, a flat-topped acacia and a safari tent
    waterhole: `<ellipse cx='42' cy='30' rx='40' ry='20' fill='#d9c27a' stroke='#0006' stroke-width='0.6'/>
        <path d='M20,34 Q22,24 38,26 Q50,22 58,30 Q62,38 48,40 Q30,44 20,34 Z' fill='#5aa7c7' stroke='#8d6e63' stroke-width='1.6'/>
        <path d='M12,26 q2,-8 -1,-14 M11,18 q6,-4 9,-6 M11,18 q-4,-4 -7,-5' fill='none' stroke='#5d4037' stroke-width='1.8'/>
        <ellipse cx='12' cy='9' rx='13' ry='3.6' fill='#558b2f' stroke='#33691e' stroke-width='0.5'/>
        <path d='M60,26 l8,-14 l8,14 z' fill='#bcaa7a' stroke='#0007' stroke-width='0.6'/><path d='M68,12 l-2,14 h4 z' fill='#5d4037'/>
        <path d='M30,22 q3,-3 6,0 M40,20 q3,-3 6,0' fill='none' stroke='#6d4c41' stroke-width='0.8'/>`
};

function leisureSvg(scale, kind)
{
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${84 * scale}' height='${52 * scale}' viewBox='0 0 84 52'>${LEISURE_ART[kind] || LEISURE_ART.boomerang}</svg>`;
}
//Side views of the cars, facing right: body outline and window. The long bonnet is in front (right), the cabin sits back.
const CAR_SHAPES = {
    wedge: ['M97,30 L93,22 L62,18 L47,9 L28,9 L15,20 L4,23 L3,30 Z', 'M45,11 L30,11 L21,19 L55,19 Z'],
    coupe: ['M97,30 Q97,20 84,19 L66,17 Q56,6 40,7 Q26,8 18,18 L6,21 Q2,24 3,30 Z', 'M60,17 Q53,9 40,9 Q30,10 24,17 Z'],
    cruiser: ['M3,30 L2,12 L11,20 L28,19 L36,9 L56,9 L64,19 L96,22 L97,30 Z', 'M38,11 L54,11 L60,19 L32,19 Z'] //tail fin at the back
};

function carSvg(car)
{
    const shape = CAR_SHAPES[car.shape];
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40'>
        <path d='${shape[0]}' fill='${car.colour}' stroke='#000' stroke-width='1.5' stroke-linejoin='round'/>
        <path d='${shape[1]}' fill='#cfe8f7' fill-opacity='0.55' stroke='#000' stroke-width='1'/>
        <path d='M10,25 L92,25' stroke='#fff' stroke-opacity='0.45' stroke-width='1.5'/>
        <circle cx='94.5' cy='25' r='2.4' fill='#fff59d' stroke='#000' stroke-width='0.6'/><!-- headlight -->
        <rect x='3.5' y='23' width='3' height='4' fill='#e53935' stroke='#000' stroke-width='0.5'/><!-- tail light -->
        <circle cx='24' cy='31' r='7.5' fill='#111'/><circle cx='24' cy='31' r='3.2' fill='#cfd8dc'/>
        <circle cx='78' cy='31' r='7.5' fill='#111'/><circle cx='78' cy='31' r='3.2' fill='#cfd8dc'/>
    </svg>`;
}
