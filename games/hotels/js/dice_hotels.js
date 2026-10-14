//Custom dice for Hotels building permission with these faces:
//  1: 2x Price, 2: Denied, 3-5: Approved, 6: Free
class HotelsDice extends Dice {
    /*
    Spawn a dice for given div, with optional rollOnClick and clickHandler.
    */
    constructor(id, rollOnClick, clickHandler)
    {
        super(id, rollOnClick, clickHandler);
    }

    //generate the HTML for a dice. Requires dice.css
    static html(id)
    {
        return `<div id='${id}' class='dice' onclick='onDiceClicked("${id}");'>
    <div id='dice-one-side-one' class='side one'>
        <div class='dot_none'>2x</div>
    </div>
    <div id='dice-one-side-two' class='side two'>
        <div class='dot_big'></div>
    </div>
    <div id='dice-one-side-three' class='side three'>
        <div class='dot_big_red'></div>
    </div>
    <div id='dice-one-side-four' class='side four'>
        <div class='dot_big'></div>
    </div>
    <div id='dice-one-side-five' class='side five'>
        <div class='dot_big'></div>
    </div>
    <div id='dice-one-side-six' class='side six'>
        <div class='dot_none'>H</div>
    </div>
</div>`;
    }
}
