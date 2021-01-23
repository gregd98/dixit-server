const express = require('express'),
  cors = require('cors'),
  validate = require('validate.js'),
  { gameBySession, gameByCode } = require('../game/maps'),
  Game = require('../game/game'),
  db = require('../db/db'),
  bp = require('../middleware/bodyParser'),
  rules = require('../constraints/joinConstraints'),
  responses = require('../utils/responses'),
  so = require('../utils/socketing'),
  random = require('../utils/random');

const reactDevCors = {
  origin: 'http://localhost:3000',
  credentials: true,
};

const router = express.Router();
router.use(express.text());
router.use(cors(reactDevCors));

const createCode = () => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code = code.concat(String.fromCharCode(random.getRandomInt(26) + 65));
  }
  return code;
};

const deepCopy = (value) => JSON.parse(JSON.stringify(value));

const updateStates = (game, playerList = []) => {
  const { players, code } = game;
  const p = playerList.length === 0 ? players : playerList;
  const nsps = '/player';
  so.getHostNamespace().to(code).emit('state update', game.getGameState(true));
  so.getHostNamespace().to(code).emit('player update', game.getPlayerList());
  so.getPlayerNamespace().to(code).emit('player update', game.getPlayerList());
  p.forEach((player) => {
    const sck = so.getIo().nsps[nsps].connected[`${nsps}#${player.socket}`];
    if (sck) {
      try {
        sck.emit('state update', game.getGameState(false, player.id));
      } catch (error) {
        console.log(`getGameStateError: ${error.message}`);
      }
    }
  });
};

const emitGameDeleted = (gameCode, playerList) => {
  so.getHostNamespace().to(gameCode).emit('game deleted');
  const nsps = '/player';
  playerList.forEach((player) => {
    const sck = so.getIo().nsps[nsps].connected[`${nsps}#${player.socket}`];
    if (sck) {
      sck.emit('game deleted');
    }
  });
};

const getPlayersExcept = (game, playerId) => game.players.filter((player) => player.id !== playerId);

router.get('/editions', (req, res) => {
  responses.rest(res, db.findAllEditions());
});

router.get('/games', (req, res) => {
  const sessionData = gameBySession[req.sessionID];
  if (sessionData) {
    const isHost = sessionData.type === 'host';
    if (isHost || sessionData.game.players.find((player) => player.id === sessionData.playerId)) {
      const playerId = !isHost ? sessionData.playerId : null;
      try {
        const payload = {
          game: sessionData.game.getGameInfo(isHost, playerId),
          state: sessionData.game.getGameState(isHost, playerId),
        };
        responses.rest(res, payload);
      } catch (error) {
        responses.customError(res, 400, error.message);
      }
    } else {
      res.status(200).json({ succeed: true, payload: {} });
    }
  } else {
    res.status(200).json({ succeed: true, payload: {} });
  }
});

router.put('/games', (req, res) => {
  if (gameBySession[req.sessionID]) {
    res.status(400).json({ succeed: false, message: 'This sessionId is already associated with a game.' });
  } else {
    let code = createCode();
    while (gameByCode[code]) {
      code = createCode();
    }
    const game = new Game(code);
    gameBySession[req.sessionID] = { game, type: 'host' };
    gameByCode[game.code] = game;
    responses.rest(res, {
      game: game.getGameInfo(true),
      state: game.getGameState(true),
    });
  }
});

router.delete('/games', (req, res) => {
  const sessionData = gameBySession[req.sessionID];
  if (!sessionData || (sessionData.type !== 'host' && sessionData.playerId !== sessionData.game.admin)) {
    responses.badRequest(res);
  } else {
    const playerList = deepCopy(sessionData.game.players);
    const gameCode = sessionData.game.code;
    const entries = Object.entries(gameBySession).filter(([_, value]) => value.game === sessionData.game);
    entries.forEach(([key, _]) => {
      delete gameBySession[key];
    });
    delete gameByCode[gameCode];
    emitGameDeleted(gameCode, playerList);
    responses.succeed(res);
  }
});

router.put('/player', bp.parseBody(), (req, res) => {
  const { code, name } = req.data;
  if (typeof code !== 'string' || typeof name !== 'string') {
    responses.badRequest(res);
  } else {
    let validation = validate({ code, name }, rules, { fullMessages: false });
    if (validation) {
      responses.inputErrors(res, validation);
    } else {
      const game = gameByCode[code];
      validation = {};
      if (!game) {
        validation.code = ['Invalid code.'];
      } else if (game.isNameTaken(name)) {
        validation.name = ['This name is already in use.'];
      }
      if (Object.values(validation).length > 0) {
        responses.inputErrors(res, validation);
      } else {
        try {
          const playerId = game.addPlayer(name);
          gameBySession[req.sessionID] = { game, type: 'player', playerId };
          so.getHostNamespace().to(game.code).emit('player update', game.getPlayerList());
          so.getPlayerNamespace().to(game.code).emit('player update', game.getPlayerList());
          responses.rest(res, {
            game: game.getGameInfo(false, playerId),
            state: game.getGameState(false, playerId),
          });
        } catch (error) {
          responses.customError(res, 200, error.message);
        }
      }
    }
  }
});

