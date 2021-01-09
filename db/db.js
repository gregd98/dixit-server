const low = require('lowdb'),
  FileSync = require('lowdb/adapters/FileSync'),
  fs = require('fs'),
  data = require('../data/db.json');

const defaultDb = data;

if (!fs.existsSync('../data')) {
  fs.mkdirSync('../data');
}

const db = low(new FileSync('data/db.json'), {
  serialize: (obj) => JSON.stringify(obj),
  deserialize: (obj) => JSON.parse(obj),
});

db.defaults(defaultDb).write();

exports.findAllEditions = () => db.get('editions').value();

exports.findCardsByEdition = (editions = []) => {
  if (Array.isArray(editions)) {
    return db.get('cards').value().filter((card) => editions.includes(card.editionId)).map((card) => ({ id: card.id, fileName: card.fileName }));
  }
  throw Error('Invalid editions.');
};
