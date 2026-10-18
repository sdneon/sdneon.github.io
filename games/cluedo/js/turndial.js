/*
Turn dial (shared by the games): players' tokens round a ring in turn order, the current player at 12 o'clock under
the arrow. While all fit at full size they are spread evenly. Else the current player and the next 2 stay full size
from 12 to about 3 o'clock, the rest go smaller from about 5 to half past 10; if even those do not fit they
are squeezed: smaller still, overlapping, each later one beneath. Hovering over a squeezed token fans them out on a
wider ring. Each turn every token travels anticlockwise round the ring to its new place.

    const dial = new TurnDial(element);                     //options: see TurnDial.DEFAULTS
    dial.draw([{ key, html, title }, ...], current);        //tokens in turn order; html: a picture, then any pins
    new TurnDial(element, { onPick: (key) => ... });        //a click on a token (else on the dial: the current one)
    TurnDial.pin('pin_gold', 'AI', 'Computer player')       //a pin's html, worn at the token's lower right
*/
class TurnDial
{
    static DEFAULTS = {
        size: 130,      //the dial's width and height (px)
        radius: 52,     //the ring the tokens' centres sit on
        bigSize: 44,    //token widths (px), as in turndial.css: full size,
        smallSize: 30,  //the rest when crowded,
        squeezedSize: 24,   //and squeezed
        gap: 2,         //px kept between tokens that should not overlap
        regular: 3,     //when crowded: the current player and the next 2 at full size
        restFrom: null, //when crowded, the rest go between these angles (degrees from 12 o'clock); null: next to the
        restTo: null,   //big tokens without touching them (about 5 to half past 10)
        fanSize: 40,    //a squeezed token's width (px) when fanned out
        fanGap: 4,      //px between tokens fanned out
        onPick: null,   //(key) a click on a token, or on the dial elsewhere (then the current player's key)
        scale: 1        //all the px sizes above (and turndial.css's) multiplied by this
    };

    constructor(el, options = {})
    {
        this.el = el;
        this.o = Object.assign({}, TurnDial.DEFAULTS, options);
        const o = this.o;
        ['size', 'radius', 'bigSize', 'smallSize', 'squeezedSize', 'gap', 'fanSize', 'fanGap'].forEach((k) => o[k] *= o.scale);
        el.style.setProperty('--td-scale', o.scale);
        const beside = this.apart((o.bigSize + o.smallSize) / 2); //a big token and a small one, side by side
        if (o.restFrom === null) o.restFrom = (o.regular - 1) * this.apart(o.bigSize) + beside;
        if (o.restTo === null) o.restTo = 360 - beside;
        this.sig = '';
        this.angles = {};   //key: angle (degrees, cumulative so a move always goes anticlockwise)
        this.fanned = false;
        el.classList.add('turn_dial');
        el.style.width = el.style.height = this.o.size + 'px';
        el.addEventListener('mouseover', (e) => { if (e.target.closest('.td_arm.squeezed')) this.fan(true); });
        el.addEventListener('mouseleave', () => this.fan(false));
        el.addEventListener('click', (e) =>
        {
            const arm = e.target.closest('.td_arm') || el.querySelector('.td_arm.current');
            if (arm && this.o.onPick) this.o.onPick(this.keys[[...el.querySelectorAll('.td_arm')].indexOf(arm)]);
        });
        this.keys = [];
    }

    static pin(cls, text, title)
    {
        return `<span class="td_pin ${cls}"${title? ` title="${title}"`: ''}>${text}</span>`;
    }

    //degrees between the centres of 2 tokens of the given width on the ring, side by side
    apart(width)
    {
        return 2 * Math.asin(Math.min(1, (width + this.o.gap) / (2 * this.o.radius))) * 180 / Math.PI;
    }

    //each place in turn order from the current player: { angle, size: 'big' / 'small' / 'squeezed' }
    slots(n)
    {
        const { regular, restFrom, restTo, bigSize, smallSize } = this.o, out = [];
        if (360 / n >= this.apart(bigSize)) //all fit at full size: evenly spread
        {
            for (let k = 0; k < n; ++k) out.push({ angle: k * 360 / n, size: 'big' });
            return out;
        }
        const step = this.apart(bigSize), rest = n - regular,
            gap = (rest > 1)? (restTo - restFrom) / (rest - 1): 0,
            size = ((rest > 1) && (gap < this.apart(smallSize)))? 'squeezed': 'small';
        for (let k = 0; k < regular; ++k) out.push({ angle: k * step, size: 'big' });
        for (let i = 0; i < rest; ++i) out.push({ angle: restFrom + i * gap, size });
        return out;
    }

    //the ring squeezed tokens fan out on: wide enough for them side by side
    fanRadius(count)
    {
        const { radius, restFrom, restTo, fanSize, fanGap } = this.o, arc = (restTo - restFrom) * Math.PI / 180;
        return Math.max(radius + fanSize / 2 + 8, (count - 1) * (fanSize + fanGap) / arc);
    }

    draw(tokens, current)
    {
        const n = tokens.length, el = this.el;
        if (!n || !tokens[current])
        {
            el.innerHTML = '';
            this.sig = '';
            return;
        }
        const sig = tokens.map((t) => t.key + '\u0001' + t.html).join('\u0002'), slots = this.slots(n),
            rebuild = sig !== this.sig, c = this.o.size / 2;
        if (rebuild)
        {
            this.sig = sig;
            this.keys = tokens.map((t) => t.key);
            this.angles = {};
            this.fanned = false;
            el.classList.remove('fanned');
            el.innerHTML = tokens.map((t) => `<div class="td_arm no_anim" data-key="${t.key}" style="left: ${c}px; top: ${c}px;">` +
                `<div class="td_token"${t.title? ` title="${t.title}"`: ''}>${t.html}</div></div>`).join('') +
                '<div class="td_arrow">&#x25B2;</div>';
        }
        const arms = el.querySelectorAll('.td_arm');
        tokens.forEach((t, j) =>
        {
            const k = (j - current + n) % n, slot = slots[k], arm = arms[j], old = this.angles[t.key];
            const angle = (old === undefined)? slot.angle: old - ((((old - slot.angle) % 360) + 360) % 360); //anticlockwise
            this.angles[t.key] = angle;
            arm.dataset.angle = angle;
            arm.classList.toggle('current', k === 0);
            ['big', 'small', 'squeezed'].forEach((size) => arm.classList.toggle(size, slot.size === size));
            arm.style.zIndex = (k === 0)? 100: (slot.size === 'squeezed')? 50 - k: 80 - k;  //later ones beneath
        });
        this.place();
        if (rebuild)
        {
            void el.offsetWidth; //placed without moving, then moves animate
            arms.forEach((arm) => arm.classList.remove('no_anim'));
        }
    }

    fan(on)
    {
        if (this.fanned === on) return;
        this.fanned = on;
        this.el.classList.toggle('fanned', on);
        this.place();
    }

    //each arm turned to its angle, its token out at the ring (upright)
    place()
    {
        const arms = this.el.querySelectorAll('.td_arm'),
            squeezed = this.el.querySelectorAll('.td_arm.squeezed').length,
            far = (this.fanned && squeezed)? this.fanRadius(squeezed): this.o.radius;
        arms.forEach((arm) =>
        {
            const angle = +arm.dataset.angle, r = arm.classList.contains('squeezed')? far: this.o.radius,
                token = arm.firstElementChild;
            arm.style.transform = `rotate(${angle}deg)`;
            token.style.transform = `translate(-50%, -50%) translateY(${-r}px) rotate(${-angle}deg)`;
        });
    }
}
