console.log('Factorize Expressions Type 1'.bold.info);

const MAX = 26,
    CHANCE = [0.08, 0.75]; //cumulative chance limit of each sub-expression type
/*
Ax^2 + Bx + C = (Dx + E)(Fx + G)
Generate D, E, F & G of (Dx + E)(Fx + G) then compute Ax^2 + Bx + C.
1. Pick a mode:
   > Mode 0: 5%: (Dx + E)(Dx - E) = Ax^2 - C where A = D^2, C = E^2
     non-zero D, E: [-20, 20]
   > Mode 1: 40%: D = F = 1
     non-zero E, G: [-20, 20]
   > Mode 2: rest: random non-zero * non-one D & F
     non-zero D (aka coeffX1), F (aka coeffX2), E (aka c1), G (aka c2) aka c1=[-10,10]
2. Pick random answers for D, F, E, G as per above rules
2. Compute A, B & C
   A = DF      //coeffXpow2
   B = DG + EF //coeffX
   C = EG      //constant
QED
*/

const DIFFICULTY_LEVEL = 4;

//Get random integer within (-5, 5)
function randInt5()
{
    return ((Math.random() * 10) | 0) - 5;
}

//Get random integer within (-10, 10)
function randInt()
{
    return ((Math.random() * 20) | 0) - 10;
}

//Get random integer within (-10, 10) excluding 0
function randNonZeroInt()
{
    const n = ((Math.random() * 20) | 0) - 10;
    if (n !== 0)
        return n;
    return 1;
}

//Get random integer within (-5, 5) excluding 0
function randNonZeroInt5()
{
    const n = ((Math.random() * 10) | 0) - 5;
    if (n !== 0)
        return n;
    return 1;
}

//Get random integer within (-10, 10) excluding 0
function randNonZeroInt20()
{
    const n = ((Math.random() * 20) | 0) - 10;
    if (n !== 0)
        return n;
    return 1;
}

//Get random integer within (-10, 10) excluding 0, 1
function randNonZeroOneInt20()
{
    const n = ((Math.random() * 20) | 0) - 10;
    if ((n !== 0) && (n !== 1))
        return n;
    return 2;
}

/*
    Get random integer that is a multiple of give number n, excluding 0.
    Number should be at most [1, f] times.
    Can also be negative of n.
*/
function randMultipleOfNonZeroInt(n, f)
{
    const f2 = f * 2;
    let m = ((Math.random() * f2) | 0) - f;
    if (m === 0)
        m = Math.random() < 0.5? 2: -2;
    return n * m;
}

function getFactors(num)
{
    const isEven = num % 2 === 0;
    const max = Math.sqrt(num);
    const inc = isEven ? 1 : 2;
    let factors = [1, num];

    for (let curFactor = isEven ? 2 : 3; curFactor <= max; curFactor += inc)
    {
        if (num % curFactor !== 0) continue;
        factors.push(curFactor);
        let compliment = num / curFactor;
        if (compliment !== curFactor) factors.push(compliment);
    }

    return factors.sort(function(a, b){return a - b});
}

/*
    Expression in the form: Ax^2 + Bx + C
    that CAN be factorized in to this form: (Dx + E)(Fx + G)
*/
class QuadraticInX {
    /*
        @param expr (QuadraticInX) expression to make a copy of.
        @param copy (bool) whether to make a copy of given expression expr.
        @param opts (JSON) optional options:
                           opts.mode: (int: [0-2]) preferred expression sub-type (aka mode)
    */
    constructor(expr, copy, opts)
    {
        opts = opts || {};
        if (copy && expr)
        {
            //1. Create copy of given expr
            this.mode = expr.mode;
            this.c1 = expr.c1;
            this.c2 = expr.c2;
            this.coeffX1 = expr.coeffX1;
            this.coeffX2 = expr.coeffX2;
            this.coeffXpow2 = expr.coeffX1;
            this.coeffX = expr.coeffX1;
            this.constant = expr.constant;
            return;
        }
        //2. Pick a mode
        if (typeof opts.mode === 'number')
        {
            this.mode = opts.mode;
        }
        else
        {
            const chance = Math.random();
            if (chance < CHANCE[0])
                this.mode = 0;
            else if (chance < CHANCE[1])
                this.mode = 1;
            else
                this.mode = 2;
        }
        if (this.mode === 0)
        {
            //Mode 0: 5%: (Dx + E)(Dx - E) = Ax^2 - C where A = D^2, C = E^2
            //  non-zero D, E: [-20, 20]
            this.coeffX1 = randNonZeroInt20();
            this.coeffX2 = this.coeffX1;
            this.c1 = randNonZeroInt20();
            this.c2 = -this.c1;
        }
        else if (this.mode === 1)
        {
            //Mode 1: 40%: D = F = 1
            //  non-zero E, G: [-20, 20]
            this.coeffX1 = 1;
            this.coeffX2 = 1;
            this.c1 = randNonZeroInt20();
            this.c2 = randNonZeroInt20();
        }
        else
        {
            this.coeffX1 = randNonZeroOneInt20();
            this.coeffX2 = randNonZeroOneInt20();
            this.c1 = randNonZeroInt20();
            this.c2 = randNonZeroInt20();
        }
        //3. Normalize: if both x coefficients are negative, flip all signs!
        if ((this.coeffX1 < 0) && (this.coeffX2 < 0))
        {
            this.coeffX1 = -this.coeffX1;
            this.coeffX2 = -this.coeffX2;
            this.c1 = -this.c1;
            this.c2 = -this.c2;
        }
        //4. Compute A, B, C
        this.coeffXpow2 = this.coeffX1 * this.coeffX2;
        this.coeffX = (this.coeffX1 * this.c2) + (this.coeffX2 * this.c1);
        this.constant = this.c1 * this.c2;
        //5. Compute factors for coeffXpow2 & constant if not 1
        this.factors = [
            this.computeFactors(this.coeffXpow2),
            this.computeFactors(this.constant)];
    }

