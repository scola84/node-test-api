import http from 'http';
import MemCached from 'memcached';
import mysql from 'mysql';
import parallel from 'async/parallel';
import WebSocket from 'ws';

import {
  requestMediaTypes,
  responseMediaTypes
} from '@scola/api-codec';

import {
  codec,
  decoder,
  encoder
} from '@scola/api-codec-json';

import { Connector as HttpConnector } from '@scola/api-http';

import {
  ConnectionHandler,
  ConnectorHandler,
  RouterHandler,
  ConsoleLogger
} from '@scola/api-log';

import {
  ServerFactory,
  serverRoutes
} from '@scola/api-model';

import {
  Router,
  handleError
} from '@scola/api-router';

import {
  Connector as WsConnector,
  Connection
} from '@scola/api-ws';

import { MemCache } from '@scola/cache-memcache';
import { extend } from '@scola/mysql';
import { Reconnector } from '@scola/websocket';

import { server as serverTest } from '@scola/test';
import { config } from '../conf/server';

const router = new Router();
const factory = new ServerFactory();
const memcached = new MemCached(config.memcached.address,
  config.memcached.options);

const pubsubConnection = new Connection()
  .auto(false)
  .router(router)
  .codec(codec);

const httpServer = new http.Server();
const httpConnector = new HttpConnector()
  .server(httpServer)
  .router(router);

const wsServer = new WebSocket.Server({ server: httpServer });
const wsConnector = new WsConnector()
  .server(wsServer)
  .router(router)
  .codec(codec)
  .ping(config.api.ping);

const cache = new MemCache()
  .storage(memcached);

const database = extend(mysql.createPool(config.mysql));

const reconnector = new Reconnector()
  .class(WebSocket)
  .url(config.pubsub.address)
  .options(config.pubsub.options);

const consoleLogger = new ConsoleLogger();

const pubsubLog = new ConnectionHandler()
  .id(config.log.id)
  .name(config.log.pubsub.name)
  .source(pubsubConnection)
  .target(consoleLogger)
  .events(config.log.pubsub.events);

const httpLog = new ConnectorHandler()
  .id(config.log.id)
  .name(config.log.http.name)
  .source(httpConnector)
  .target(consoleLogger)
  .events(config.log.http.events);

const wsLog = new ConnectorHandler()
  .id(config.log.id)
  .name(config.log.ws.name)
  .source(wsConnector)
  .target(consoleLogger)
  .events(config.log.ws.events);

const routerLog = new RouterHandler()
  .id(config.log.id)
  .name(config.log.router.name)
  .source(router)
  .target(consoleLogger)
  .events(config.log.router.events);

factory
  .cache(cache)
  .connection(pubsubConnection);

httpServer
  .listen(config.api.port, config.api.host);

reconnector.on('error', (error) => {
  consoleLogger.log({
    date: new Date(),
    id: config.log.id,
    name: config.log.name,
    text: error.message,
    type: 'error'
  });
});

reconnector.on('open', (event) => {
  pubsubConnection
    .socket(event.socket)
    .open(event);
});

router.on('error', handleError);

router.filter(requestMediaTypes(decoder()));
router.filter(responseMediaTypes(encoder()));

serverRoutes(router, factory);
serverTest(router, factory, database, pubsubConnection);

reconnector.open();

consoleLogger.log({
  date: new Date(),
  id: config.log.id,
  name: config.log.name,
  type: 'start'
});

process.on('SIGINT', () => {
  consoleLogger.log({
    date: new Date(),
    id: config.log.id,
    name: config.log.name,
    type: 'stop'
  });

  parallel([
    (callback) => {
      httpConnector.close();
      wsConnector.close(1001, 'delay=1');
      pubsubConnection.close(1001);
      callback();
    },
    (callback) => {
      httpLog.end();
      pubsubLog.end();
      routerLog.end();
      wsLog.end();
      callback();
    },
    (callback) => {
      httpServer.close(callback);
    },
    (callback) => {
      wsServer.close(callback);
    },
    (callback) => {
      memcached.end();
      database.end(callback);
    }
  ], () => {
    process.exit();
  });
});
