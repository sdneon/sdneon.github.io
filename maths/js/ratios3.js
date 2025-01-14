const MAX = 26,
    CHANCE = 0.5;

const DIFFICULTY_LEVEL = 4;

const NAMES = [
    'Liam', 'Olivia',
    'Noah', 'Emma',
    'Oliver', 'Charlotte',
    'Elijah', 'Amelia',
    'James', 'Ava',
    'William', 'Sophia',
    'Benjamin', 'Isabella',
    'Lucas', 'Mia',
    'Henry', 'Evelyn',
    'Theodore', 'Harper'];
const ITEMS = 'apples,pears,oranges,grapefruits,mandarins,limes,nectarines,apricots,peaches,plums,bananas,mangoes,strawberries,raspberries,blueberries,kiwifruit,passionfruit,watermelons,rockmelons,honeydew'.split(',');

function randItem()
{
    return ITEMS[randInt(ITEMS.length)];
}

//Get random integer within [0, max-1]
function randInt(max)
{
    return ((Math.random() * max) | 0);
}

//Get random integer within [1, max-1]
function randIntNonZero(max)
{
    return ((Math.random() * (max-1)) | 0) + 1;
}

//Get random integer within [2, 10]
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

function randNames()
{
    const names = NAMES.slice();
    let i = randInt(names.length);
    const name1 = names[i];
    names.splice(i, 1);
    i = randInt(names.length);
    const name2 = names[i];
    i = randInt(names.length);
    const name3 = names[i];
    return [name1, name2, name3, 'Total'];
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

function getFactorsExclude1(num)
{
    const factors = getFactors(num);
    factors.splice(0, 1);
    return factors;
}

function getCommonFactors(n1, n2)
{
    const f1 = getFactorsExclude1(n1),
        f2 = getFactorsExclude1(n2);
    const common = f1.filter(value => f2.includes(value));
    return common;
}

/*
    Ratios in the form: A:B & B2:C with one known quantity.
    where (a) Can be A & A2 or B & B2 or C & C2.
          (b) Given quantity can be total, A, B or C.
    To solve for A3:B3:C3 (combine ratios), and quantities QA, QB, QC and total (QT).
*/
class DuoRatios {
    /*
        @param expr (DuoRatios) expression to make a copy of.
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
            this.names = [...expr.names];
            this.item = expr.item;
            this.nums = [...expr.nums]; //1st ratio
            this.nums2 = [...expr.nums2]; //2nd ratio with 1 common owner
            this.ratio = [...expr.ratio]; //combined ratio
            this.quantities = [...expr.quantities]; //quantities of each person and total
            this.commonIndex = expr.commonIndex; //[0, 2] - the index of the person who appears in both ratios
            this.givenIndex = expr.givenIndex; //[0, 3] - index of person or total (3) for which the quantity is given
            this.times = expr.times;
            this.divide = expr.divide;
            return;
        }
        //2. Pick a mode [no longer needed?]
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
        //2b. Pick 3 names and an item
        this.names = randNames();
        this.item = randItem();

        //3. Pick small numbers: 2 any (for 2 persons), 2 different (for same person common in both ratios)
        const one2Ten = [];
        for (let i = 0; i < 10; ++i)
            one2Ten[i] = i + 1;
        let j = randInt(10);
        let unique1 = one2Ten[j]; //one in pair of different numbers
        one2Ten.splice(j, 1);
        j = randInt(9);
        let unique2 = one2Ten[j];
        one2Ten.splice(j, 1);

        let any1 = randIntNonZero(10),
            any2 = randIntNonZero(10);

        //3b. Randomly select one person to be in both ratios
        this.commonIndex = randInt(3);
        //3c. fill in
        if (unique1 === any1)
        {
            unique1 = any1 = 1;
        }
        else
        {
            const commonFactors = getCommonFactors(unique1, any1);
            if (commonFactors.length > 0)
            {
                const f = commonFactors[commonFactors.length - 1];
                unique1 = (unique1 / f) | 0;
                any1 = (any1 / f) | 0;
            }
        }
        if (unique2 === any2)
        {
            unique2 = any2 = 1;
        }
        else
        {
            const commonFactors = getCommonFactors(unique2, any2);
            if (commonFactors.length > 0)
            {
                const f = commonFactors[commonFactors.length - 1];
                unique2 = (unique2 / f) | 0;
                any2 = (any2 / f) | 0;
            }
        }

        if (this.commonIndex === 0)
        {
            this.nums = [unique1, any1, false];
            this.nums2 = [unique2, false, any2];
            this.ratio = [unique1 * unique2, any1 * unique2, any2 * unique1];
        }
        else if (this.commonIndex === 1)
        {
            this.nums = [any1, unique1, false];
            this.nums2 = [false, unique2, any2];
            this.ratio = [any1 * unique2, unique1 * unique2, any2 * unique1];
        }
        else //if (this.commonIndex === 2)
        {
            this.nums = [any1, false, unique1];
            this.nums2 = [false, any2, unique2];
            this.ratio = [any1 * unique2, any2 * unique1, unique1 * unique2];
        }
        //3d. Check if can simplify combined ratio
        {
            const commonFactors = getCommonFactors(this.ratio[0], this.ratio[1]);
            if (commonFactors.length > 0)
            {
                const commonFactors2 = getCommonFactors(this.ratio[0], this.ratio[2]);
                if (commonFactors2.length > 0)
                {
                    const common = commonFactors.filter(value => commonFactors2.includes(value));
                    if (common.length > 0)
                    {
                        const f = common[common.length - 1];
                        this.ratio[0] = (this.ratio[0] / f) | 0;
                        this.ratio[1] = (this.ratio[1] / f) | 0;
                        this.ratio[2] = (this.ratio[2] / f) | 0;
                    }
                }
            }
        }
        this.ratio[3] = this.ratio[0] + this.ratio[1] + this.ratio[2];

        //4. Randomly pick 1 quantity to reveal, and the quantity
        //TODO: must select a big enough number for total quantity, or a divisible number for the rest!!!
        this.givenIndex = randInt(4);

        //4b. Randomly pick a small multiplier for quantity to apply to smallest number in ratio
        const factor = randInt(3) + 2, //[2,5]; this is also the number of items per share
            smallestNumInRatio = Math.min(...this.ratio),
            indexSmallestNumInRatio = this.ratio.indexOf(smallestNumInRatio);
        //5. Compute quantities
        this.quantities = [];
        for (let i = 0; i < 4; ++i)
        {
            this.quantities[i] = this.ratio[i] * factor;
        }

        //8. Compute factors for the various numbers used in the ratios
        this.factors = [];
/*        this.factors = [
            this.computeFactors(this.nums[0]),
            this.computeFactors(this.nums[1]),
            this.computeFactors(this.nums[2]),
            this.computeFactors(this.nums2[0]),
            this.computeFactors(this.nums2[1]),
            this.computeFactors(this.nums2[2])];
*/
    }

    computeFactors(v)
    {
        if (v === false) return null;
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

    /*
    Example to convert:
        this.nums = [unique1, any1, false];
        this.nums2 = [unique2, false, any2];
        this.ratio = [unique1 * unique2, any1 * unique2, any2 * unique1];
    */
    toAnsString()
    {
        let s = '<br>';
        s += `(a) ${this.names[0]} : ${this.names[1]} : ${this.names[2]} = ${this.ratio[0]} : ${this.ratio[1]} : ${this.ratio[2]}<br>`;
        s += `(b) ${this.names[0]} has ${this.quantities[0]} ${this.item}.<br>
            ${this.names[1]} has ${this.quantities[1]} ${this.item}.<br>
            ${this.names[2]} has ${this.quantities[2]} ${this.item}.<br>
            Total number of ${this.item} = ${this.quantities[3]}<br>`;
        return s;
    }

    //returns qn string (in LaTeX), i.e. A:B:C = D:?:?
    toString()
    {
        let s = '';
        if (this.commonIndex === 0)
        {
            s += `${this.names[0]} and ${this.names[1]} have ${this.item} in the ratio of ${this.nums[0]}:${this.nums[1]},<br>`;
            s += `while ${this.names[0]} and ${this.names[2]} have ${this.item} in the ratio of ${this.nums2[0]}:${this.nums2[2]}.<br>`;
        }
        else if (this.commonIndex === 1)
        {
            s += `${this.names[0]} and ${this.names[1]} have ${this.item} in the ratio of ${this.nums[0]}:${this.nums[1]},<br>`;
            s += `while ${this.names[1]} and ${this.names[2]} have ${this.item} in the ratio of ${this.nums2[1]}:${this.nums2[2]}.<br>`;
        }
        else //if (this.commonIndex === 2)
        {
            s += `${this.names[0]} and ${this.names[2]} have ${this.item} in the ratio of ${this.nums[0]}:${this.nums[2]},<br>`;
            s += `while ${this.names[1]} and ${this.names[2]} have ${this.item} in the ratio of ${this.nums2[1]}:${this.nums2[2]}.<br>`;
        }
        if (this.givenIndex !== 3)
        {
            s += `${this.names[this.givenIndex]} has ${this.quantities[this.givenIndex]} ${this.item}.
                <br>(a) What is the combined ratio?
                <br>(b) What is the quantity each person has and the total quantity?`;
        }
        else
        {
            s += `The total number of ${this.item} is ${this.quantities[this.givenIndex]}.
                <br>(a) What is the combined ratio?
                <br>(b) What is the quantity each person has?`;
        }
        return s;
    }
}

function randEqs(cnt, style)
{
    const eqs = [];
    for (let i = 0; i < cnt; ++i)
    {
        let e = new DuoRatios(null, false, style);
        console.log(e.toString());
        console.log('---');

        eqs.push(e);
    }
    return eqs;
}
