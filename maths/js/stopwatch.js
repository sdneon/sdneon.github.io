/*
Adapted from https://github.com/sreya1010/stop-watch
Thanks sreya1010 =)
*/
//Specify whether to append lap times, or show latest on top
const LAP_APPEND = false;

let startTime = null;
let elapsedTime = 0;
let timerInterval = null;
let laps = [];
let started = false;

let timeDisplay, lapTimes;

// Format time as HH:MM:SS.MS (microseconds)
function formatTime(ms) {
  const microseconds = Math.floor(ms % 1000); // Microseconds
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    "." +
    String(microseconds).padStart(3, "0") // Display microseconds with 3 digits
  );
}

function startTimer() {
  started = true;
  startTime = Date.now() - elapsedTime;
  timerInterval = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    timeDisplay.textContent = formatTime(elapsedTime);
  }, 10); // Update every 10ms for microsecond precision
}

function pauseTimer() {
  clearInterval(timerInterval);
}

function resetTimer() {
  clearInterval(timerInterval);
  started = false;
  elapsedTime = 0;
  laps = [];
  timeDisplay.textContent = "00:00:00.000";
  lapTimes.innerHTML = "";
}

function recordLap() {
  if (!started) return;
  laps.push(elapsedTime);
  const lapItem = document.createElement("li");
  lapItem.textContent = `Lap ${laps.length}: ${formatTime(elapsedTime)}`;
  if (LAP_APPEND)
    lapTimes.appendChild(lapItem);
  else
    lapTimes.insertBefore(lapItem, lapTimes.firstChild);
}

function initStopwatch()
{
    // DOM Elements
    timeDisplay = document.getElementById("time-display");
    lapTimes = document.getElementById("lap-times");

    const startBtn = document.getElementById("start-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const resetBtn = document.getElementById("reset-btn");
    const lapBtn = document.getElementById("lap-btn");

    // Event Listeners
    startBtn.addEventListener("click", startTimer);
    pauseBtn.addEventListener("click", pauseTimer);
    resetBtn.addEventListener("click", resetTimer);
    lapBtn.addEventListener("click", recordLap);
}