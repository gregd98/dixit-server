const nanoid = require('nanoid');
const network = require('../utils/network');

const shuffle = (array) => {
  const result = array;
  for (let i = result.length; i > 0; i -= 1) {
    const r = Math.floor(Math.random() * i);
    const tmp = result[i - 1];
    result[i - 1] = result[r];
    result[r] = tmp;
  }
  return result;
};

class Game {
  constructor(code) {
    this.ip = network.getIp();
    this.code = code;
    this.isStarted = false;
    this.isOver = false;
    this.players = [];
    this.admin = undefined;
    this.currentRound = 0;
    this.rounds = [];
    this.currentState = 0;
    this.currentPlayer = 0;
    this.cardCount = 0;
    this.roundCount = 0;
    this.deck = [];
    this.scores = [];
  }

  addPlayer(name) {
    if (!this.isStarted) {
      if (this.players.length < 12) {
        if (!this.isNameTaken(name)) {
          const id = nanoid.nanoid();
          this.players.push({
            id, name, hand: [], score: { total: 0, lastRound: 0 },
          });
          if (this.players.length === 1) {
            this.admin = id;
          }
          return id;
        }
        throw Error('Name is already in use');
      }
      throw Error('Maximum player count is reached.');
    }
    throw Error('Game is already started');
  }

  kickPlayer(playerId) {
    if (this.isStarted) {
      throw Error('Game is already started.');
    } else {
      const index = this.players.findIndex((player) => player.id === playerId);
      if (index === -1) {
        throw Error('Player is not exists.');
      } else {
        if (this.players[index].id === this.admin && this.players.length > 1) {
          this.admin = this.players.find((player) => player.id !== this.admin).id;
        }
        this.players.splice(index, 1);
      }
    }
  }

  setAdmin(playerId) {
    if (this.isStarted) {
      throw Error('Game is already started.');
    } else {
      const index = this.players.findIndex((player) => player.id === playerId);
      if (index === -1) {
        throw Error('Player is not exists.');
      } else {
        this.admin = playerId;
      }
    }
  }

