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

// helper method for emitting data according to data_events
function __emit (stream, event, data, data_events) {
  stream.emit(event, data);
  if (data_events.indexOf(event) >= 0) stream.emit('data', data);
}

TweetPipe.prototype.stream = function (method, params, data_events, callback) {

  // handle optional arguments
  // params is an object, data_events is an array, callback is a function
  [params, data_events, callback].forEach(function (arg) {
    if (typeof arg === 'function') {
      callback = arg;
    } else if (typeof arg === 'object') {
      params = arg;
    } else {
      data_events = arg;
    }
  })

  if (typeof data_events === 'undefined') {
    data_events = ['tweet'];
  }

  // don't emit anything as 'data' if data_events is null or falsy
  if (!data_events) data_events = [];

  // don't allow 'all' and other events
  if (data_events.indexOf('all') >= 0) data_events = ['all'];

  var stream = es.through(function (data) {
    // https://dev.twitter.com/docs/streaming-apis/messages

    // to catch all
    __emit(this, 'all', data, data_events);

    // Public stream
    if (data['delete']) {
      __emit(this, 'delete', data['delete'], data_events);

    } else if (data['limit']) {
      __emit(this, 'limit', data['limit'], data_events);

    } else if (data['scrub_geo']) {
      __emit(this, 'scrub_geo', data['scrub_geo'], data_events);

    } else if (data['status_withheld']) {
      __emit(this, 'status_withheld', data['status_withheld'], data_events);

    } else if (data['user_withheld']) {
      __emit(this, 'user_withheld', data['user_withheld'], data_events);

    // User stream
    } else if (data['friends']) {
      __emit(this, 'friends', data['friends'], data_events);

    } else if (data['event']) {
      __emit(this, 'event', data, data_events);

    // TODO: support site stream messages

    } else {
      // must be a tweet, right?
      __emit(this, 'tweet', data, data_events);
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
TweetPipe.prototype.deflate = TweetPipe.prototype.unzip = zlib.createUnzip;

// convenienve method for converting to JSON
TweetPipe.prototype.parse = function () {
  return es.pipeline(
    es.split(),
    es.parse()
  );
};

// convenienve method for stringifying JSON
TweetPipe.prototype.stringify = es.stringify;

module.exports = TweetPipe;
