#!/usr/bin/env node

// Servidor simples para o AjudeX
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando AjudeX Server...');

// Iniciar o servidor
const serverPath = path.join(__dirname, 'server', 'full-server.js');
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  cwd: __dirname
});

server.on('close', (code) => {
  console.log(`Servidor encerrado com código ${code}`);
  process.exit(code);
});

server.on('error', (err) => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});

// Capturar sinais de encerramento
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.kill('SIGTERM');
});