export const config = {
  api: {
    host: '127.0.0.1',
    ping: 50000,
    port: 4001
  },
  log: {
    id: '127.0.0.1',
    name: 'api-server',
    http: {
      name: 'api-http',
      events: ['error']
    },
    pubsub: {
      name: 'api-pubsub',
      events: ['error']
    },
    router: {
      name: 'api-router',
      events: ['error']
    },
    ws: {
      name: 'api-ws',
      events: ['error']
    }
  },
  memcached: {
    address: '127.0.0.1:11211'
  },
  mysql: {
    host: '127.0.0.1',
    user: '',
    password: '',
    database: ''
  },
  pubsub: {
    address: 'ws://127.0.0.1:3000'
  }
};
