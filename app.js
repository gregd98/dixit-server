const express = require('express'),
  http = require('http'),
  session = require('express-session'),
  path = require('path'),
  so = require('./utils/socketing'),
  apiRoutes = require('./routes/api'),
  { gameBySession } = require('./game/maps');

const PORT = 80;
const app = express();
const server = http.createServer(app);
so.initialize(server);
const hostNamespace = so.getHostNamespace();
const playerNamespace = so.getPlayerNamespace();

app.use(session({
  secret: 'super secret',
  cookie: { maxAge: 43200000 },
  resave: false,
  saveUninitialized: true,
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/*', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, './public', 'index.html'));
});

const getSid = (cookies) => {
  let sid = cookies.find((item) => item.trim().search('connect.sid=') === 0);
  if (sid) {
    [sid] = sid.split('=')[1].split('.');
    if (sid.length > 4) {
      return sid.substr(4);
    }
  }
  throw Error('sessionID not found.');
};

hostNamespace.use((socket, next) => {
  const cookies = socket.request.headers.cookie.split(';');
  try {
    const sid = getSid(cookies);
    const sessionData = gameBySession[sid];
    if (sessionData && sessionData.type === 'host') {
      next();
    } else {
      next(Error('HM - Error: Invalid sessionID.'));
    }
  } catch (error) {
    next(error);
  }
});

hostNamespace.on('connection', (socket) => {
  const cookies = socket.request.headers.cookie.split(';');
  try {
    const sid = getSid(cookies);
    const sessionData = gameBySession[sid];
    if (sessionData && sessionData.game.code) {
      socket.join(sessionData.game.code);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
});

playerNamespace.use((socket, next) => {
  try {
    const cookies = socket.request.headers.cookie.split(';');
    const sid = getSid(cookies);
    const sessionData = gameBySession[sid];
    if (sessionData && sessionData.type === 'player') {
      next();
    } else {
      next(Error('PM - Error: Invalid sessionID.'));
    }
  } catch (error) {
    console.log(error.message);
    next(error);
  }
});

playerNamespace.on('connection', (socket) => {
  try {
    const cookies = socket.request.headers.cookie.split(';');
    const sid = getSid(cookies);
    const sessionData = gameBySession[sid];
    if (sessionData && sessionData.game.code) {
      socket.join(sessionData.game.code);
      sessionData.game.setPlayerSocket(sessionData.playerId, socket.client.id);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
});

server.listen(PORT, () => { console.log(`Server listening on port ${PORT}.`); });
