console.log('Factorize Expressions Type 2'.bold.info);

const MAX = 26,
    CHANCE = [0.08, 0.75]; //cumulative chance limit of each sub-expression type
/*
A(Bx + C) = Dx + E
Generate A, B & C of A(Bx + C) then compute Dx + E.
1. Pick random numbers for A, B, C.
2. Compute D & E
   D = AB
   E = AC
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
    Expression in the form: A(Bx + C) with answer: Dx + E
    where D = AB, E = AC
*/
class SimpleExpr {
    /*
        @param expr (SimpleExpr) expression to make a copy of.
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
            this.a = expr.a;
            this.b = expr.b;
            this.c = expr.c;
            this.d = expr.d;
            this.e = expr.e;
            return;
        }

        //2. Randomly pick A, B, C
        this.a = randNonZeroOneInt20();
        this.b = randNonZeroInt();
        this.c = randNonZeroInt();
        //2. Compute D & E
        this.d = this.a * this.b;
        this.e = this.a * this.c;
        //3. Randomly pick a letter
        const r = Math.random();
        if (r < 0.33)
            this.x = 'x';
        else if (r < 0.66)
            this.x = 'y';
        else
            this.x = 'z';
    }

    //return LaTeX + HTML string of working
    toStepByStepSolution()
    {
        let s = '= \\(';

        let a = Math.abs(this.a);
        if (this.a > 0) a = this.a;
        else a = `(-${a})`;

        let b = Math.abs(this.b);
        if (b > 1) b = this.b;
        else b = this.b < 0? '-': '';

        let c = Math.abs(this.c);
        if (c > 1) c = this.c;
        else c = this.c < 0? '-': '';

        s += `${a}(${b}${this.x}) + ${a}(${this.c})`;
        s += '\\)<br>= ';
        s += this.toAnsString();
        return s;
    }

    toAnsString()
    {
        let d = Math.abs(this.d);
        if (this.d > 0) d = this.d;
        else d = `-${d}`;

        //let d = Math.abs(this.d);
        //if (d > 1) d = this.d;
        //else d = this.d < 0? '-': '';
        return `${d}${this.x} ${(this.e >= 0)?'+':'-'} ${Math.abs(this.e)}`;
    }

    //returns qn string (in LaTeX), i.e. A(Bx + C)
    toString()
    {
        let a = Math.abs(this.a);
        if (a > 1) a = this.a;
        else if (this.a < 0) a = '-';
        else a = '';
        return `\\(${a}(${Math.abs(this.b)>1?this.b:''}${this.x} ${(this.c >= 0)?'+':'-'} ${Math.abs(this.c)})\\)`;
    }
}

function randEqs(cnt, style)
{
    const eqs = [];
    for (let i = 0; i < cnt; ++i)
    {
        let e = new SimpleExpr(null, false, style);
        console.log(e.toString());
        //e.simplifyForXOrY();

        console.log('---');

        eqs.push(e);
    }
    return eqs;
}
