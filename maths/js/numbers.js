
function precise(x, y) {
  return x.toPrecision(y);
}

function randInt(max)
{
    return (Math.random() * max) | 0;
}

function rand(tenPwr)
{
    return (Math.random() * Math.pow(10, tenPwr));
}

function randLargeInt(tenPwr)
{
    return rand(tenPwr) | 0;
}

function rand1()
{
    const tenPwr = randInt(6),
        num = rand(tenPwr),
        numSf = randInt(5) + 1,
        num2 = precise(num, numSf);
    console.log(`${num} to ${numSf} significant figures is:\n${num2}`);
    return [num, numSf, num2];
}

function rand2()
{
    let numDigits = randInt(1000000000), //~9 digits
        dp = randInt(12), //# of decimal places to move left for numDigits
        num = numDigits / Math.pow(10, dp),
        numSf = randInt(5) + 1,
        num2 = precise(num, numSf);
    if (num2.indexOf('e') >= 0)
    {
        num2 = Number(num2);
        //must ensure significant trailing zeroes are re-populated for floating numbers
        // (as Number() removes them!)
        let strNum2 = String(num2);
        if (strNum2.indexOf('e') < 0)
        {
            if (strNum2.indexOf('.') >= 0)
            {
                //count significant digits
                let cntSf = 0, i = 0;
                const len = strNum2.length;
                while ( (i < len) &&
                    ((strNum2[i] === '0') || (strNum2[i] === '.')) )
                {
                    ++i;
                }
                cntSf = len - i;
                while (cntSf < numSf)
                {
                    strNum2 += '0';
                    ++cntSf;
                }
                num2 = strNum2;
            }
        }
        //else can't help it! Oops!
    }
    console.log(`${num} to ${numSf} significant figures is:\n${num2}`);
    return [num, numSf, num2];
}

// Reduce a fraction by finding the Greatest Common Divisor and dividing by it.
function reduce(numerator,denominator){
  var gcd = function gcd(a,b){
    return b ? gcd(b, a%b) : a;
  };
  gcd = gcd(numerator,denominator);
  return [numerator/gcd, denominator/gcd];
}

class RatioSum {
    constructor(maxSharesPerPax, maxSharesTotal)
    {
        maxSharesPerPax = maxSharesPerPax || 99;
        this.ratio1 = randInt(maxSharesPerPax) + 1;
        this.ratio2 = randInt(maxSharesPerPax) + 2;
        const simplified = reduce(this.ratio1, this.ratio2);
        this.ratio1 = simplified[0];
        this.ratio2 = simplified[1];
        this.totalShares = this.ratio1 + this.ratio2;
        this.totalAmount = (randInt(maxSharesTotal || 100) + 1) * this.totalShares;
        this.p1Has = this.ratio1 * this.totalAmount / this.totalShares;
        this.p2Has = this.ratio2 * this.totalAmount / this.totalShares;
        this.ask = randInt(3);
    }
}
