module.exports = {
  apps: [
    {
      name: 'domain-',
      script: './bin/domain-',
      args: 'watch',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      max_memory_restart: '200M',
      autorestart: true
    }
  ]
};
