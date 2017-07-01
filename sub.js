'use strict';

const config = require('./config.json');

class Sub {
  constructor(rsmq, redisCli) {
    this.mq = rsmq;
    this.redisCli = redisCli;
    this.stopMe = false;
  }

  /**
   * Receive messages and print it
   */
  receive() {
    if (this.stopMe) {
      return;
    }
    this.mq.receiveMessage({qname: config.queueName}, (err, msg) => {
      if (err) {
        throw err;
      }
      if (msg.id) {
        this.errorDetection(msg);
        this.mq.deleteMessage({qname: config.queueName, id: msg.id}, () => {
          this.receive();
        });
        process.stdout.write('\x1B[2KReceiving: <<< [' + msg.message + ']\r');
      }
      else {
        // console.log("No messages for me...");
        this.receive();
      }
    });
  }

  /**
   * Start receiving messages
   */
  start() {
    this.stopMe = false;
    this.receive();
  }

  /**
   * Stop receiving
   */
  stop() {
    this.stopMe = true;
  }
  
  errorDetection(msg) {
    let percent = Math.floor(Math.random() * 19);
    if (percent === 1) { // Error detected
      this.redisCli.lpush(config.errorsQueueName, msg.message);
    }
  }
}

module.exports = Sub;