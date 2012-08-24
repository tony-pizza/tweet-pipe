TweetPipe
==========

Connect to Twitter's Streaming API via Node.js Streams (using EventStreams)
https://github.com/peeinears/tweet-pipe

## :)

 - Uses [Node Streams](http://nodejs.org/api/stream.html)
 - With the help of [EventStream](https://github.com/dominictarr/event-stream)
 - and [Request](https://github.com/mikeal/request) (which also uses EventStream)
 - This means you can `pipe()` stuff around, which is really great
 - Can pull down and deflate gzipped data (and does so by default)
 - Inspiration (and some borrowed logic) from [ntwitter](https://github.com/AvianFlu/ntwitter)

## :(

 - No tests
 - Site streams currently unsupported
 - Lacking in error handling

## Put some tweets in your pipe and do stuff with them

### Basic usage

``` js
var TweetPipe = require('tweet-pipe');

var tp = new TweetPipe({
  consumer_key: 'yourconsumerkey',
  consumer_secret: 'yourconsumersecret',
  token: 'youraccesstoken',
  token_secret: 'youraccesstokensecret'
});

tp.stream('statuses/filter', params, function (stream) {
  // hook to emitted events and do stuff
  stream.on('tweet', function (tweet) { // do stuff with tweet });
});
```

### Supported events

Refer to: https://dev.twitter.com/docs/streaming-apis/messages

`tweet`, `delete`, `limit`, `scrub\_geo`, `status\_withheld`, `user\_withheld`, `friends`, `event`

`all`: emits data chunks of all types


### Raw streams and convenience methods

You can also access the raw, [un-deflated,] unparsed stream with `tp.raw\_stream(method, params, callback)`. 
Note that the callback here is on the `Request` object -- the above events are not emitted.

If you're piping this stream elsewhere you can use `tp.unzip()` to deflate gzipped streams and `tp.parse()` to convert the stream into JSON.

``` js
tp.raw_stream('statuses/sample')
  .pipe(tp.unzip())
  .pipe(tp.parse())
  .pipe(someStreamThatHandlesJSON);
```

### Example

Track the popularity of various Mexican cuisine for one minute:

``` js

var TweetPipe = require('tweet-pipe')
  , es = require('event-stream');

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

```

## License

MIT
