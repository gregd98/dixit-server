const { exec } = require('pkg'),
  pac = require('./package.json');

(async () => {
  console.log('Building executables.');
  await exec(['--output', `dixit-${pac.version}`, '.']);
  console.log('Complete!');
})();