  getPlayerList() {
    return this.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      isAdmin: player.id === this.admin,
    }));
  }

  setPlayerSocket(playerId, socket) {
    const index = this.players.findIndex((player) => player.id === playerId);
    if (index !== -1) {
      this.players[index].socket = socket;
    } else {
      throw Error('Invalid playerId.');
    }
  }

  isNameTaken(name) {
    return !!this.players.find((player) => player.name === name);
  }

  setDeck(deck) {
    this.deck = shuffle(deck.map((card) => ({ id: card.id, fileName: card.fileName })));
  }

  getColorList() {
    const primary = [];
    const secondary = [];
    for (let i = 0; i < 6; i += 1) {
      primary.push(i);
      secondary.push(i + 6);
    }
    return shuffle(primary).concat(shuffle(secondary));
  }

  setRoundCount() {
    const n = this.players.length;
    this.roundCount = Math.floor((this.deck.length - n * 6) / n) + 1;
  }

  startGame(deck) {
    if (!this.isStarted) {
      if (this.players.length >= 2) {
        this.setDeck(deck);
        this.setRoundCount();
        if (this.deck.length > this.players.length * 6) {
          this.players = shuffle(this.players);
          const colors = this.getColorList();
          for (let i = 0; i < this.players.length; i += 1) {
            this.players[i].color = colors[i];
            for (let j = 0; j < 6; j += 1) {
              this.players[i].hand.push(this.deck.pop());
            }
          }
          this.isStarted = true;
          this.rounds.push({
            currentPlayerId: this.players[this.currentPlayer].id,
            pickedCards: [],
            votes: [],
          });
        } else {
          throw Error('Invalid deck.');
        }
      } else {
        throw Error('Invalid player count.');
      }
    } else {
      throw Error('Game is already started');
    }
  }

  setNextRound() {
    if (this.currentState === 3) {
      this.currentState = 0;
      this.rounds.push({
        currentPlayerId: this.players[this.currentPlayer].id,
        pickedCards: [],
        votes: [],
      });
      this.currentRound += 1;
      if (this.currentPlayer === this.players.length - 1) {
        this.currentPlayer = 0;
      } else {
        this.currentPlayer += 1;
      }
      if (this.currentRound >= this.roundCount) {
        this.isOver = true;
      }
      console.log(`Round: ${this.currentRound + 1}/${this.roundCount}`);
    } else {
      throw Error('Invalid move.');
    }
  }

  setCardCount(cardCount) {
    this.cardCount = cardCount;
  }

  setTable() {
    const round = this.rounds[this.currentRound];
    const table = [
      ...round.pickedCards
        .map((item) => item.card),
      round.originalCard,
    ];
    round.table = shuffle(table);
  }

  setScoreBoard() {
    const round = this.rounds[this.currentRound];
    const obj = round.table.map((card) => {
      const picked = round.pickedCards.find((item) => item.card === card);
      if (picked) {
        return { playerId: picked.playerId, card, voteCount: 0 };
      }
      return {
        playerId: this.players[this.currentPlayer].id, card, isOriginal: true, voteCount: 0,
      };
    });
    round.votes.forEach((vote) => {
      const voted = obj[vote.vote - 1];
      if (voted.isOriginal) {
        obj.find((item) => item.playerId === vote.playerId).isWinner = true;
      }
      voted.voteCount += 1;
    });
    let winScore = 2;
    const original = obj.find((item) => item.isOriginal === true);
    if (original.voteCount && original.voteCount !== round.votes.length) {
      original.isWinner = true;
      winScore = 3;
    } else if (!original.voteCount) {
      for (let i = 0; i < obj.length; i += 1) {
        if (!obj[i].isOriginal) {
          obj[i].isWinner = true;
        }
      }
    }
    for (let i = 0; i < this.players.length; i += 1) {
      const player = this.players[i];
      const data = obj.find((item) => item.playerId === player.id);
      let earned = 0;
      if (data.isWinner) {
        earned += winScore;
      }
      if (!data.isOriginal) {
        earned += data.voteCount;
      }
      player.score = { total: player.score.total + earned, lastRound: earned };
    }
    console.log(this.players.map((player) => ({ name: player.name, score: player.score })));
  }

  getGameInfo(isHost, playerId = null) {
    const obj = {
      type: isHost ? 'host' : 'player',
      ip: this.ip,
      code: this.code,
      players: this.getPlayerList(),
      admin: this.admin,
    };
    if (!isHost) {
      if (playerId) {
        obj.playerId = playerId;
      } else {
        throw Error('playerId is not specified.');
      }
    }
    return obj;
  }

  pickCard(pickedCard, playerId) {
    switch (this.currentState) {
      case 0:
        if (this.players[this.currentPlayer].id === playerId) {
          const cardIndex = this.players[this.currentPlayer].hand
            .findIndex((card) => card.id === pickedCard);
          if (cardIndex !== -1) {
            this.rounds[this.currentRound].originalCard = this.players[this.currentPlayer]
              .hand[cardIndex];
            if (this.deck.length > 0) {
              this.players[this.currentPlayer].hand[cardIndex] = this.deck.pop();
            } else {
              console.log(this.players[this.currentPlayer].hand);
              this.players[this.currentPlayer].hand
                .splice(cardIndex, 1);
              console.log(this.players[this.currentPlayer].hand);
            }
            this.currentState = 1;
          } else {
            throw Error('Invalid card.');
          }
        } else {
          throw Error('Invalid move.');
        }
        break;
      case 1:
        if (this.players[this.currentPlayer].id !== playerId) {
          const playerIndex = this.players.findIndex((player) => player.id === playerId);
          if (playerIndex !== -1) {
            const round = this.rounds[this.currentRound];
            const player = this.players[playerIndex];
            if (!round.pickedCards
              .find((item) => item.playerId === playerId)) {
              const cardIndex = player.hand
                .findIndex((card) => card.id === pickedCard);
              if (cardIndex !== -1) {
                round.pickedCards.push({
                  playerId,
                  card: player.hand[cardIndex],
                });
                if (this.deck.length > 0) {
                  player.hand[cardIndex] = this.deck.pop();
                } else {
                  console.log(player.hand);
                  player.hand.splice(cardIndex, 1);
                  console.log(player.hand);
                }
                if (round.pickedCards.length === this.players.length - 1) {
                  this.setTable();
                  this.currentState = 2;
                  console.log(round.table);
                }
              } else {
                throw Error('Invalid card.');
              }
            } else {
              throw Error('Invalid move.');
            }
          } else {
            throw Error('Player not exists.');
          }
        } else {
          throw Error('Invalid move.');
        }
        break;
      default:
        throw Error('Invalid move.');
    }
  }

  vote(playerId, vote) {
    if (this.currentState !== 2) {
      throw Error('Invalid move.');
    } else if (playerId === this.players[this.currentPlayer].id) {
      throw Error('Invalid move.');
    } else {
      const player = this.players.find((item) => item.id === playerId);
      if (!player) {
        throw Error('Player not exists.');
      } else {
        const round = this.rounds[this.currentRound];
        const ownCardIndex = round.table.findIndex((card) => card.id === round.pickedCards
          .find((item) => item.playerId === playerId).card.id) + 1;
        if (vote === ownCardIndex || vote < 1 || vote > this.players.length) {
          throw Error('Invalid vote.');
        } else if (round.votes.find((item) => item.playerId === playerId)) {
          throw Error('Player already voted.');
        } else {
          round.votes.push({ playerId, vote });
          if (round.votes.length === this.players.length - 1) {
            this.setScoreBoard();
            this.currentState = 3;
          }
        }
      }
    }
  }

  getGameState(isHost, playerId = null) {
    if (playerId !== null && !this.players.find((player) => player.id === playerId)) {
      throw Error('Player not exists.');
    } else {
      const round = this.rounds[this.currentRound];
      const obj = {
        isStarted: this.isStarted,
        isOver: this.isOver,
        state: this.currentState,
        scores: this.players.map((player) => ({ playerId: player.id, score: player.score })),
      };
      if (this.isStarted) {
        obj.currentPlayer = this.players[this.currentPlayer].id;
        if (!isHost) {
          obj.hand = this.players.find((player) => player.id === playerId).hand;
        }
      }
      switch (this.currentState) {
        case 0:
          return obj;
        case 1:
          obj.playersPicked = round.pickedCards.map((item) => item.playerId);
          console.log('State 1');
          console.log(obj.playersPicked);
          return obj;
        case 2:
          if (isHost) {
            obj.table = round.table;
          }
          obj.playersVoted = round.votes.map((vote) => vote.playerId);
          if (!isHost && playerId !== this.players[this.currentPlayer].id) {
            obj.ownCardIndex = round.table.findIndex((card) => card.id === round.pickedCards
              .find((item) => item.playerId === playerId).card.id) + 1;
          }
          return obj;
        case 3:
          if (isHost) {
            obj.table = round.table;
            obj.votes = round.votes;
            obj.originalCardId = round.originalCard.id;
            obj.playersPicked = round.pickedCards;
          }
          return obj;
        default:
          throw Error('Invalid game state.');
      }
    }
  }
}

module.exports = Game;
