let _dice = [];

//Handle dice click and trigger auto dice roll if rollOnClick is true
function onDiceClicked(id)
{
    //console.log('dice#', id, 'clicked');
    const dice = _dice[id];
    if (dice && dice.rollOnClick)
    {
        if (dice.clickHandler)
        {
            dice.clickHandler(id);
        }
        dice.roll();
    }
}

//Generic animated dice courtesy of rems @ sourcescodester, and fixed & enhanced by Neon
class Dice {
    /*
    Spawn a dice for given div, with optional rollOnClick and clickHandler.
    */
    constructor(id, rollOnClick, clickHandler)
    {
        this.val = 1;
        this.id = id; //use same ID for class instance & div
        this.rollOnClick = rollOnClick;
        if ('function' === typeof clickHandler)
        {
            this.clickHandler = clickHandler;
        }
        _dice[id] = this;
    }

    roll(cb)
    {
        const oldVal = this.val;
        this.val = this.random();
        const self = this,
            div = document.getElementById(this.id); //Note: cannot use cached div, will desync!? So fetch fresh
        for (let i = 1; i <= 6; ++i)
        {
            div.classList.remove('show-' + i);
        }
        setTimeout(() => {
            div.classList.add('show-' + self.val);
            if ('function' === typeof cb)
            {
                cb(self.id, self.val);
            }
            if ('function' === typeof self.rollHandler)
            {
                self.rollHandler(self.id, self.val);
            }
        }, (oldVal != this.val)? 0: 200);
    }

    //link 2 dice to roll together on click
    link(otherDice)
    {
        const self = this;
        this.clickHandler = () => {
            otherDice.roll();
        };
        if (!otherDice.clickHandler)
        {
            otherDice.clickHandler = () => {
                self.roll();
            };
        }
    }

    //unlink 2 linked dice, so that they no longer roll together
    unlink(otherDice)
    {
        this.clickHandler = undefined;
        otherDice.clickHandler = undefined;
    }

    //generate the HTML for a dice. Requires dice.css
    static html(id)
    {
        return `<div id='${id}' class='dice' onclick='onDiceClicked("${id}");'>
    <div id='dice-one-side-one' class='side one'>
        <div class='dot_red one-1'></div>
    </div>
    <div id='dice-one-side-two' class='side two'>
        <div class='dot two-1'></div>
        <div class='dot two-2'></div>
    </div>
    <div id='dice-one-side-three' class='side three'>
        <div class='dot three-1'></div>
        <div class='dot three-2'></div>
        <div class='dot three-3'></div>
    </div>
    <div id='dice-one-side-four' class='side four'>
        <div class='dot_red four-1'></div>
        <div class='dot_red four-2'></div>
        <div class='dot_red four-3'></div>
        <div class='dot_red four-4'></div>
    </div>
    <div id='dice-one-side-five' class='side five'>
        <div class='dot five-1'></div>
        <div class='dot five-2'></div>
        <div class='dot five-3'></div>
        <div class='dot five-4'></div>
        <div class='dot five-5'></div>
    </div>
    <div id='dice-one-side-six' class='side six'>
        <div class='dot six-1'></div>
        <div class='dot six-2'></div>
        <div class='dot six-3'></div>
        <div class='dot six-4'></div>
        <div class='dot six-5'></div>
        <div class='dot six-6'></div>
    </div>
</div>`;
    }

    //find and return div representing given dice
    //@param id (string or Dice) either the div ID of the dice, or Dice itself
    //@return the div, or false if non-existent
    static getDiceDiv(id)
    {
        let dice = id;
        if ('string' === typeof id)
        {
            dice = document.getElementById(id);
        }
        if (dice && dice.div)
        {
            return dice.div;
        }
        return false;
    }

    //find and return given dice
    //@param id (string) ID of the dice
    //@return the dice, or undefined if non-existent
    static getDice(id)
    {
        return _dice[id];
    }

    static purgeDice(id)
    {
        delete _dice[id];
    }

    //find and roll given dice
    //@param id (string or Dice) either the div ID of the dice, or Dice itself
    //@return value of dice, or 0 if non-existent
    static rollDice(id)
    {
        let dice = id;
        if ('string' === typeof id)
        {
            dice = document.getElementById(id);
        }
        if (dice && dice.dice)
        {
            dice.dice.roll();
            return dice.dice.val;
        }
        return 0;
    }

    //find and return alue of given dice
    //@param id (string or Dice) either the div ID of the dice, or Dice itself
    //@return value of dice, or 0 if non-existent
    static valOfDice(id)
    {
        let dice = id;
        if ('string' === typeof id)
        {
            dice = document.getElementById(id);
        }
        if (dice && dice.dice)
        {
            return dice.dice.val;
        }
        return 0;
    }

    //support uniform random roll, or cheat modes
    random()
    {
        if (!this.cheat)
        {
            return Math.floor((Math.random() * 6) + 1);
        }
        if (this.cheat === 'even') //favour even; evens:odds = 2:1
        {
            let i = (Math.random() * 9) | 0; //give 0..8
            if (i < 3) return i * 2 + 1; //0..2 give 1, 3, 5
            return (((i - 3) / 2) | 0) * 2 + 2; //3..8 give 2, 4, 6
        }
        if (this.cheat === 'odd') //favour odd; evens:odds = 1:2
        {
            let i = (Math.random() * 9) | 0; //give 0..8
            if (i < 3) return i * 2 + 2; //0..2 give 2, 4, 6
            return (((i - 3) / 2) | 0) * 2 + 1; //3..8 give 1, 3, 5
        }
        if (this.cheat === '6') //favour 6; others:6 = 5:5
        {
            let i = (Math.random() * 10) | 0; //give 0..9
            if (i < 5) return i + 1; //0..4 give 1..5
            return 6; //5..9 give 6
        }
        if (this.cheat === '1') //favour 1; others:1 = 5:5
        {
            let i = (Math.random() * 10) | 0; //give 0..9
            if (i < 5) return i + 2; //0..4 give 2..6
            return 1; //5..9 give 1
        }
        return 1;
    }
}
