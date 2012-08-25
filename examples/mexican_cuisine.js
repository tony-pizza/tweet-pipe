var TweetPipe = require('tweet-pipe');

var oauth = {
  consumer_key: 'yourconsumerkey',
  consumer_secret: 'yourconsumersecret',
  token: 'youraccesstoken',
  token_secret: 'youraccesstokensecret'
};

var tp = new TweetPipe(oauth);

var tacos = burritos = enchiladas = 0;

var params = { track: ['taco', 'burrito', 'enchilada'] };
tp.stream('statuses/filter', params, function (stream) {

  stream.on('tweet', function (tweet) {
    if (tweet.text.search(/\btacos?\b/i) >= 0) tacos++;
    if (tweet.text.search(/\bburritos?\b/i) >= 0) burritos++;
    if (tweet.text.search(/\benchiladas?\b/i) >= 0) enchiladas++;

    // choose what gets piped to next stream (if anything)
    // in this case, pipe out tweet text
    stream.emit('data', tweet.text + '\n');
  });

  stream.on('error', function (error) {
    console.log('Uh oh: ' + error);
  });

  stream.on('end', function () {
    console.log("\n");
    console.log("THE RESULTS");
    console.log("===========");
    console.log('Tacos: ' + tacos);
    console.log('Burritos: ' + burritos);
    console.log('Enchiladas: ' + enchiladas);
  });

  // stop the stream after 60 seconds
  setTimeout(function () { stream.end(); }, 60*1000);
}).pipe(process.stdout); // tweet text piped to stdout
