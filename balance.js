'use strict';
const EventEmitter = require('events').EventEmitter;
const chance = require('chance').Chance();
const Redis = require("redis");
const config = require('./config.json');
const redisPSub = new Redis.createClient(config.redisPort, config.redisHost);

// 1) If publisher not active
// 2) Get next nodeId
// 3) If next nodeId not my
// 4) Set timeout
// 5) -> 1)

class Balance extends EventEmitter {
  constructor(redisCli) {
    super();
    this.redisCli = redisCli;
    this.nodeName = chance.name();
    this.lastNode = false;
  }

  /**
   * Init balancer and register node in redis
   * @return {Promise}
   */
  init() {
    return this
      .registerNode()
      .then(() => this.initPublisherListener())
  }

  /**
   * Register node in queue
   * @return {Promise}
   */
  registerNode() {
    return new Promise((resolve) => {
      this.redisCli.rpush('nodes', this.nodeName, () => {
        console.log('Registered node ' + this.nodeName);
        resolve();
      })
    })
  }
  
  /**
   * Check publisher health or select next
   * @return {Promise.<String>} PublisherOnline | IamPublisher
   */
  check() {
    return this
      .checkPublisher()
      .then(isOnline => {
        if (isOnline) {
          console.log('Publisher is online');
          throw 'PublisherOnline';
        }
        console.log('Publisher is offline');
        return this.getNextNode()
      })
      .then(nextNode => this.removeLastNode(nextNode))
      .then(nextNode => this.lastNode = nextNode)
      .then(nextNode => {
        console.log('Next node is', nextNode, '==', this.nodeName);
        if (nextNode !== this.nodeName) {
          return new Promise((resolve) => {
            setTimeout(() => resolve(this.check()), 100);
          });
        }
        console.log('I am a publisher');
        return 'IamPublisher';
      })
      .catch(err => {
        if (err !== 'PublisherOnline') {
          throw err;
        }
        return 'PublisherOnline';
      })
      .then(result => {
        this.lastNode = false;
        return result;
      })
  }

  /**
   * Check publisher is online
   * @return {Promise.<Boolean>} Online or not
   */
  checkPublisher() {
    return new Promise((resolve) => {
      this.redisCli.get('publisherHere', (err, val) => {
        if (err || !val) {
          return resolve(false);
        }
        resolve(true);
      })
    })
  }

  /**
   * Request next node from queue
   * @return {Promise}
   */
  getNextNode() {
    return new Promise((resolve) => {
      this.redisCli.lrange('nodes', -1, -1, (err, val) => {
        if (val === false) { // All nodes die and something wrong.
          // We try re register in queue and next call, should help found publisher
          return this.registerNode().then(this.getNextNode.bind(this));
        }
        if (val && val.length > 0) {
          return resolve(val[0]);
        }
        return resolve(false);
      })
    })
  }

  /**
   * Check if node is die and remove died node from queue
   * @param nextNode
   * @return {Promise.<String>} Next node name or null
   */
  removeLastNode(nextNode) {
    if (this.lastNode && this.lastNode.length > 0 && this.lastNode === nextNode) {
      console.log('Died node detected. Removing', nextNode);
      return new Promise((resolve) => {
        this.redisCli.rpop('nodes', () => {
          this.getNextNode().then(resolve);
        })
      })
    }
    return Promise.resolve(nextNode);
  }

  /**
   * Enable redis key-events and subscribe to it
   */
  initPublisherListener() {
    // Enable keyevents in redis and subsribe for EXPIRED event
    redisPSub.config('SET', 'notify-keyspace-events', 'Ex');
    redisPSub.psubscribe('__keyevent@0__:*');
    redisPSub.on('pmessage', (pattern, channel, message) => {
      if (message === 'publisherHere') {
        this.check().then(mode => {
          if (mode === 'IamPublisher') {
            this.emit('mode:change', 'publisher');
          }
        });
      }
    });
  }
}

module.exports = Balance;
