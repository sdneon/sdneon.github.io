console.log('Linear Equations'.bold.info);

const MAX = 26;
/*
1. Pick random answers for x=[0,10], y=[0,10]
2. Random generate pair of non-parallel linear equations
   a. 1st eq:
      1) Pick random x & y cooefficients.
      2) Compute matching constant for the eq fulfilling <answers>.
      3) Double check.
   b. 2nd eq:
      1) Repeat as #2a1-2
      2) Check not parallel?
         a) If parallel, return to 2b1 and repeat.
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

/*
    Linear equation in the form: Ay + Bx + C = 0
    With options to display as one of these:
     a. Ay + Bx = P
     b. Dy = Ex + F
     c. Gx = Hy + F
*/
class Equation {
    /*
        @param eq (Equation) optional equation with which to form a solvable pair
                             OR equation to make a copy of.
        @param copy (bool) whether to make a copy of given equation eq.
        @param opts (JSON) optional options:
                           opts.samestyle: (bool) whether to use same style for both eqs
                           opts.style: (int: [0-2]) preferred display style
                           opts.easyMultiples: for 1st eqn in a pair, whether to generate an easier eqn
                                               where coeffX & coeffY are multiples of each other
    */
    constructor(eq, copy, opts)
    {
        opts = opts || {};
        if (copy && eq)
        {
            //1. Create copy of given eq
            this.x = eq.x;
            this.y = eq.y;
            this.coeffX = eq.coeffX;
            this.coeffY = eq.coeffY;
            this.constant = eq.constant;
            this.friendEq = eq.friendEq;
            this.displayStyle = eq.displayStyle;
            return;
        }
        if ((typeof opts.style === 'number')
            && (opts.style >= 0) && (opts.style <= 2))
        {
            this.displayStyle = opts.style;
        }
        else
        {
            this.displayStyle = (Math.random() * 3) | 0;
        }
        if (!eq)
        {
            //2. create new simple equation
            this.x = randInt5();
            this.y = randInt5();
            //in the form Ay + Bx + C = 0
            if (!opts.easyMultiples)
            {
                //Style 1: can be difficult as coeffX & coeffY may not be multiples of each other
                this.coeffX = randNonZeroInt();
                this.coeffY = randNonZeroInt();
            }
            else
            {
                //Style2: make coeffX & coeffY be multiples of each other, for easier solving
                this.coeffX = randNonZeroInt5();
                this.coeffY = randMultipleOfNonZeroInt(this.coeffX, DIFFICULTY_LEVEL);
            }
            if (Math.random() < 0.5)
            {
                //randomly swap x & y coeff's
                const t = this.coeffX;
                this.coeffX = this.coeffY;
                this.coeffY = t;
            }
            this.constant = -((this.coeffX * this.x) + (this.coeffY * this.y));
            return;
        }
        //3. create new solvable equation for given eq
        if (opts.sameStyle)
        {
            this.displayStyle = eq.displayStyle;
        }
        this.x = eq.x;
        this.y = eq.y;
        this.friendEq = eq;
        this.findNonParallelLine(eq);
        this._doubleCheck(eq);
    }

    /*
        Unlike in constructor, 2nd equation need not be so easily divisible?
    */
    findNonParallelLine(eq)
    {
        this.coeffX = randNonZeroInt();
        this.coeffY = randNonZeroInt();
        this.constant = -((this.coeffX * this.x) + (this.coeffY * this.y));
        const factorX = this.coeffX / eq.coeffX,
            factorY = this.coeffY / eq.coeffY;
        if (Math.abs(factorX - factorY) < 1e-6)
        {
            console.log('re-find another non-parallel line'.bold.debug, this.toString());
            return this.findNonParallelLine(eq);
        }
    }

    checkAnswer(x, y)
    {
        const c = (this.coeffX * x) + (this.coeffY * y) + this.constant,
            c2 = (this.friendEq.coeffX * x) + (this.friendEq.coeffY * y) + this.friendEq.constant;
        if ((c !== 0) || (c2 !== 0))
        {
            return false;
            console.log('wrong answers!'.bold.debug);
        }
        console.log('correct answers =)'.bold.info);
        return true;
    }

