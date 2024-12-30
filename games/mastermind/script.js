const MAX_CHANCES = 8;
let EASY_MODE = false; //show black/white at same slots

var randomColors = []; //Pc random colors
var mySequence = [];

var myColors;
var attempts = 0;
var selected;

let gameInProgress = true;

function riempiArray(){

    /*
        COLORS:

        1 -> red
        2 -> yellow
        3 -> green
        4 -> blue
        5 -> white
        6 -> gray
    */

    for(let i=0; i<4;i++){
        let random = Math.floor(Math.random() * 6+1);
        randomColors[i] = random;
    }

    console.log(randomColors);
}

function numberToColor(number){
    switch (number){
        case 1:
            return "#FF0000";
        case 2:
            return "#FFFF00";
        case 3:
            return "#008000";
        case 4:
            return "#0000FF";
        case 5:
            return "#FFFFFF";
        case 6:
            return "#808080";
        default:
            return null;
    }

}

function colorToNumber(color){
    switch (color){
        case "rgb(255, 0, 0)":
            return 1;
        case "rgb(255, 255, 0)":
            return 2;
        case "rgb(0, 128, 0)":
            return 3;
        case "rgb(0, 0, 255)":
            return 4;
        case "rgb(255, 255, 255)":
            return 5;
        case "rgb(128, 128, 128)":
            return 6;
        default:
            return null;
    }

}

function configure(){
    updateEasyMode();

    console.log(document.getElementById("3").style.width);
    document.getElementById("submit").addEventListener("click",submitButton); //Submit button

    //set-up colors
    riempiArray();
    myColors = document.getElementsByClassName("color-box");

    for(color of myColors){
        color.addEventListener("dragstart",dragStartEvent);
        color.addEventListener("touchstart",touchStartEvent);
    }

    //AGGIUNGO DRAGOVER E DRAGDROP agli slot
    let slots = document.getElementsByClassName("color-item");

    for(slot of slots){
        slot.addEventListener("dragover",dragOverEvent);
        slot.addEventListener("drop",dropEvent);
    }

    //addNewRow();
}

//EVENTS

function dragStartEvent(e) {
    selected = e.target.id;
}

function touchStartEvent(e) {
    selected = e.target.id;
}

function dragOverEvent(e){
    e.preventDefault();
}

function dropEvent(e){
    let newColor = numberToColor(parseInt(selected));

    let slotElement = document.getElementById(e.target.id);
    if (slotElement) slotElement.style.setProperty("background-color", newColor);

    selected = null;
}

//ALERTS

function showAlert(){
    let alertDiv = document.getElementById("alert");

    alertDiv.innerHTML = "MISSING COLORS!";
    alertDiv.style.backgroundColor = "orangered";
    alertDiv.style.display = "flex";
}

function endGame()
{
    gameInProgress = false;
    document.getElementById("submit").innerHTML = 'New Game';

    //show answer
    for (let i = 0; i < 4; ++i)
    {
        let newColor = numberToColor(randomColors[i]);

        let slotElement = document.getElementById(`ans${i+1}`);
        if (slotElement)
        {
            slotElement.style.setProperty("background-color", newColor);
            slotElement.innerHTML = '';
        }
    }
}

function showWin(){
    endGame();
    let alertDiv = document.getElementById("alert");

    alertDiv.innerHTML = "YOU WON!";
    alertDiv.style.backgroundColor = "green";
    alertDiv.style.display = "flex";
}

function showLost(){
    endGame();
    let alertDiv = document.getElementById("alert");

    alertDiv.innerHTML = "YOU LOST!";
    alertDiv.style.backgroundColor = "red";
    alertDiv.style.display = "flex";
}

function hideAlert() {
    let alertDiv = document.getElementById("alert");
    alertDiv.style.display = "none";
}

//GAME CHECK

function checkEmpty(){
    let slots = document.getElementsByClassName("color-item");
    for(slot of slots){
        var slotColor = window.getComputedStyle(slot).getPropertyValue("background-color");
        //console.log(window.getComputedStyle(slot).getPropertyValue("background-color"))

        if(slotColor === "rgb(210, 180, 140)"){
            return true;
        }
    }

    return false;
}

function checkWin(arr1, arr2){
    for(let i=0; i<4; i++){
        if(arr1[i] !== arr2[i]) return false;
    }

    return true;
}

