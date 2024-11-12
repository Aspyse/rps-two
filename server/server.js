// server.js
// SERVE CLIENT
import express from 'express';
import path from 'path';

const app = express();
app.use(express.static(path.join(import.meta.dirname, '../client')));
app.get('/', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, '../client', 'index.html'));
});

const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// WEBSOCKET

import { WebSocketServer } from 'ws';
const server = new WebSocketServer({ port: 8080 });

let waitingPlayer = null;
const games = new Map();

const clashTime = 3000;
// idk if this is best practice
const matchupChart = new Map([
  ['rockrock', 0],
  ['rockpaper', -1],
  ['rockscissors', 1],
  ['paperrock', 1],
  ['paperpaper', 0],
  ['paperscissors', -1],
  ['scissorsrock', -1],
  ['scissorspaper', 1],
  ['scissorsscissors', 0]
]);
server.on('connection', (socket) => {
  // WAITING
  // TODO: create and join games using code
  if (waitingPlayer) {
    const game = {
      id: Math.random().toString(36).substring(7),
      players: [waitingPlayer, socket],
      state: {
        health: [7, 7],
        choices: [null, null]
      },
      clashInterval: null
    };

    // GAME START
    games.set(game.id, game);

    waitingPlayer.send(JSON.stringify({
      type: 'game_start',
      player: 0,
      gameId: game.id,
      timestamp: Date.now()
    }));
    socket.send(JSON.stringify({
      type: 'game_start',
      player: 1,
      gameId: game.id,
      timestamp: Date.now()
    }));

    waitingPlayer = null;
  } else {
    waitingPlayer = socket;
    socket.send(JSON.stringify({
      type: 'waiting',
      timestamp: Date.now()
    }));
  }

  // LISTENERS
  // PLAYER MESSAGE (i.e. input)
  socket.on('message', (message) => {
    const data = JSON.parse(message);
    const game = games.get(data.gameId);

    if (game) {
      const otherPlayer = game.players[data.player === 0 ? 1 : 0];
      game.state.choices[data.player] = data.choice;

      if (!game.state.choices[0] != !game.state.choices[1]) { // only one locked in
        otherPlayer.send(JSON.stringify({
          type: 'opponent_locked',
          timestamp: Date.now()
        }));

        if (!game.clashInterval) {
          game.clashInterval = setInterval(() => {
            handleClash(game);
          }, clashTime);
        }
      } else {
        clearInterval(game.clashInterval);
        handleClash(game);
        game.clashInterval = setInterval(() => {
          handleClash(game);
        }, clashTime);
      }
    }
  });

  // DISCONNECT
  socket.on('close', () => {
    if (socket === waitingPlayer) {
      waitingPlayer = null;
    }
    games.forEach((game, gameId) => {
      const playerIndex = game.players.indexOf(socket);
      if (playerIndex !== -1) {
        const otherPlayer = game.players[playerIndex === 0 ? 1 : 0];
        otherPlayer.send(JSON.stringify({
          type: 'opponent_disconnected',
          timestamp: Date.now()
        }));
        clearTimeout(game.clashInterval);
        games.delete(gameId);
      }
    });
  });
});

// HELPERS
function handleClash(game) {
  if (!game.state.choices[0]) {
    game.state.health[0] -= 1;
  }
  if (!game.state.choices[1]) {
    game.state.health[1] -= 1;
  }
  if (game.state.choices[0] && game.state.choices[1]) {
    const outcome = matchupChart.get(game.state.choices.join(''));
    switch (outcome) {
      case -1: game.state.health[0] -= 1; break;
      case 1: game.state.health[1] -= 1; break;
    }
  }

  // WIN CONDITION
  if (game.state.health[0] <= 0 && game.state.health[1] <= 0) {
    endGame(game, 'tie');
  } else if (game.state.health[0] <= 0) {
    endGame(game, 'player 2 wins');
  } else if (game.state.health[1] <= 0) {
    endGame(game, 'player 1 wins');
  } else { // NO WINS, NEXT CLASH
    server.clients.forEach((socket) => {
      const clash = {
        type: 'clash',
        state: game.state,
        timestamp: Date.now()
      };
      socket.send(JSON.stringify(clash));
    });
    game.state.choices = [null, null];
  }
}

function endGame(game, winner) {
  server.clients.forEach((socket) => {
    const gameEnd = {
      type: 'game_end',
      state: game.state,
      winner: winner,
      timestamp: Date.now()
    };
    socket.send(JSON.stringify(gameEnd));
  });
  clearInterval(game.clashInterval);
  games.forEach((gameIter, gameId) => {
    if (gameId === game.id) {
      games.delete(gameId);
    }
  });
}