    _doubleCheck(eq)
    {
        const c = (this.coeffX * this.x) + (this.coeffY * this.y) + this.constant,
            c2 = (eq.coeffX * eq.x) + (eq.coeffY * eq.y) + eq.constant;
        if ((c !== 0) || (c2 !== 0))
            console.log('equations do not tally with answer!'.bold.red);
    }

    simplifyForX()
    {
        const f = this.coeffX;
        this.coeffY /= f;
        this.coeffX = 1;
        this.constant /= f;
        console.log('simplifyForX'.bold.debug, this.coeffX, this.coeffY, this.constant);
    }

    simplifyForY()
    {
        const f = this.coeffY;
        this.coeffX /= f;
        this.coeffY = 1;
        this.constant /= f;
        console.log('simplifyForY'.bold.debug, this.coeffX, this.coeffY, this.constant);
    }

    //simplify for whichever |coeff| is smaller
    simplifyForXOrY()
    {
        if (Math.abs(this.coeffX) <= Math.abs(this.coeffY))
            return this.simplifyForX();
        this.simplifyForY();
    }

    isEasyForElimination()
    {
        const NO = {
            add: false,
            factor: false, //|factorRaw|
            factorRaw: false,
            variable: false,
            eqNum: false, //1 or 2
            info: false
        };
        if (!this.friendEq) return NO;
        const
            x1 = Math.abs(this.friendEq.coeffX),
            x2 = Math.abs(this.coeffX),
            y1 = Math.abs(this.friendEq.coeffY),
            y2 = Math.abs(this.coeffY),
            easyX = (x1 <= x2)?((x2 % x1) === 0):((x1 % x2) === 0),
            easyY = (y1 <= y2)?((y2 % y1) === 0):((y1 % y2) === 0),
            easy = easyX || easyY;
        if (!easy) return NO;

        let factor = 'either',
            variable = 'x or y'; //make the same amount of this variable in both eqns
        if (easyX && easyY)
        {
            //pick smaller one
            const mulX = (x1 <= x2)? Math.abs(x2 / x1):Math.abs(x1 / x2),
                mulY = (y1 <= y2)? Math.abs(y2 / y1):Math.abs(y1 / y2);
            if (mulX <= mulY)
            {
                variable = 'x';
                if (x1 >= x2)
                {
                    factor = (x1 / x2) | 0;
                }
                else
                {
                    factor = (x2 / x1) | 0;
                }
                factor = Math.abs(factor);
            }
            else
            {
                variable = 'y';
                if (y1 >= y2)
                {
                    factor = (y1 / y2) | 0;
                }
                else
                {
                    factor = (y2 / y1) | 0;
                }
                factor = Math.abs(factor);
            }
        }
        else if (easyX) //only
        {
            variable = 'x';
            if (x1 >= x2)
            {
                factor = (x1 / x2) | 0;
            }
            else
            {
                factor = (x2 / x1) | 0;
            }
            factor = Math.abs(factor);
        }
        else //easyY only
        {
            variable = 'y';
            if (y1 >= y2)
            {
                factor = (y1 / y2) | 0;
            }
            else
            {
                factor = (y2 / y1) | 0;
            }
            factor = Math.abs(factor);
        }
        let toAdd = true, //check if same sign, to determine whether to add or subtract eqns
            eq = 1; //which eq need to be multiplied (by factor) to get same amount of variable to be removed
        if (variable === 'x')
        {
            if (x1 > x2) eq = 2;
            if ((this.coeffX * this.friendEq.coeffX) >= 0)
                toAdd = false; //as same sign, so need to invert 1 eq
        }
        else //variable === 'y'
        {
            if (y1 > y2) eq = 2;
            if ((this.coeffY * this.friendEq.coeffY) >= 0)
                toAdd = false; //as same sign, so need to invert 1 eq
        }
        return {
            add: toAdd,
            factor: factor,
            factorRaw: toAdd? factor: -factor,
            variable: variable,
            eqNum: eq,
            info: `E.g.: ${toAdd?'Add ': 'Subtract '}${factor} times of eqn ${eq} to eliminate {${variable}}`
        };
    }

