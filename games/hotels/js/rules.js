//Rules of Hotels, as shown by the Show Rules button (showRules() in hotels.js)
const RULES = `
<div id='divRules'>
(Courtesy of / recorded by <a href='https://hotelboardgame.com/the-game/rules' target="_blank">Hotel Fan Page</a>; with <b>my recommendations</b> for better gameplay)
<br>Ages 8 and Up. For 2-4 players<br>
<h3>Objective of the Game</h3>
Become a rich Hotel Tycoon! Build hotels, welcome guests on them and hope they stay so long that they go broke paying their bills!<br>
<div class="mw-parser-output"><div id="toc" class="toc" role="navigation" aria-labelledby="mw-toc-heading"><input type="checkbox" role="button" id="toctogglecheckbox" class="toctogglecheckbox" style="display:none" aria-pressed='true'><div class="toctitle" lang="en" dir="ltr"><h2 id="mw-toc-heading">Contents</h2><span class="toctogglespan"><label class="toctogglelabel" for="toctogglecheckbox"></label></span></div>
<ul>
<li class="toclevel-1 tocsection-1"><a href="#Set_up"><span class="tocnumber">1</span> <span class="toctext">Set up</span></a></li>
<ul>
<li class="toclevel-2 tocsection-1"><a href="#Webpage_Play"><span class="tocnumber">1.1</span> <span class="toctext">Webpage Play</span></a></li>
<li class="toclevel-2 tocsection-2"><a href="#Partial_AI"><span class="tocnumber">1.2</span> <span class="toctext">Computer Players</span></a></li>
</ul>
<li class="toclevel-1 tocsection-2"><a href="#Gameplay"><span class="tocnumber">2</span> <span class="toctext">Gameplay</span></a>
<ul>
<li class="toclevel-2 tocsection-3"><a href="#Rules_In_Brief"><span class="tocnumber">2.1</span> <span class="toctext">Rules In Brief   </span></a></li>
<li class="toclevel-2 tocsection-4"><a href="#On_Your_Turn"><span class="tocnumber">2.2</span> <span class="toctext">On Your Turn</span></a>
<li class="toclevel-2 tocsection-5"><a href="#Rolling_A_6"><span class="tocnumber">2.3</span> <span class="toctext">Rolling a "6"</span></a></li>
<li class="toclevel-2 tocsection-6"><a href="#Buying_Space"><span class="tocnumber">2.4</span> <span class="toctext">"Buying" Land</span></a></li>
<li class="toclevel-2 tocsection-7"><a href="#Planning_Permission_Space"><span class="tocnumber">2.5</span> <span class="toctext">"Planning Permission" Space a.k.a "Build" Space</span></a></li>
<li class="toclevel-2 tocsection-8"><a href="#Passing_Bank"><span class="tocnumber">2.6</span> <span class="toctext">Passing By the Bank</span></a></li>
<li class="toclevel-2 tocsection-9"><a href="#Passing_Cityhall"><span class="tocnumber">2.7</span> <span class="toctext">Passing By Cityhall - Adding Entrances</span></a></li>
<li class="toclevel-2 tocsection-10"><a href="#Free_Entrance_Space"><span class="tocnumber">2.8</span> <span class="toctext">"Free Entrance" Space</span></a></li>
<li class="toclevel-2 tocsection-11"><a href="#Build_One_Phase_Free"><span class="tocnumber">2.9</span> <span class="toctext">"Build One Phase Free" Space</span></a></li>
<li class="toclevel-2 tocsection-12"><a href="#Leisure_Facilities"><span class="tocnumber">2.10</span> <span class="toctext">Leisure Facilities</span></a></li>
<li class="toclevel-2 tocsection-13"><a href="#Welcome"><span class="tocnumber">2.11</span> <span class="toctext">Welcome Your Guests</span></a></li>
<li class="toclevel-2 tocsection-14"><a href="#Auctions"><span class="tocnumber">2.12</span> <span class="toctext">Auctions</span></a></li>
<li class="toclevel-2 tocsection-15"><a href="#Eyes_Open"><span class="tocnumber">2.13</span> <span class="toctext">Keep Your Eyes Open!</span></a></li>
<li class="toclevel-2 tocsection-16"><a href="#Bankruptcy"><span class="tocnumber">2.14</span> <span class="toctext">Bankruptcy</span></a></li>
<li class="toclevel-2 tocsection-17"><a href="#The_Winner"><span class="tocnumber">2.15</span> <span class="toctext">The Winner</span></a></li>
</ul>
</li>
</ul>
</li>
</ul>
</div>
<h2><span class="mw-headline" id="Set_up">Set up</span></h2>
<ol><li>Place the Bank and Town Hall on their spaces on the board, and the hotels by the side of the game, together with the leisure facilities, entrances and Title Deeds.</li>
<li>Choose one player to be the banker. That player will look after the money and the Title Deeds. He gives $12,000 in banknotes to each player as follows:</li>
    <ul>
        <li>1x $5,000</li>
        <li>5x $1,000</li>
        <li>3x $500</li>
        <li>4x $100</li>
        <li>2x $50</li>
    </ul>
<li>Each player chooses a car and places it on the "car park" starting space.</li>
<li>Decide who will start, play continues clockwise.</li>
</ol>
<h3><span class="mw-headline" id="Webpage_Play">Webpage Play</span></h3>
<p>When using Neon's Hotels webpage to play, most setup is automatically done.
</p>
<ol>
<li>Go to the bottom of the page to select players. You may still add/remove players after the game is started.</li>
<li>Refresh the page to start a new game. You will be offered the chance to either restore a saved game if available (click the corresponding 'Yes' button), or start a new game (click 'No'). The 'New Game' button starts afresh at once.</li>
<li>Click the glowing die (or the button) to throw. Your car then drives itself. Click the 'Find Me!' button to scroll your player token into view.</li>
<li>The Bank's money for passing it, and payment for hotel stays, are settled for you. Your choices (Buy, planning permission, entrances, leisure facilities) appear as buttons at the top of the page. For a new entrance, click a glowing spot on the map.</li>
<li>The top right shows the current player's cash and title deeds. Click a deed, or a hotel's name on the map, to see its Title Deed.</li>
<li>Click 'End turn' (or the 'Next Player' button) to save the game and pass the turn to the next player.</li>
</ol>
<h3><span class="mw-headline" id="Partial_AI">Computer Players</span></h3>
<p>To play against Computer Players, tick 'AI' for them in the Players table at the bottom of the page, and choose 'Friendly' or 'Aggressive'. They throw, drive, buy, build and bid by themselves.
</p>
<h2><span class="mw-headline" id="Gameplay">Gameplay</span></h2>
<h3><span class="mw-headline" id="Rules_In_Brief">Rules In Brief</span></h3>
<p>The order of developing a hotel is as follows:</p>
<ol>
    <li>Buy the land</li>
    <li>Get planning permission (using special die)</li>
    <li>Put up the main building</li>
    <li>Add entrances and start making other players pay their stays</li>
    <li>Keep adding buildings and entrances to make stays more expensive</li>
    <li>Build the leisure facilities</li>
    <li>In the meantime, invest in more land, more buildings, more entrances</li>
</ol>
<h3><span class="mw-headline" id="On_Your_Turn">On Your Turn</span></h3>
<p>Roll the standard die and move forward that number of spaces. Cars may not share spaces. If you land on an opponent's car, move ahead to the next free space.</p>
<h3><span class="mw-headline" id="Rolling_A_6">Rolling a "6"</span></h3>
<p>In this event, you have another turn after completing any transactions applicable, including paying for any nights’ accommodation.</p>
<h3><span class="mw-headline" id="Buying_Space">"Buying" Land</span></h3>
When you land on a buying space you may, if you wish, buy the land adjacent to ONE of the sides of that space.
<ul>
    <li><b>Unowned land</b>:
        <ol>
            <li>Ask the Banker if you may see the Title Deed.</li>
            <li>If you decide on you can afford it, pay the "Cost of the Land" to the Bank and keep the Deed.</li>
            <li>You may only buy one Title Deed per turn and may only start building on that land on your next turn.</li>
            <li><i><b>Webpage play</b></i>: you may buy the land on both sides of the space on the same turn, if you can pay for both.</li>
        </ol>
    </li>
    <li><b>Owned land</b>:
        <ul>
            <li>If the land you wish to buy is owned by an opponent, but no buildings are on it, you may buy it by paying the "Compulsory purchase price" shown on the Title Deed (which is half the normal price). The owner's consent is not needed. You take possession of its Title Deed.</li>
            <li><i><b>Recommend</b></i>: For friendlier play, buy at original listed price, instead of half-price.</li>
        </ul>
    </li>
</ul>
<h3><span class="mw-headline" id="Planning_Permission_Space">"Planning Permission" Space a.k.a "Build" Space</span></h3>
<p>When you land on one of these spaces ANYWHERE ON THE GAME BOARD and you own at least one Title Deed, you can apply for planning permission to start building on ONE of your pieces of land properties (adding buildings will increase your property value).</p>
<ol>
    <li>First, declare your plan: announce what and where you want to build. If you can afford it, you may want to build more than one building on the same plot of land on that turn.
        <br><br><i><b>Recommend</b></i>: For more fun & mayhem, go big or go home! Allow applying to build <b>any number</b> of buildings and leisure facilities!
        <ul>
        <li>If you roll "Free", get everything you asked for built free of charge =D</li>
        <li>If you roll "Double", you'll be in for a huge hit!</li>
        <li>If you need to pay, make sure to pay in <b>FULL</b>. Sell/auction assets to raise funds if needed. Failing which, declare bankrupt and retire!</li>
        </ul>
    </li>
    <li>Each building must be built in the sequence shown on your Title Deed. For example, you must buy the main building before you can buy extension number 1.</li>
    <li>Get permission to build: roll the multicolored die:
        <ul>
            <li>[<span style='color:red'>&#x2B24</span>] RED: Permission denied. Wait until you land on another Build Space to roll again.</li>
            <li>[<span style='color:green'>&#x2B24</span>] GREEN: Permission granted. Pay the Bank the amounts shown on your Title Deed for the appropriate buildings and put them on your gameboard property.</li>
            <li>[H] H: you can build free of charge!</li>
            <li>[2] 2: bad luck! Pay the Bank double the cost shown on the Title Deed.</li>
        </ul>
    </li>
    <li>Note: You MUST build if planning permission is granted, even if you have to raise extra money to do so (see "AUCTIONS").</li>
    <li><i><b>Webpage play</b></i>: after building, you may apply again on the same turn, for the same hotel or another: a building at a time if you like. A hotel that is denied permission is out until you land on another Build Space.</li>
</ol>
<h3><span class="mw-headline" id="Passing_Bank">Passing By the Bank</span></h3>
<p>Each time you pass the line near the Bank, you ask the Banker for 2000. If in a 3 or 4 player game the number of players gets down to 2, those remaining 2 players will no longer receive 2000 as they pass by the Bank.</p>
<h3><span class="mw-headline" id="Passing_Cityhall">Passing By Cityhall - Adding Entrances</span></h3>
<p>Entrances will allow you to start charging passing customers (other players) to stay at your hotel.
Whenever you pass the line next to City Hall, you are entitled to buy one entrance for EACH of your hotels, providing that the main building in each case has already been put up and you have still spaces to put them on.
Pay the cost to the Bank for each entrance as shown on the Title Deed and place them on any space that borders your land.
No two entrances, (whether yours or belonging to an opponent), may be placed facing each other on the same space.
If the hotel located on the opposite side of one of your spaces is owned by a different player, steal it by placing an entrance on it. </p>
<h3><span class="mw-headline" id="Free_Entrance_Space">"Free Entrance" Space</span></h3>
<p>When you land here, add one entrance to one of your hotels providing that the main building has already been put up. This is in addition to entrances you may have added by passing by the Town Hall.
If you have no more free spaces to put an entrance, then you cannot build it for free. </p>
<h3><span class="mw-headline" id="Build_One_Phase_Free">"Build One Phase Free" Space</span></h3>
<p>When you land here, you may put up the main building on a vacant site that you own or add one building or leisure facility to one of your hotels under construction.</p>
<h3><span class="mw-headline" id="Leisure_Facilities">Leisure Facilities</span></h3>
<p>When you have completely finished building a hotel, you may add its facilities on any subsequent turn. You do not need planning permission, simply pay the price to the Banker and install your facilities.
If you have several completed hotels and enough money to do so, you can buy multiple leisure facilities on the same turn. </p>
<h3><span class="mw-headline" id="Welcome">Welcome Your Guests</span></h3>
<p>
When an opponent player lands on a space of your hotels with an entrance, you will start gaining money. The player must throw the standard die to decide how many nights it will be the stay and depending on the number, must pay in accordance with the star rating your hotel has earned, as shown in the Title Deed.
<br><br>Example:
Someone lands on a space carrying an entrance to the Royal, which you own. You have built the main building and two extensions and have therefore qualified for a three-star rating. Your opponent throws a 4, so 4 nights at the three-star Royal will cost him 1400.
<br><br>
The visitor can then carry out the action on the game board space (if they wish), and move on as normal on their next turn.
</p>
<h3><span class="mw-headline" id="Auctions">Auctions</span></h3>
<p>If you find you cannot pay for a hotel stay or for other hotel purchases, you must sell one or more of your hotels to the highest bidder.
<br><br>If you have buildings, leisure facilities and/or entrances in place, you must sell the ENTIRE hotel as ONE LOT. You cannot sell off parts of a hotel. There is no minimum price and all players still in the game may bid.
<br><br>With the money you raise, immediately pay off as much of your debt as you can, even if it bankrupts you and puts you out of the game.
<br><br>If you receive planning permission and find that you cannot afford it, and you decide to auction off that site, you do not, on selling it, have to pay for the planning permission. The player who buys the site may then apply for permission on his own behalf when the opportunity arises. If you sell off a different site, however, to finance the new buildings, you must, of course, pay for the planning permission.
<br><br>If nobody bids on your hotel, the hotel is knocked down, the building(s) removed and the Title Deed becomes available again.
</p>
<h3><span class="mw-headline" id="Eyes_Open"></span>Keep Your Eyes Open!</h3>
<p>It is up to you to keep your eyes open and claim payment when someone arrives at an entrance to your hotel. Similarly, you must claim $2,000 from the Bank when you pass it, and the right to build entrance when you pass the Town Hall.
If the next player throws the die before your request, you lose the right to do so. </p>
<h3><span class="mw-headline" id="">Bankruptcy</span></h3>
<p>If you have no money, no hotels and no land left, you are out of the game!</p>
<h3><span class="mw-headline" id="The_Winner">The Winner</span></h3>
<p>If you’re the last player left in the game, you win!</p>
</div>`;
