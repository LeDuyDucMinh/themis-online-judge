module.exports = {
  apps: [
    {
      name: 'themis-judge-worker',
      script: './worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        POLL_INTERVAL_MS: '700',
        JUDGE0_URL: 'http://127.0.0.1:2358',
        JUDGE0_TOKEN: 'faminh_secret_api_token'
      }
    }
  ]
};
