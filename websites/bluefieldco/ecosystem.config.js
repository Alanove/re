module.exports = {
  apps: [{
    name: 'emdc-cms',
    script: 'dist/src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3019
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3019
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