    //multiply eqn by given factor
    multiply(f)
    {
        this.coeffX *= f;
        this.coeffY *= f;
        this.constant *= f;
    }

    //divide eqn by given factor
    divide(f)
    {
        this.coeffX /= f;
        this.coeffY /= f;
        this.constant /= f;
    }

    //add given eqn to own eqn
    add(e)
    {
        this.coeffX += e.coeffX;
        this.coeffY += e.coeffY;
        this.constant += e.constant;
    }

    //set the value of X and consolidate constants
    setX(x)
    {
        this.constant += this.coeffX * x;
        this.coeffX = 0;
    }

    //set the value of X and consolidate constants
    setY(y)
    {
        this.constant += this.coeffY * y;
        this.coeffY = 0;
    }

    toAnsString()
    {
        return `Ans: x = ${this.x}, y = ${this.y}`;
    }

    toRawString()
    {
        let s = '';
        //y
        if (this.coeffY === 1)
            s += `y`;
        else if (this.coeffY === -1)
            s += `-y`;
        else
            s += `${this.coeffY}y`;
        //x
        if (this.coeffX > 1)
            s += ` + ${this.coeffX}x`;
        else if (this.coeffX === 1)
            s += ` + x`;
        else if (this.coeffX === -1)
            s += ` - x`;
        else
            s += ` - ${-this.coeffX}x`;
        //constant
        if (this.constant !== 0)
        {
            if (this.constant > 0)
                s += ` + ${this.constant}`;
            else
                s += ` - ${-this.constant}`;
        }
        s += ` = 0 | [x = ${this.x}, y = ${this.y}] | {${this.coeffX}, ${this.coeffY}}`;
        return s;
    }

    /*
        Formatted to desired displayStyle
         0. Ay + Bx = P
         1. Dy = Ex + F
         2. Gx = Hy + F
    */
    toString()
    {
        let s = '';
        if (this.displayStyle === 0)
        {
            //Style 0. Ay + Bx = P
            //console.log('s0'.bold.debug);
            //y
            if (this.coeffY !== 0)
            {
                if (this.coeffY === 1)
                    s += 'y';
                else if (this.coeffY === -1)
                    s += '-y';
                else
                    s += `${this.coeffY}y`;
            }
            //x
            if (this.coeffX !== 0)
            {
                if (this.coeffX > 1)
                    s += ` + ${this.coeffX}x`;
                else if (this.coeffX === 1)
                    s += ` + x`;
                else if (this.coeffX === -1)
                    s += ` - x`;
                else
                    s += ` - ${-this.coeffX}x`;
            }
            //constant
            if (this.constant !== 0)
                s += ` = ${-this.constant}`;
            else
               s += ` = 0`;
            return s;
        }
        if (this.displayStyle === 1)
        {
            //Style 1. Dy = Ex + F
            //console.log('s1'.bold.debug);
            //y
            if (this.coeffY === 1)
                s += 'y = ';
            else if (this.coeffY === -1)
                s += '-y = ';
            else
                s += `${this.coeffY}y = `;
            //x
            const negCX = -this.coeffX;
            if (negCX === 1)
                s += `x`;
            else if (negCX === -1)
                s += `-x`;
            else
                s += `${negCX}x`;
            //constant
            if (this.constant !== 0)
            {
                const negC = -this.constant;
                if (negC > 0)
                    s += ` + ${negC}`;
                else
                    s += ` - ${-negC}`;
            }
            return s;
        }
        //Style 2. Gx = Hy + F
        //console.log('s2'.bold.debug);
        //x
        if (this.coeffX === 1)
            s += `x = `;
        else if (this.coeffX === -1)
            s += `-x = `;
        else
            s += `${this.coeffX}x = `;
        //y
        const negCY = -this.coeffY;
        if (negCY === 1)
            s += `y`;
        else if (negCY === -1)
            s += `-y`;
        else
            s += `${negCY}y`;
        //constant
        if (this.constant !== 0)
        {
            const negC = -this.constant;
            if (negC > 0)
                s += ` + ${negC}`;
            else
                s += ` - ${-negC}`;
        }
        return s;
    }
}

