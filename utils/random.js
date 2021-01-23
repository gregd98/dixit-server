const crypto = require('crypto');

const MAX_INT = 2 ** 32 - 1;

const getRandomInt = (max = undefined) => {
  let k;
  const getInt = () => crypto.randomBytes(4).reduce((acc, value) => acc * 256 + value, 0);
  if (max !== undefined) {
    do {
      k = getInt();
    } while (k >= MAX_INT - (MAX_INT % max));
    return k % max;
  }
  return getInt();
};

exports.getRandomInt = (max = undefined) => getRandomInt(max);

exports.shuffle = (array) => {
  const result = array;
  for (let i = result.length; i > 0; i -= 1) {
    const r = getRandomInt(i);
    const tmp = result[i - 1];
    result[i - 1] = result[r];
    result[r] = tmp;
  }
  return result;
};
