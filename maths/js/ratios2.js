const MAX = 26,
    CHANCE = 0.5;

const DIFFICULTY_LEVEL = 4;

//Get random integer within (0, max-1)
function randInt(max)
{
    return ((Math.random() * max) | 0);
}

//Get random integer within (2, 10)
function randIntTen()
{
    return ((Math.random() * 8) | 0) + 2;
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
    Ratios in the form: A:B:C = D:?:?
    where (a) there can be 2 ?s (unknowns)
          (b) D:?:? could be a simplification or expansion of A:B:C
*/
class TripleRatios {
    /*
        @param expr (TripleRatios) expression to make a copy of.
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
            this.nums = [...expr.nums];
            this.nums2 = [...expr.nums2];
            this.knownIndex = expr.knownIndex;
            this.times = expr.times;
            this.divide = expr.divide;
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
            if (chance < CHANCE)
                this.mode = 0; //simplify
            else
                this.mode = 1; //expand
        }
        //3. Pick small numbers
        const one2Ten = [];
        for (let i = 0; i < 10; ++i)
            one2Ten[i] = i + 1;
        let j = randInt(10);
        this.nums = [one2Ten[j]];
        one2Ten.splice(j, 1);
        j = randInt(9);
        this.nums[1] = one2Ten[j];
        one2Ten.splice(j, 1);
        j = randInt(8);
        this.nums[2] = one2Ten[j];
        //4. Pick a factor. Can be a fraction!
        //this.divide = (Math.random() < 0.5)? 1: randInt10(); //disable for now
        this.divide = 1;
        this.times = randIntTen();
        //5. Compute big numbers
        this.nums2 = [this.nums[0] * this.times,
            this.nums[1] * this.times,
            this.nums[2] * this.times];
        //6. Swap if "expand"
        if (this.mode === 0) //simplify
        {
            //sawp needed
            const t = this.nums;
            this.nums = this.nums2;
            this.nums2 = t;
        }
        //else if (this.mode === 1) //expand //no swap needed

        //7. Randomly choose 1 knowns
        this.knownIndex = randInt(3);
        this.nums[3] = this.nums2[this.knownIndex]; //for convenient access when grabbing factors

        //8. Compute factors for the various numbers used in the ratios
        this.factors = [
            this.computeFactors(this.nums[0]),
            this.computeFactors(this.nums[1]),
            this.computeFactors(this.nums[2]),
            this.computeFactors(this.nums[3])];
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
        let s = `${this.nums[i]}: `;
        const max = ((f.length + 1) / 2) | 0,
            end = f.length - 1;
        let j;
        for (j = 0; j < max; ++j)
        {
            if (j > 0) s += ', ';
            s += String(f[j]) + ' X ' + String(f[end-j]);
        }
        s += '';
        return s;
    }

    //return LaTeX + HTML string of working //TODO
    toStepByStepSolution()
    {
        return this.toAnsString();
    }

    toAnsString()
    {
        let s = `\\((${this.nums[0]} : ${this.nums[1]} : ${this.nums[2]})`;
        if (this.mode === 0) //simplify
        {
            s += `\\div ${this.times}`;
        }
        else
        {
            s += `\\times ${this.times}`;
        }
        s += ' = ';
        if (this.knownIndex === 0)
            s += this.nums2[0];
        else
            s += `\\boxed{${this.nums2[0]}}`;
        s += ' : ';
        if (this.knownIndex === 1)
            s += this.nums2[1];
        else
            s += `\\boxed{${this.nums2[1]}}`;
        s += ' : ';
        if (this.knownIndex === 2)
            s += this.nums2[2];
        else
            s += `\\boxed{${this.nums2[2]}}`;
        s += '\\)';
        return s;
    }

    //returns qn string (in LaTeX), i.e. A:B:C = D:?:?
    toString()
    {
        let s = `${this.nums[0]} : ${this.nums[1]} : ${this.nums[2]} = `;
        if (this.knownIndex === 0)
            s += this.nums2[0];
        else
            s += `&#x25A2;`;
        s += ' : ';
        if (this.knownIndex === 1)
            s += this.nums2[1];
        else
            s += `&#x25A2;`;
        s += ' : ';
        if (this.knownIndex === 2)
            s += this.nums2[2];
        else
            s += `&#x25A2;`;
        s += '';
        return s;
    }
}

function randEqs(cnt, style)
{
    const eqs = [];
    for (let i = 0; i < cnt; ++i)
    {
        let e = new TripleRatios(null, false, style);
        console.log(e.toString());
        console.log('---');

        eqs.push(e);
    }
    return eqs;
}
