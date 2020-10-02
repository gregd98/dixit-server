const express = require('express');

const PORT = 80;
const app = express();

app.get('/', (req, res) => {
  res.status(200).send('Dixit server');
});

app.listen(PORT, () => { console.log(`Server listening on port ${PORT}.`); });
