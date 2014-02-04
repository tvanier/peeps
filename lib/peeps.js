'use strict';

var strata = require('strata');
var ContactStream = require('./contactstream');
var util = require('util');


var peeps = module.exports;

peeps.init = function(config) {

  strata.get('/peeps/ping', function (env, cb) {

    var body = 'pong';
    var resHeaders = {
      'content-type': 'text/plain',
      'content-length': body.length
    };
    cb(200, resHeaders, body);
  });

  var source = null;

  if (config && config.ldap) {
    var LdapSource = require('./source/ldap');
    source = new LdapSource.Source(config.ldap);
  }

  if (!source) {
    return;
  }

  strata.get('/peeps/stream/:keyName/:key', function (env, cb) {
    // search by keyName, streamed response
    var req = strata.Request(env);
    req.params(function (err, params) {
      var criteria = {
        keyName: env.route.keyName,
        key: env.route.key,
        startsWith: true,
        pageSize: parseInt(params.pageSize)
      };

      var stream = new ContactStream.Readable();
      source.searchSet(criteria, stream);

      var resHeaders = {
        'content-type': 'application/json-stream'
      };

      cb(200, resHeaders, stream);
    });
  });

  // absolute maximum number of results in set
  var maxSet = parseInt(config.maxSet);
  if (isNaN(maxSet)) { maxSet = 20; }

  strata.get('/peeps/set/:keyName/:key', function (env, cb) {
    // search by keyName, buffered response
    // example: /peeps/set/displayName/Thomas

    var req = strata.Request(env);
    req.params(function (err, params) {

      var max = parseInt(params.max);
      var criteria = {
        keyName: env.route.keyName,
        key: env.route.key,
        startsWith: true,
        max: isNaN(Math.min(max, maxSet)) ? config.maxSet : max
      };

      var stream = new ContactStream.BufferedSet();

      var resHeaders = {
        'content-type': 'application/json'
      };

      stream
        .on('end', function () {
          var body = JSON.stringify(stream.contacts);
          resHeaders['content-length'] = body.length;
          cb(200, resHeaders, body);
        })
        .on('error', function (error) {
          var body = JSON.stringify(error);
          resHeaders['content-length'] = body.length;
          cb(500, resHeaders, body);
        });

      // start searching
      source.searchSet(criteria, stream);

    });
  }); // GET /peeps/set/keyName/:key

  strata.post('/peeps/map/:keyName', function (env, cb) {
    var req = strata.Request(env);
    req.params(function (err, params) {
      console.log(util.inspect(params));
      var criteria = {
        keyName: env.route.keyName,
        keys: params.keys,
        startsWith: false,
        max: (params.keys || []).length
      };

      var stream = new ContactStream.BufferedMap(env.route.keyName);

      var resHeaders = {
        'content-type': 'application/json'
      };

      stream
        .on('end', function () {
          var body = JSON.stringify(stream.contacts);
          resHeaders['content-length'] = body.length;
          cb(200, resHeaders, body);
        })
        .on('error', function (error) {
          var body = JSON.stringify(error);
          resHeaders['content-length'] = body.length;
          cb(500, resHeaders, body);
        });

      // start searching
      source.searchMap(criteria, stream);

    });
  }); // POST /peeps/map/:keyName

}; // module
