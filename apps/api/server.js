const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json());
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
