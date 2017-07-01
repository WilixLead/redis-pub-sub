'use strict';
const Redis = require('redis');
const Chance = require('chance');
const config = require('./config.json');

class Pub {
  constructor(rsmq) {
    this.mq = rsmq;
    this.pub = new Redis.createClient(config.redisPort, config.redisHost);
    this.chance = new Chance();
    this.publishActive = false;
    this.iterator = 0;
    this.startDate = null;
    this.sendParams = {
      qname: config.queueName,
      message: ''
    }
  }

  /**
   * Publish next message
   */
  publish() {
    if (!this.publishActive) {
      return;
    }
    this.sendParams.message = this.iterator + ':';
    this.mq.sendMessage(this.sendParams, (err, msg) => {
      if (err) {
        throw err;
      }
      process.stdout.write('\x1B[2KPublishing: >>> [' + this.sendParams.message + ']\r');
      this.iterator++;
      this.pub.set('publisherHere', 1, 'EX', 3);
      this.publish();
      if (this.iterator === 1000000) {
        this.stop();
        console.log('\r\n Timing: ' + (this.startDate.getTime() - Date.now()) + 'ms');
      }
    });
  }

  /**
   * Start publishing
   */
  start() {
    this.publishActive = true;
    this.startDate = new Date();
    this.publish();
  }

  /**
   * Stop publishing
   */
  stop() {
    this.publishActive = false;
    this.iterator = 0;
  }
}

module.exports = Pub;
