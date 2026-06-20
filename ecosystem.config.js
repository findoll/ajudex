module.exports = {
  apps: [{
    name: 'ajudex',
    script: 'dev.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
