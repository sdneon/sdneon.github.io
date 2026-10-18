/*
Careers: board colour themes (owner, 2026-10-18), picked under Options ('vivid' by default). 'pastel' is the board as first built: the
colours in careers.css, art.js (PATH_THEMES) and board.js (path colour) as they are. Another theme overrides:
    board: frame (the outer track's purple), inner (inside the track), title, arrowIn (into a path)
    outer: every kind of outer square: [background, border, name colour] (none left out, or it would mix)
    entryTint: an entrance takes its path's tint
    paths: per career path: tint (its squares), disc (behind its emblem), border (its squares' and entrance's)
*/
const BOARD_THEMES = {
    pastel: { label: 'Original pastel' },
    vivid: {
        label: 'Vivid',
        board: { frame: '#4a148c', inner: '#fff', title: '#8e24aa', arrowIn: '#8e24aa' },
        outer: {
            plain: ['#fff3c4', '#222', '#222'],
            opp: ['#b39ddb', '#4527a0', '#311b92'],
            payday: ['#ffeb3b', '#f9a825', '#1b5e20'],
            hospital: ['#e91e63', '#880e4f', '#fde'],
            unemployment: ['#00a86b', '#00695c', '#ffe'],
            hawaii: ['#66bb6a', '#2e7d32', '#e65100'],
            tax: ['#ff9800', '#d81b60', '#880e4f'],
            shop: ['#ffcdd2', '#e53935', '#b71c1c'],
            auto: ['#81d4fa', '#ef6c00', '#e65100'],
            vegas: ['#ffee58', '#f9a825', '#6a1b9a'],
            charity: ['#e1f5fe', '#1565c0', '#283593'],
            entry: ['#fff3c4', '#222', '#1b5e20']
        },
        entryTint: true,
        paths: {
            Ecology: { tint: '#b9f6ca', disc: '#00e676', border: '#00a152' },
            College: { tint: '#84ffff', disc: '#00b8d4', border: '#0097a7' },
            'Big Business': { tint: '#ffd180', disc: '#ff9100', border: '#e65100' },
            Teaching: { tint: '#ffff8d', disc: '#ffd600', border: '#f9a825' },
            Politics: { tint: '#ea80fc', disc: '#d500f9', border: '#8e24aa' },
            Entertainment: { tint: '#ff80ab', disc: '#ff4081', border: '#c51162' },
            Sports: { tint: '#82b1ff', disc: '#2979ff', border: '#2962ff' },
            'Computer Science': { tint: '#a7ffeb', disc: '#1de9b6', border: '#00bfa5' }
        }
    },
    bold: {
        label: 'Bold',
        board: { frame: '#4a148c', inner: '#fffbe6', title: '#8e24aa', arrowIn: '#8e24aa' },
        outer: {
            plain: ['#fff3c4', '#222', '#222'],
            opp: ['#b39ddb', '#4527a0', '#311b92'],
            payday: ['#ffeb3b', '#f9a825', '#1b5e20'],
            hospital: ['#e91e63', '#880e4f', '#fde'],
            unemployment: ['#00a86b', '#00695c', '#ffe'],
            hawaii: ['#66bb6a', '#2e7d32', '#e65100'],
            tax: ['#ff9800', '#d81b60', '#880e4f'],
            shop: ['#ffcdd2', '#e53935', '#b71c1c'],
            auto: ['#81d4fa', '#ef6c00', '#e65100'],
            vegas: ['#ffee58', '#f9a825', '#6a1b9a'],
            charity: ['#e1f5fe', '#1565c0', '#283593'],
            entry: ['#fff3c4', '#222', '#1b5e20']
        },
        entryTint: true,
        paths: {
            Ecology: { tint: '#c5e8a0', disc: '#43a047', border: '#2e7d32' },
            College: { tint: '#a8e6df', disc: '#00897b', border: '#00695c' },
            'Big Business': { tint: '#c5cae9', disc: '#3949ab', border: '#283593' },
            Teaching: { tint: '#fff59d', disc: '#fbc02d', border: '#f9a825' },
            Politics: { tint: '#d1c4e9', disc: '#7e57c2', border: '#4527a0' },
            Entertainment: { tint: '#f8bbd0', disc: '#ec407a', border: '#ad1457' },
            Sports: { tint: '#bbdefb', disc: '#1e88e5', border: '#1565c0' },
            'Computer Science': { tint: '#b2ebf2', disc: '#00bcd4', border: '#00838f' }
        }
    },
    candy: {
        label: 'Tropical candy',
        board: { frame: '#00796b', inner: '#fff8e1', title: '#00897b', arrowIn: '#d500f9' },
        outer: {
            plain: ['#fff9c4', '#00695c', '#222'],
            opp: ['#ea80fc', '#8e24aa', '#4a148c'],
            payday: ['#ffea00', '#ffab00', '#1b5e20'],
            hospital: ['#ff1744', '#b71c1c', '#fff'],
            unemployment: ['#2979ff', '#0d47a1', '#fff'],
            hawaii: ['#ffab40', '#e65100', '#bf360c'],
            tax: ['#ff6d00', '#d50000', '#3e2723'],
            shop: ['#ff8a80', '#d50000', '#b71c1c'],
            auto: ['#80d8ff', '#ff6d00', '#e65100'],
            vegas: ['#ffff00', '#ffab00', '#6200ea'],
            charity: ['#b9f6ca', '#00a152', '#1b5e20'],
            entry: ['#fff9c4', '#00695c', '#00695c']
        },
        entryTint: true,
        paths: {
            Ecology: { tint: '#b9f6ca', disc: '#00e676', border: '#00a152' },
            College: { tint: '#84ffff', disc: '#00b8d4', border: '#0097a7' },
            'Big Business': { tint: '#ffd180', disc: '#ff9100', border: '#e65100' },
            Teaching: { tint: '#ffff8d', disc: '#ffd600', border: '#f9a825' },
            Politics: { tint: '#ea80fc', disc: '#d500f9', border: '#8e24aa' },
            Entertainment: { tint: '#ff80ab', disc: '#ff4081', border: '#c51162' },
            Sports: { tint: '#82b1ff', disc: '#2979ff', border: '#2962ff' },
            'Computer Science': { tint: '#a7ffeb', disc: '#1de9b6', border: '#00bfa5' }
        }
    }
};
//outer square kinds (OUTER in board.js) each theme colours; 'plain' is any square without a colour of its own
const THEME_KINDS = {
    plain: '.sq.outer',
    opp: '.sq.opp', payday: '.sq.payday', hospital: '.sq.hospital', unemployment: '.sq.unemployment', hawaii: '.sq.hawaii',
    tax: '.sq.tax, .sq.rent, .sq.inflation', shop: '.sq.shop, .sq.paris', auto: '.sq.auto, .sq.hobby', vegas: '.sq.vegas',
    charity: '.sq.charity', entry: '.sq.entry'
};

