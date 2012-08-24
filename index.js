var es = require('event-stream')
  , util = require('util')
  , request = require('request')
  , zlib = require('zlib')
  ;

function merge (defaults) {
  for (var i = 1; i < arguments.length; i++) {
    for (var opt in arguments[i]) {
      defaults[opt] = arguments[i][opt];
    }
  }
  return defaults;
};

function TweetPipe (oauth, options) {

  // oauth should look like:
  // { consumer_key: null,
  //   consumer_secret: null,
  //   token: null,
  //   token_secret: null }

  var defaults = {
    stream_base: 'https://stream.twitter.com/1',
    user_stream_base: 'https://userstream.twitter.com/2',
    site_stream_base: 'https://sitestream.twitter.com/2b',
    gzip: true, // use twitter's gzipped stream
    headers: {
      'Accept': '*/*',
      'User-Agent': 'peeinears/tweet-streamer'
    }
  };

  this.options = merge(defaults, options);
  this.options.oauth = oauth;
  if (this.options.gzip) {
    this.options.headers['Accept-Encoding'] = 'deflate, gzip';
  } else {
    this.options.headers['Connection'] = 'close';
  }

}

// returns the request stream
// just the raw, [un-deflated,] unparsed data
TweetPipe.prototype.raw_stream = function (method, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = null;
  }

  // Iterate on params properties, if any property is an array, convert it to comma-delimited string
  if (params) {
    Object.keys(params).forEach(function (item) {
      if (util.isArray(params[item])) {
        params[item] = params[item].join(',');
      }
    });
  }

  var stream_base = this.options.stream_base;

  var http_method = 'GET';

  // Stream type customizations
  switch (method) {
    case 'user':
      stream_base = this.options.user_stream_base;
      break;
    case 'site':
      stream_base = this.options.site_stream_base;
      break;
    case 'statuses/filter':
      http_method = 'POST';
      break;
  }

  var url = stream_base + '/' + escape(method) + '.json';

  var req = request({
    url: url,
    method: http_method,
    oauth: this.options.oauth,
    headers: this.options.headers,
    form: (http_method === 'POST' ? params : false)
  });

  if ( typeof callback === 'function' ) callback(req);

  return req;

};

TweetPipe.prototype.stream = function (method, params, callback) {

  var stream = es.through(function (data) {
    // https://dev.twitter.com/docs/streaming-apis/messages

    // to catch all
    this.emit('all', data);

    // Public stream
    if (data['delete']) {
      this.emit('delete', data['delete']);

    } else if (data['limit']) {
      this.emit('limit', data['limit']);

    } else if (data['scrub_geo']) {
      this.emit('scrub_geo', data['scrub_geo']);

    } else if (data['status_withheld']) {
      this.emit('status_withheld', data['status_withheld']);

    } else if (data['user_withheld']) {
      this.emit('user_withheld', data['user_withheld']);

    // User stream
    } else if (data['friends']) {
      this.emit('friends', data['friends']);

    } else if (data['event']) {
      this.emit('event', data);

    // TODO: support site stream messages

    } else {
      // must be a tweet, right?
      this.emit('tweet', data);
    }
    return true;
  });

  var req = this.raw_stream(method, params);

  req.on('error', function (error) {
    stream.emit('error', error);
  });

  req.on('response', function (response) {
    // Any response code greater then 200 from steam API is an error
    if (response.statusCode > 200) {
      stream.destroy();
      stream.emit('error', response.statusCode);
    }
  });

  stream.on('close', function () { req.abort(); });

  // allow user to catch emitted events
  if ( typeof callback === 'function' ) callback(stream);

  return this.options.gzip ? es.pipeline(
    req,
    this.unzip(),
    this.parse(),
    stream
  ) : es.pipeline(
    req,
    this.parse(),
    stream
  );
};

// convenienve method for deflating gzipped streams
TweetPipe.prototype.deflate =
TweetPipe.prototype.unzip = function () {
  return zlib.createUnzip();
};

// convenienve method for converting to JSON
TweetPipe.prototype.parse = function () {
  return es.pipeline(
    es.split(),
    es.parse()
  );
};

module.exports = TweetPipe;
