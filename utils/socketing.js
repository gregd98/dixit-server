const socketIo = require('socket.io');

let instance = null;
class Socket {
  constructor(server) {
    this.io = socketIo(server);
    this.hostNamespace = this.io.of('/host');
    this.playerNamespace = this.io.of('/player');
  }

  getIo() {
    return this.io;
  }

  getHostNamespace() {
    return this.hostNamespace;
  }

  getPlayerNamespace() {
    return this.playerNamespace;
  }
}

exports.initialize = (server) => {
  instance = new Socket(server);
  return instance.getIo();
};

exports.getIo = () => {
  if (instance !== null) {
    return instance.getIo();
  }
  return undefined;
};

exports.getHostNamespace = () => {
  if (instance !== null) {
    return instance.getHostNamespace();
  }
  return undefined;
};

exports.getPlayerNamespace = () => {
  if (instance !== null) {
    return instance.getPlayerNamespace();
  }
  return undefined;
};