    computeFactors(v)
    {
        v = Math.abs(v);
        if (v === 1) return false;
        return getFactors(v);
    }

    getFactorsStr(i)
    {
        const f = this.factors[i];
        if (!f)
            return false;
        let s = '';
        const max = ((f.length + 1) / 2) | 0,
            end = f.length - 1;
        let j;
        for (j = 0; j < max; ++j)
        {
            if (j > 0) s += ', ';
            s += String(f[j]) + ' x ' + String(f[end-j]);
        }
        return s;
    }

    //inputs: x coeffs and constants (i.e. D, F, E, G)
    checkAnswer(xc1, xc2, c1, c2)
    {
        if ((this.c1 !== c1) || (this.c2 !== c2)
            || (this.coeffX1 !== xc1) || (this.coeffX2 !== xc2))
        {
            return false;
            console.log('wrong answers!'.bold.debug);
        }
        console.log('correct answers =)'.bold.info);
        return true;
    }

    //return LaTeX + HTML string of working
    toStepByStepSolution()
    {
        let s = '= \\(';
        s += `[${this.coeffX1}x(${this.coeffX2}x) `;
        if (this.coeffX1 >= 0)
            s += `+ ${this.coeffX1}x(${this.c2})`;
        else
            s += `${this.coeffX1}x(${this.c2})`;
        s += `] + [${this.c1}(${this.coeffX2}x)`;
        if (this.c1 >= 0)
            s += `+ ${this.c1}(${this.c2})`;
        else
            s += `${this.c1}(${this.c2})`;

        s += `]\\)<br>\\(= ${this.coeffXpow2}x^2`;
        const n1 = this.coeffX1 * this.c2,
            n2 = this.c1 * this.coeffX2;
        if (n1 >= 0)
            s += `+ ${n1}x`;
        else
            s += `${n1}x`;
        if (n2 >= 0)
            s += `+ ${n2}x`;
        else
            s += `${n2}x`;
        if (this.constant >= 0)
            s += `+ ${this.constant}`;
        else
            s += `${this.constant}`;

        s += `\\)<br>\\(= ${this.coeffXpow2}x^2`;
        if (n1 >= 0)
            s += `+ [${n1}x`;
        else
            s += `+ [${n1}x`;
        if (n2 >= 0)
            s += `+ ${n2}x]`;
        else
            s += `${n2}x]`;
        if (this.constant >= 0)
            s += `+ ${this.constant}`;
        else
            s += `${this.constant}`;

        s += `\\)<br>= ${this.toString()}`;
        //s += `\\)`;
        return s;
    }

    toAnsString()
    {
        let s = '(';
        if (this.coeffX1 < 0)
            s += '-';
        if ((this.coeffX1 !== 1) && (this.coeffX1 !== -1))
            s += `${Math.abs(this.coeffX1)}`;
        if (this.c1 < 0)
            s += 'x - ';
        else
            s += 'x + ';
        s += `${Math.abs(this.c1)})(`;

        if (this.coeffX2 < 0)
            s += '-';
        if ((this.coeffX2 !== 1) && (this.coeffX2 !== -1))
            s += `${Math.abs(this.coeffX2)}`;
        if (this.c2 < 0)
            s += 'x - ';
        else
            s += 'x + ';
        s += `${Math.abs(this.c2)})`;
        return s;
    }

    //returns qn string (in LaTeX), i.e. Ax^2 + Bx + C
    toString()
    {
        let s = '\\(';
        if (this.coeffXpow2 < 0)
            s += '-';
        if ((this.coeffXpow2 !== 1) && (this.coeffXpow2 !== -1))
            s += `${Math.abs(this.coeffXpow2)}`;
        s += 'x^2';

        //B maybe 0
        if (this.coeffX !== 0)
        {
            if (this.coeffX < 0)
                s += ' - ';
            else
                s += ' + ';
            s += `${Math.abs(this.coeffX)}x`;
        }

        if (this.constant < 0)
            s += ' - ';
        else
            s += ' + ';
        s += `${Math.abs(this.constant)}\\)`;
        return s;
    }
}

function randEqs(cnt, style)
{
    const eqs = [];
    for (let i = 0; i < cnt; ++i)
    {
        let e = new QuadraticInX(null, false, style);
        console.log(e.toString());
        //e.simplifyForXOrY();

        console.log('---');

        eqs.push(e);
    }
    return eqs;
}
