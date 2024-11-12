// GAME CONSTANTS
const ws = new WebSocket('ws://localhost:8080');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const stats = document.getElementById('stats');

// GAME VARIABLES
let lastPingTime = 0;
let pingHistory = [];

let playerId = null;
let gameId = null;
let choice = null;
let clashChoices = [null, null];
let hp = [7, 7];
let lastClash = null;

// GAME STATE BOOLS
let gameWinner = null;
let opponentDisconnected = false;
let opponentLocked = false;

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // LISTENERS
    switch (data.type) {
        case 'clash':
            // PING
            const now = Date.now();
            const roundTrip = now - data.timestamp;
            updatePingStats(roundTrip);

            /* NOTE: server time could be better here
            lastClash = data.timestamp;*/
            lastClash = performance.now();
            opponentLocked = false;
            choice = null;

            // Update display
            hp = data.state.health;
            clashChoices = data.state.choices;
            break;

        case 'opponent_locked':
            if (!lastClash)
                lastClash = performance.now();
            opponentLocked = true;
            break;

        case 'waiting':
            ctx.fillText('Waiting for opponent...', 150, 150);
            break;

        case 'game_start':
            playerId = data.player;
            gameId = data.gameId;

            window.requestAnimationFrame(drawGame);
            break;

        case 'game_end':
            gameWinner = data.winner;
            break;

        case 'opponent_disconnected':
            opponentDisconnected = true;
            break;
    }
};

function updatePingStats(roundTrip) {
    pingHistory.push(roundTrip);
    if (pingHistory.length > 10) pingHistory.shift();

    // Calculate average ping
    const avgPing = Math.round(
        pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length
    );

    stats.innerHTML = `Ping: ${avgPing} ms<br>`;
}

// RENDERING
const radius = 280; // pixels
const clashTime = 2000; // ms
const displayTime = 1000; // ms

const hpmovetime = 300; // ms
const hpmax = 7;
const hpwidth = 310; // px

const p1 = new Image(512, 512);
p1.src = 'assets/ninja_512.png';
const p2 = new Image(512, 512);
p2.src = 'assets/mage_512.png';

const scissors = new Image(512, 512);
scissors.src = 'assets/scissors_512.png';
const paper = new Image(512, 512);
paper.src = 'assets/paper_rolled_512.png';
const rock = new Image(512, 512);
rock.src = 'assets/rock_512.png';

const check = new Image(512, 512);
check.src = 'assets/check_512.png';
function drawGame(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (opponentDisconnected) {
        ctx.fillText('Opponent disconnected.', 150, 150);
        return;
    }
    if (gameWinner) {
        ctx.fillText(gameWinner, 150, 150);
        return;
    }

    // INDICATOR CIRCLE
    ctx.beginPath();
    ctx.arc(400, 225, radius, 0, 2 * Math.PI);
    ctx.stroke();

    if (lastClash && timestamp - lastClash > displayTime) {
        ctx.beginPath();
        const indicatorradius = Math.max((timestamp - lastClash - displayTime) / clashTime * radius, 0);
        ctx.arc(400, 225, indicatorradius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // HEALTHBARS
    const offset1 = (1 - hp[0] / hpmax) * hpwidth;
    ctx.fillStyle = 'orange';
    ctx.fillRect(50, 40, hpwidth - offset1, 25);
    ctx.fillStyle = 'black';
    ctx.strokeRect(53, 43, hpwidth, 25);

    const offset2 = (1 - hp[1] / hpmax) * hpwidth;
    ctx.fillStyle = 'orange';
    ctx.fillRect(430 + offset2, 40, hpwidth - offset2, 25);
    ctx.fillStyle = 'black';
    ctx.strokeRect(427, 43, hpwidth, 25);

    // PLAYERS
    ctx.drawImage(p1, 60, 165, 120, 120);
    ctx.drawImage(p2, 620, 165, 120, 120);

    let choiceImage = null;
    switch (choice) {
        case 'rock': choiceImage = rock; break;
        case 'paper': choiceImage = paper; break;
        case 'scissors': choiceImage = scissors; break;
    }

    let opponentImage = null;
    if (timestamp - lastClash <= displayTime) {
        switch (playerId == 0 ? clashChoices[0] : clashChoices[1]) {
            case 'rock': choiceImage = rock; break;
            case 'paper': choiceImage = paper; break;
            case 'scissors': choiceImage = scissors; break;
        }
        switch (playerId == 0 ? clashChoices[1] : clashChoices[0]) {
            case 'rock': opponentImage = rock; break;
            case 'paper': opponentImage = paper; break;
            case 'scissors': opponentImage = scissors; break;
        }
    } else if (opponentLocked) opponentImage = check;

    if (playerId == 0) {
        if (choiceImage) ctx.drawImage(choiceImage, 200, 165, 120, 120);
        if (opponentImage) ctx.drawImage(opponentImage, 480, 165, 120, 120);
    } else if (playerId == 1) {
        if (choiceImage) ctx.drawImage(choiceImage, 480, 165, 120, 120);
        if (opponentImage) ctx.drawImage(opponentImage, 200, 165, 120, 120);
    }

    window.requestAnimationFrame(drawGame);
}

// INPUT
document.addEventListener('keydown', (e) => {
    if (playerId === null) return;

    const lockIn = {
        type: 'lock-in',
        player: playerId,
        gameId,
        timestamp: Date.now()
    };

    if (!choice) {
        switch (e.key) {
            case 'q':
                choice = 'rock';
                locked = true;
                break;
            case 'w':
                choice = 'paper';
                locked = true;
                break;
            case 'e':
                choice = 'scissors';
                locked = true;
                break;
        }
    
        if (choice) {
            if (!lastClash)
                lastClash = performance.now();
            lockIn.choice = choice;
            ws.send(JSON.stringify(lockIn));
        }
    }
});