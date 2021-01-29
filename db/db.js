const data = require('../data/db.json');

exports.findAllEditions = () => data.editions;
exports.findCardsByEdition = (editions = []) => {
  if (Array.isArray(editions)) {
    return data.cards
      .filter((card) => editions.includes(card.editionId))
      .map((card) => ({ id: card.id, fileName: card.fileName }));
  }
  throw Error('Invalid editions.');
};