function updateEasyMode(cb)
{
    if (!cb)
        cb = document.getElementById('cbEasy');
    EASY_MODE = cb.checked;
}

function submitButton(e){
    if (checkEmpty()===true){
        showAlert();
        setTimeout(hideAlert, 3000);
        return;
    }

    if (!gameInProgress)
    {
        //start new game
        location.reload();
        return;
    }

    attempts++; //increase attempts

    //Check positions
    mySequence = [colorToNumber(document.getElementById("first").style.backgroundColor),colorToNumber(document.getElementById("second").style.backgroundColor),colorToNumber(document.getElementById("third").style.backgroundColor),colorToNumber(document.getElementById("fourth").style.backgroundColor)];

    //Fill the 4 divs
    var rowsNumber = document.getElementById("table").rows.length;
    let items = document.getElementById("table").getElementsByTagName("tbody")[0].getElementsByTagName("tr")[rowsNumber-1].getElementsByClassName("result-container")[0].getElementsByClassName("result-item");

    //1. Find 'black's i.e. right colour in right location
    const blacks = [],
        whites = [], //actual position
        whitesGuess = []; //guess position
    let i, j,
        cntBlacks = 0,
        cntWhites = 0;
    for (i = 0; i < 4; ++i)
    {
        let isBlack = (randomColors[i] === mySequence[i]);
        blacks[i] = isBlack;
        if (isBlack)
            ++cntBlacks;
    }
    //2. For non-blacks, see if they appear elsewhere
    for (i = 0; i < 4; ++i)
    {
        if (!blacks[i])
        {
            //check if this colour is in other slot
            for (j = 0; j < 4; ++j)
            {
                if (i === j) continue; //not black, so won't be in same slot
                if (!blacks[j] && !whites[j])
                {
                    if (randomColors[j] === mySequence[i])
                    {
                        whites[j] = true;
                        whitesGuess[i] = true;
                        ++cntWhites;
                        break;
                    }
                }
            }
        }
    }
    if (!EASY_MODE)
    {
        for (i = 0; i < cntBlacks; ++i)
        {
            items[i].style.backgroundColor = "black";
        }
        for (j = 0; j < cntWhites; ++j, ++i)
        {
            items[i].style.backgroundColor = "white";
        }
    }
    else
    {
        items[0].parentElement.style['grid-template-columns'] = 'repeat(4, 1fr)';
        for (i = 0; i < 4; ++i)
        {
            if (blacks[i])
                items[i].style.backgroundColor = "black";
            if (whitesGuess[i])
                items[i].style.backgroundColor = "white";
        }
    }

    //Display win
    if(checkWin(mySequence,randomColors)){
        showWin();
        //setTimeout(hideAlert, 3000);
        //setTimeout(function() {location.reload();}, 2000);
        return;
    }

    //Remove event listener from old row
    let slots = document.getElementsByClassName("color-item");
    for(let i = 0; i < (attempts * 4); ++i)
    {
        slots[i].removeAttribute("id");
        slots[i].removeEventListener("dragover",dragOverEvent);
        slots[i].removeEventListener("drop",dropEvent);
    }

    document.getElementById("chances").innerHTML = String(MAX_CHANCES - attempts);

    if (attempts === MAX_CHANCES)
    {
        showLost();
        //setTimeout(hideAlert, 3000);
        //setTimeout(function() {location.reload();}, 2000);
        return;
    }

    addNewRow();
}

function addNewRow()
{
    //Add the new row
    let newRow = document.createElement("tr");
    newRow.classList.add('row-content');

    newRow.innerHTML =
    '<td><div class="color-item" id="first"></div></td>' +
    '<td><div class="color-item" id="second"></div></td>' +
    '<td><div class="color-item" id="third"></div></td>' +
    '<td><div class="color-item" id="fourth"></div></td>' +
    '<td class="result-container">' +
        '<div class="result-box">' +
            '<div class="result-item"></div>' +
            '<div class="result-item"></div>' +
            '<div class="result-item"></div>' +
            '<div class="result-item"></div>' +
        '</div>' +
    '</td>';

    newRow.addEventListener("dragover",dragOverEvent);
    newRow.addEventListener("drop",dropEvent);

    document.getElementById("table").getElementsByTagName("tbody")[0].appendChild(newRow);
}