router.put('/games/start', bp.parseBody(), (req, res) => {
  const { editions, cardCount } = req.data;
  const sessionData = gameBySession[req.sessionID];
  if (sessionData && sessionData.type === 'host' && typeof cardCount === 'number' && cardCount > 0) {
    const { players } = sessionData.game;
    if (editions.length > 0) {
      if (players.length >= 2) {
        try {
          sessionData.game.startGame(db.findCardsByEdition(editions), cardCount);
          updateStates(sessionData.game);
          responses.succeed(res);
        } catch (error) {
          console.log(`Start error: ${error.message}`);
          responses.customError(res, 500, error.message);
        }
      } else {
        responses.customError(res, 400, 'Invalid player count.');
      }
    } else {
      responses.customError(res, 400, 'You must pick least one edition.');
    }
  } else {
    responses.badRequest(res);
  }
});

router.put('/games/pick', bp.parseBody(), (req, res) => {
  const { pickedCard } = req.data;
  const sessionData = gameBySession[req.sessionID];
  if (sessionData && sessionData.type === 'player' && Number.isInteger(pickedCard)) {
    try {
      sessionData.game.pickCard(pickedCard, sessionData.playerId);
      updateStates(sessionData.game, getPlayersExcept(sessionData.game, sessionData.playerId));
      responses.rest(res, sessionData.game.getGameState(false, sessionData.playerId));
    } catch (error) {
      console.log(`Pick error: ${error.message}`);
      responses.customError(res, 400, error.message);
    }
  } else {
    responses.badRequest(res);
  }
});

router.put('/games/vote', bp.parseBody(), (req, res) => {
  const { vote } = req.data;
  const sessionData = gameBySession[req.sessionID];
  const succeed = () => {
    updateStates(sessionData.game, getPlayersExcept(sessionData.game, sessionData.playerId));
    responses.rest(res, sessionData.game.getGameState(false, sessionData.playerId));
  };
  if (sessionData && sessionData.type === 'player') {
    try {
      if (Number.isInteger(vote)) {
        sessionData.game.vote(sessionData.playerId, vote);
        succeed();
      } else if (vote === 'done') {
        sessionData.game.voteDone(sessionData.playerId);
        succeed();
      } else {
        responses.badRequest(res);
      }
    } catch (error) {
      console.log(`Vote error: ${error.message}`);
      responses.customError(res, 400, error.message);
    }
  } else {
    responses.badRequest(res);
  }
});

router.put('/games/next', (req, res) => {
  const sessionData = gameBySession[req.sessionID];
  if (sessionData && sessionData.type === 'player' && sessionData.game.getPlayerList()
    .find((player) => player.id === sessionData.playerId && player.isAdmin)) {
    try {
      sessionData.game.setNextRound();
      updateStates(sessionData.game, getPlayersExcept(sessionData.game, sessionData.playerId));
      responses.rest(res, sessionData.game.getGameState(false, sessionData.playerId));
    } catch (error) {
      console.log('NextRound error.');
      responses.customError(res, 400, error.message);
    }
  } else {
    responses.badRequest(res);
  }
});

router.put('/games/kick', bp.parseBody(), (req, res) => {
  const sessionData = gameBySession[req.sessionID];
  if (!sessionData) {
    responses.badRequest(res);
  } else {
    const isHost = sessionData.type === 'host';
    const playerId = isHost ? req.data.playerId : sessionData.playerId;
    if ((isHost && typeof playerId === 'string') || (!isHost && playerId)) {
      try {
        const playerList = JSON.parse(JSON.stringify(sessionData.game.players));
        sessionData.game.kickPlayer(playerId);
        const entry = Object.entries(gameBySession)
          .find((e) => e[1].playerId === playerId);
        if (!entry[0]) {
          responses.badRequest(res);
        } else {
          delete gameBySession[entry[0]];
          updateStates(sessionData.game, playerList);
          responses.succeed(res);
        }
      } catch (error) {
        console.log(`Kick error: ${error.message}`);
        responses.badRequest(res);
      }
    } else {
      responses.badRequest(res);
    }
  }
});

router.put('/games/admin', bp.parseBody(), (req, res) => {
  const sessionData = gameBySession[req.sessionID];
  const { playerId } = req.data;
  if (!sessionData || sessionData.type !== 'host' || typeof playerId !== 'string') {
    responses.badRequest(res);
  } else {
    try {
      sessionData.game.setAdmin(playerId);
      updateStates(sessionData.game);
      responses.succeed(res);
    } catch (error) {
      console.log(`setAdmin error: ${error.message}`);
      responses.customError(res, 400, error.message);
    }
  }
});

router.put('/games/reset', (req, res) => {
  const sessionData = gameBySession[req.sessionID];
  if (!sessionData || sessionData.game.admin !== sessionData.playerId) {
    responses.badRequest(res);
  } else {
    try {
      sessionData.game.resetGame();
      updateStates(sessionData.game, getPlayersExcept(sessionData.game, sessionData.playerId));
      responses.rest(res, sessionData.game.getGameState(false, sessionData.playerId));
    } catch (error) {
      console.log(`Reset error: ${error.message}`);
      responses.customError(res, 400, `Reset error: ${error.message}`);
    }
  }
});

module.exports = router;
