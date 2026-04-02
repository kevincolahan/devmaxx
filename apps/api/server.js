const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Server listening on 0.0.0.0:8080');
});