/*
    Solve simple pair of linear equations.
    1. For a start: solve those easily done by elimination.
    2. Next add: Force solve by elimination.
    3. Next add: solve by substitution.
*/
class Solver {
    constructor(eqs)
    {
        this.eqs = eqs;
    }

    /*
        Solve the pair of equations
        @return (String) step by step solution
    */
    solve()
    {
        const hintElim = this.eqs.isEasyForElimination();
        if (hintElim.eqNum)
        {
            return this.solveByEliminationWithHints(hintElim);
        }
        return false;
    }

    solveByEliminationWithHints(hint)
    {
        /*
        hint:
            add: false,
            factor: false,
            factorRaw: false,
            variable: false,
            info: false
        */
        const self = this;
        let s = '', eq3, eq4, ans, x, y;

        function solveOtherVar(eqNum)
        {
            let e = (eqNum === 1)? self.eqs.friendEq: self.eqs;
            if (hint.variable === 'x')
            {
                //solve other variable, i.e. x

                //add: step by step subst of y=# into eqNum
                // A(#) + Bx = C
                if (e.coeffY === 1)
                    s += `(${y})`;
                else if (e.coeffY === -1)
                    s += `-(${y})`;
                else
                    s += `${e.coeffY}(${y})`;
                if (e.coeffX < 0)
                    s += ` - ${(e.coeffX !== -1)?-e.coeffX:''}x = ${-e.constant}\n`;
                else
                    s += ` + ${(e.coeffX !== 1)?e.coeffX:''}x = ${-e.constant}\n`;
                // ## + Bx = C
                s += `${e.coeffY*y}`;
                if (e.coeffX < 0)
                    s += ` - ${(e.coeffX !== -1)?-e.coeffX:''}x = ${-e.constant}\n`;
                else
                    s += ` + ${(e.coeffX !== 1)?e.coeffX:''}x = ${-e.constant}\n`;

                eq4.setY(y);
                s += eq4.toString() + '\n';

                if (eq4.coeffX !== 1)
                {
                    //simplify Bx + C = 0 -> x = -C/B
                    eq4.divide(eq4.coeffX);
                    s += eq4.toString() + '\n';
                }

                x = -eq4.constant;
                ans = `x = ${x}, ${ans}`;
            }
            else
            {
                //solve other variable, i.e. y

                //add: step by step subst of x=# into eqNum
                // Ay + B(#) = C
                if (e.coeffY === 1)
                    s += `y `;
                else if (e.coeffY === -1)
                    s += `-y `;
                else
                    s += `${e.coeffY}y `;
                if (e.coeffX < 0)
                {
                    s += ` - `;
                }
                else
                {
                    s += ` + `;
                }
                if (Math.abs(e.coeffX) !== 1)
                {
                    s += `${Math.abs(e.coeffX)}`;
                }
                s += `(${x}) = ${-e.constant}\n`;
                // Ay + ## = C
                if (e.coeffY === 1)
                    s += `y `;
                else if (e.coeffY === -1)
                    s += `-y `;
                else
                    s += `${e.coeffY}y `;
                const cc = e.coeffX * x;
                if (cc < 0)
                    s += `- ${-cc} = ${-e.constant}\n`;
                else if (cc > 0)
                    s += `+ ${cc} = ${-e.constant}\n`;
                else
                    s += `+ 0 = ${-e.constant}\n`;

                eq4.setX(x);
                s += eq4.toString() + '\n';

                if (eq4.coeffY !== 1)
                {
                    //simplify Ay + C = 0 -> y = -C/A
                    eq4.divide(eq4.coeffY);
                    s += eq4.toString() + '\n';
                }

                y = -eq4.constant;
                ans += `, y = ${y}`;
            }
            s += `\nAns: ${ans}\n`;
        }

        s += this.eqs.friendEq.toString() + '  ---<1>\n';
        s += this.eqs.toString() + '  ---<2>\n';
        if (hint.eqNum === 1)
        {
            eq3 = new Equation(this.eqs.friendEq, true);
            if (hint.factorRaw !== 1)
            {
                s += `\n<1> X ${hint.factorRaw}:\n`;
                eq3.multiply(hint.factorRaw);
                s += eq3.toString() + '  ---<3>\n';
                s += '\nAdd above equation <3> to <2>:\n';
                s += eq3.toString() + '  ---<3>\n';
            }
            else
            {
                s += '\nAdd <1> to <2>:\n';
                s += this.eqs.friendEq.toString() + '  ---<1>\n';
            }
            s += this.eqs.toString() + '  ---<2>\n';
            s += '+++++++++++++++++\n';
            eq3.add(this.eqs);
            s += eq3.toString() + '\n';

            if (hint.variable === 'x')
            {
                //should be y remaining
                eq3.divide(eq3.coeffY);
                y = -eq3.constant;
                ans = `y = ${y}`;
            }
            else
            {
                //should be x remaining
                eq3.divide(eq3.coeffX);
                x = -eq3.constant;
                ans = `x = ${x}`;
            }
            s += eq3.toString() + '\n';

            //solve for other variable, by subst ans into eqn <1>
            // Ay + Bx + C = 0 => y = (-Bx - C)/A
            s += `\nSubst ${ans} into <1>\n`;
            s += this.eqs.friendEq.toString() + '  ---<1>\n';
            eq4 = new Equation(this.eqs.friendEq, true);
            solveOtherVar(1);
        }
        else //eqNum === 2
        {
            eq3 = new Equation(this.eqs, true);
            if (hint.factorRaw !== 1)
            {
                s += `\n<2> X ${hint.factorRaw}:\n`;
                eq3.multiply(hint.factorRaw);
                s += eq3.toString() + '  ---<3>\n';
                s += '\nAdd above equation <3> to <1>:\n';
                s += eq3.toString() + '  ---<3>\n';
            }
            else
            {
                s += '\nAdd <2> to <1>:\n';
                s += this.eqs.toString() + '  ---<2>\n';
            }
            s += this.eqs.friendEq.toString() + '  ---<1>\n';
            s += '+++++++++++++++++\n';
            eq3.add(this.eqs.friendEq);
            s += eq3.toString() + '\n';
            if (hint.variable === 'x')
            {
                //should be y remaining
                eq3.divide(eq3.coeffY);
                y = -eq3.constant;
                ans = `y = ${y}`;
            }
            else
            {
                //should be x remaining
                eq3.divide(eq3.coeffX);
                x = -eq3.constant;
                ans = `x = ${x}`;
            }
            s += eq3.toString() + '\n';

            //solve for other variable, by subst ans into eqn <2>
            // Ay + Bx + C = 0 => y = (-Bx - C)/A
            s += `\nSubst ${ans} into <2>\n`;
            s += this.eqs.toString() + '  ---<2>\n';
            eq4 = new Equation(this.eqs, true);
            solveOtherVar(2);
        }
        return s;
    }
}

function randEqs(cnt, style)
{
    const eqs = [];
    for (let i = 0; i < cnt; ++i)
    {
        let e = new Equation(null, false, style);
        console.log(e.toString());
        //e.simplifyForXOrY();

        let e2 = new Equation(e, false, style);
        console.log(e2.toString());
        console.log(e2.toAnsString());

        console.log(e2.isEasyForElimination().info);

        //const s = new Solver(e2);
        //console.log(s.solve());

        console.log('---');

        eqs.push([e, e2]);
    }
    return eqs;
}