function boardTheme()
{
    return BOARD_THEMES[options.theme] || BOARD_THEMES[DEFAULT_OPTIONS.theme];
}

//a path's look in the theme: tint, disc (over PATH_THEMES) and border (over its colour in board.js)
function themedPath(name)
{
    return (boardTheme().paths || {})[name] || {};
}

function pathBorder(name)
{
    return themedPath(name).border || PATHS[name].colour;
}

//the theme's CSS (a <style> after careers.css; '#divBoard' makes it win over the pastel rules)
function applyThemeCss()
{
    $('#styleTheme').remove();
    const t = boardTheme();
    if (!t.outer) return;
    const b = t.board || {},
        within = (sel) => sel.split(', ').map((s) => '#divBoard ' + s).join(', ');
    let css = `#divBoard { background: ${b.frame}; }
#divBoard .inner { background-color: ${b.inner}; }
#divBoard .title { color: ${b.title}; }
#divBoard .arrow.in { background: ${b.arrowIn}; }
`;
    for (const [kind, sel] of Object.entries(THEME_KINDS))
    {
        const [bg, border, name] = t.outer[kind];
        css += `${within(sel)} { background: ${bg}; border-color: ${border}; }
${within(sel).split(', ').map((s) => s + ' .name').join(', ')} { color: ${name}; }
`;
    }
    $('head').append(`<style id="styleTheme">${css}</style>`);
}

//the theme picked: at once, the board drawn again with the tokens, trails and bubbles on it
function setTheme(key)
{
    setOption('theme', BOARD_THEMES[key]? key: DEFAULT_OPTIONS.theme);
    applyTheme();
}

function applyTheme()
{
    const pick = $('#option_theme');
    if (!pick.children().length) pick.html(Object.entries(BOARD_THEMES).map(([key, t]) => `<option value="${key}">${t.label}</option>`).join(''));
    pick.val(BOARD_THEMES[options.theme]? options.theme: DEFAULT_OPTIONS.theme);
    applyThemeCss();
    if (!$('#divBoard').children().length) return; //not drawn yet
    drawBoard();
    drawTokens();
    drawTrails();
    drawBubbles();
}
