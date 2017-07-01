'use strict';
const Redis = require("redis");
const RedisSMQ = require("rsmq");
const Balance = require('./balance');
const PubMode = require('./pub');
const SubMode = require('./sub');
const config = require('./config.json');

const redisCli = new Redis.createClient(config.redisPort, config.redisHost);
const rsmq = new RedisSMQ({ port: config.redisPort, host: config.redisHost });
const balance = new Balance(redisCli);
const pubMode = new PubMode(rsmq);
const subMode = new SubMode(rsmq, redisCli);

if (process.argv[2] && process.argv[2] === 'getErrors') {
  getNextError()
    .then(() => {
      process.exit();
    });
  return;
}

function getNextError() {
  return new Promise((resolve) => {
    redisCli.lpop(config.errorsQueueName, (err, val) => {
      if (err) {
        throw err;
      }
      if (val) {
        console.log('Bad msg: ' + val);
        resolve(getNextError());
      }
      resolve(false);
    })
  })
}

// Check queue before working with it
let assertion = new Promise((resolve) => {
  rsmq.listQueues((err, resp) => {
    if (err) {
      throw err;
    }
    if (!resp || resp.indexOf(config.queueName) === -1) {
      return rsmq.createQueue({qname: config.queueName, maxsize: -1}, (err, resp) => {
        if (err || !resp) {
          throw `Cant create queue "${config.queueName}"`;
        }
        console.log(`Queue "${config.queueName}" created`);
        resolve();
      });
    }
    resolve();
  })
})

function setNodeMode(mode) {
  if (mode === 'subscribe') {
    console.log('Node now is SUBSCRIBER');
    pubMode.stop();
    subMode.start();
  } else {
    console.log('Node now is PUBLISHER');
    subMode.stop();
    pubMode.start();
  }
}

assertion
  .then(() => balance.init()) // Init balancer and register
  .then(() => {
    balance.on('mode:change', setNodeMode);
    balance.checkPublisher().then(exists => setNodeMode(exists ? 'subscribe' : 'publisher'));
  })