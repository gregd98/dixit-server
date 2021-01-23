const { networkInterfaces } = require('os');

const nets = networkInterfaces();

exports.getIp = () => {
  const results = {};
  Object.keys(nets).forEach((key) => {
    nets[key].forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[key]) {
          results[key] = [];
        }
        results[key].push(net.address);
      }
    });
  });
  console.log(results);
  if (results.en0) {
    return results.en0[0];
  }
  if (results['Wi-Fi']) {
    return results['Wi-Fi'][0];
  }
  // TODO itt menezni az egyeb interfaceket
  return '';
};
