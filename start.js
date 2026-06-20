const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'web-index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AjudeX funcionando' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AjudeX rodando na porta ${PORT}`);
});