const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const interfaces = ['en0', 'Ethernet', 'Wi-Fi'];

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

  for (let i = 0; i < interfaces.length; i += 1) {
    if (results[interfaces[i]]) {
      return results[interfaces[i]][0];
    }
  }
  return '';
};
