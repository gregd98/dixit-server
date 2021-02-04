const { exec } = require('pkg'),
  pac = require('./package.json');

const getVersion = (version) => {
  const a = version.split('.');
  return `${a[0]}.${a[1]}${a[2]}`;
};

(async () => {
  console.log('Building executables.');
  await exec(['--output', `dixit-${getVersion(pac.version)}`, '.']);
  console.log('Complete!');
})();
