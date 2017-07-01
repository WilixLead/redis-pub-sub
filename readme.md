# Redis Pub/Sub

For check how this works you should run more then one instance of app

- After start app it check queues for exist. If not, it create new
- Now app check if publisher app online.
- If no, app change his mode to published, if yes, app go to subscribe mode
- If app in subscribe mode and publisher die, app go to publisher mode by queue

### Installation

- `git clone https://github.com/WilixLead/redis-pub-sub.git`
- `cd redis-pub-sub`
- `npm i`
- `npm start` - start in default mode
- `npm run getErrors` or `node index.js getErrors` - print errors from queue

### Test results

- Core i7 x 16Gb x SSD
- Redis 3.2.8
- Node.js 7.9.0
- 1 publisher node
- 3 subscribe nodes
- Test stops on 1 000 000 message
- Setting "publishSpeed" set to "0" 

1) App sending only number from 0 to 1 000 000 with string prefix 'i' : `12min 50sec` : `1333 msg/sec`
2) App sending random string with number from 0 to 1 000 000 like '1234:John' : `13min 23sec` : `1260 msg/sec`

