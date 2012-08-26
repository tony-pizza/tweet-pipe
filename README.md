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

#### Setup

``` js
var TweetPipe = require('tweet-pipe');

var tp = new TweetPipe({
  consumer_key: 'yourconsumerkey',
  consumer_secret: 'yourconsumersecret',
  token: 'youraccesstoken',
  token_secret: 'youraccesstokensecret'
});
```

#### Streamin'

tp.stream(method [, params] [, data_events] [, callback(stream)])

``` js
tp.stream('statuses/sample'); // returns a Stream that emits tweet JSON
```

That won't really do anything, but from there you can pipe the tweets into other streams that do stuff:

``` js
tp.stream('statuses/sample')
  .pipe(tp.stringify())
  .pipe(process.stdout);
```

#### With params

``` js
var params = {
  'track': ['ball', 'rim', 'john'],
  'locations': ['-122.75,36.8,-121.75,37.8', '-74,40,-73,41'], // SF and NY
  'follow': ['justinbieber', 'nodejs']
};
tp.stream('statuses/filter', params); // will emit tweets that match any one of the params
```

[All parameters](https://dev.twitter.com/docs/streaming-apis/parameters)

#### With a callback

``` js
tp.stream('statuses/sample', function (stream) {
  // hook to emitted events and do stuff
  stream.on('tweet', function (tweet) {
    // do stuff with tweet
  });
});
```

#### Change what gets emitted as `'data'`

By default, `tp.stream()` will only pipe out tweets (as JSON). 
You can change this so that other message types are emitted as `'data'`.

``` js
// pipe out 'delete' and 'scrub_geo' messages as well
tp.stream('statuses/sample', ['tweet', 'delete', 'scrub_geo']);

// pipe out all message types
tp.stream('statuses/sample', ['all']);

// don't pipe anything out
tp.stream('statuses/sample', false);

// pipe out only tweet text
tp.stream('statuses/sample', false, function (stream) {
  stream.on('tweet', function (tweet) {
    stream.emit('data', tweet.text);
  });
});
```

### Supported events

Refer to: https://dev.twitter.com/docs/streaming-apis/messages

`'tweet'`, `'delete'`, `'limit'`, `'scrub_geo'`, `'status_withheld'`, `'user_withheld'`, `'friends'`, `'event'`

`'all'` emits data chunks of all types


### Raw streams and convenience methods

You can also access the raw, [un-deflated,] unparsed stream with `tp.raw_stream(method, params, callback)`. 
Note that the callback here is on the `Request` object -- the above events are not emitted.

If you're piping this stream elsewhere you can use 
`tp.unzip()` to deflate gzipped streams and 
`tp.parse()` to convert the stream into JSON.
`tp.stringify()` is also available and can be useful with `tp.stream()`.

``` js
tp.raw_stream('statuses/sample')
  .pipe(tp.unzip())
  .pipe(tp.parse()) // to JSON
  .pipe(tp.stringify()); // woo, back to a string!
```

### Example

Track the popularity of various Mexican cuisine for one minute:

``` js

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

```

## License

MIT
