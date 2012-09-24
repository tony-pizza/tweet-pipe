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
  // { consumer_key: 'abc',
  //   consumer_secret: 'def',
  //   token: 'ghi',
  //   token_secret: 'jkl' }

  var defaults = {
    stream_base: 'https://stream.twitter.com/1.1',
    user_stream_base: 'https://userstream.twitter.com/1.1',
    site_stream_base: 'https://sitestream.twitter.com/1.1',
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
// just the raw, [un-inflated,] unparsed data
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

// returns a through stream that takes json and emits desired twitter messages
TweetPipe.prototype.filter = function (data_events) {

  if (typeof data_events === 'undefined') {
    data_events = ['tweet'];
  }

  // don't emit anything as 'data' if data_events is null or falsy
  if (!data_events) data_events = [];

  // don't allow 'all' and other events
  if (data_events.indexOf('all') >= 0) data_events = ['all'];

  // helper method for emitting data according to data_events
  var emit = function (event, data) {
    this.emit(event, data);
    if (data_events.indexOf(event) >= 0) this.emit('data', data);
  };

  var filter = es.through(function (data) {
    // https://dev.twitter.com/docs/streaming-apis/messages

    // to catch all
    emit.call(this, 'all', data);

    // Public stream
    if (data['delete']) {
      emit.call(this, 'delete', data['delete']);

    } else if (data['limit']) {
      emit.call(this, 'limit', data['limit']);

    } else if (data['scrub_geo']) {
      emit.call(this, 'scrub_geo', data['scrub_geo']);

    } else if (data['status_withheld']) {
      emit.call(this, 'status_withheld', data['status_withheld']);

    } else if (data['user_withheld']) {
      emit.call(this, 'user_withheld', data['user_withheld']);

    // User stream
    } else if (data['friends']) {
      emit.call(this, 'friends', data['friends']);

    } else if (data['event']) {
      emit.call(this, 'event', data['event']);

    // TODO: support site stream messages

    } else {
      // must be a tweet, right?
      emit.call(this, 'tweet', data);
    }

    this.resume();

  });

  return filter;
};

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
  });

  var req = this.raw_stream(method, params);

  var filter = this.filter(data_events);

  var _end = filter.end;
  filter.end = function (data) {
    req.abort();
    process.nextTick(function () {
      if (data)
        _end.call(filter, data);
      else
        _end.call(filter);
    });
  };

  req.on('error', function (error) {
    filter.emit('error', error);
  });

  req.on('response', function (response) {
    // any response code greater then 200 from stream API is an error
    if (response.statusCode > 200) {
      filter.emit('error', 'HTTP ' + response.statusCode);
    }
    response.on('error', function (error) {
      filter.emit('error', error);
    });
  });

  filter.on('error', function (error) {
    console.log('error:', error)
  });

  // allow user to catch emitted events
  if (typeof callback === 'function') callback(filter);

  var stream = this.options.gzip ? req
      .pipe(this.unzip())
      .pipe(this.parse())
      .pipe(filter)
    : req
      .pipe(this.parse())
      .pipe(filter)
  ;

  return stream;
};

// convenienve method for deflating gzipped streams
TweetPipe.prototype.inflate = TweetPipe.prototype.unzip = zlib.createUnzip;
TweetPipe.prototype.gzip = zlib.createGzip;

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
