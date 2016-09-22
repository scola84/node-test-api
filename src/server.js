import ws from 'ws';
import http from 'http';
import mysql from 'mysql';
import MemCached from 'memcached';
import series from 'async/series';

import { requestMediaTypes, responseMediaTypes } from '@scola/api-codec';
import { codec, decoder, encoder } from '@scola/api-codec-json';

import { WebSocket } from '@scola/websocket';
import { Connector as WsConnector, Connection } from '@scola/api-ws';
import { Connector as HttpConnector } from '@scola/api-http';
import { Router, handleError } from '@scola/api-router';
import { ServerFactory, serverRoutes } from '@scola/api-model';
import { extend } from '@scola/mysql';
import { MemCache } from '@scola/cache-memcache';

import { server as serverTest } from '@scola/test';
import { config } from '../config';

function parseAddress(connection) {
  return connection && connection.address().address || '';
}

function logStart() {
  const date = '[' + new Date().toISOString() + ']';
  console.log(date + ' start server');
}

function logStop() {
  const date = '[' + new Date().toISOString() + ']';
  console.log(date + ' stop server');
}

function logRouterError(error) {
  const date = '[' + new Date().toISOString() + ']';
  const address = parseAddress(error.request.connection());

  console.error(date + ' ' + address + ' ' + error.message);
}

function logError(error) {
  const date = '[' + new Date().toISOString() + ']';
  const address = parseAddress(error.connection);

  console.error(date + ' ' + address + ' ' + (error && error.message));
}

function logRequest(request, response, next) {
  const date = '[' + new Date().toISOString() + ']';
  const address = parseAddress(request.connection());
  const id = request.method() + ' ' + request.url();

  console.log(date + ' ' + address + ' ' + id);
  next();
}

function logOpen(connection) {
  const date = '[' + new Date().toISOString() + ']';
  const address = parseAddress(connection);

  console.log(date + ' ' + address + ' open');
}

function logClose(event) {
  const date = '[' + new Date().toISOString() + ']';
  const address = parseAddress(event.connection);

  if (event.reason && event.reason.match(/delay=/)) {
    console.log(date + ' close connection ' + address + ' ' + event.code);
  } else {
    console.log(date + ' ' + address + ' close ' + event.code);
  }
}

const socket = new WebSocket(config.pubsub.address, null, ws);
const httpServer = new http.Server();

const wsServer = new ws.Server({
  server: httpServer
});

const router = new Router();
const factory = new ServerFactory();
const memcached = new MemCached();

const pubsub = new Connection()
  .socket(socket)
  .router(router)
  .codec(codec);

const httpConnector = new HttpConnector()
  .server(httpServer)
  .router(router);

const wsConnector = new WsConnector()
  .server(wsServer)
  .router(router)
  .codec(codec);

const cache = new MemCache()
  .storage(memcached);

const database = mysql.createConnection(config.mysql);

httpServer.listen(config.api.port, config.api.host);

logStart();

extend(database)
  .connect();

router
  .filter(logRequest);

factory
  .cache(cache)
  .connection(pubsub);

router.on('error', handleError);
router.on('error', logRouterError);

httpConnector.on('connection', logOpen);
httpConnector.on('close', logClose);
httpConnector.on('error', logError);

wsConnector.on('connection', logOpen);
wsConnector.on('close', logClose);
wsConnector.on('error', logError);

router.filter(requestMediaTypes(decoder()));
router.filter(responseMediaTypes(encoder()));

serverRoutes(router, factory);
serverTest(router, factory, database, pubsub);

process.on('SIGINT', () => {
  logStop();

  series([
    (callback) => {
      httpConnector.close();
      callback();
    },
    (callback) => {
      wsConnector.close(1001, 'delay=1');
      callback();
    },
    (callback) => {
      httpServer.close(callback);
    },
    (callback) => {
      wsServer.close(callback);
    },
    (callback) => {
      pubsub.close(1001);
      callback();
    },
    (callback) => {
      memcached.end();
      callback();
    },
    (callback) => {
      database.end(callback);
    }
  ], () => {
    process.exit();
  });
});
