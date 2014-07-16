'use strict';


var koa = require('koa');
var router = require('koa-router');
var parse = require('co-body');
var app = koa();

var settings = {
  maxSet: 20
};

module.exports = peeps;

function peeps (config) {

  app.use(router(app));

  app.get('/peeps/ping', pong);

  // absolute maximum number of results in set
  if (config.maxSet) {
    settings.maxSet = parseInt(config.maxSet);
  }

  var source = null;
  if (config && config.ldap) {
    var LdapSource = require('./source/ldap');
    source = new LdapSource.Source(config.ldap);
  }

  if (!source) {
    // no route
    return app;
  }

  var PeepsStream = require('./peepsstream');

  // search by keyName, buffered response
  // example: /peeps/set/displayName/Thomas
  app.get('/peeps/set/:keyName/:key', function *() {
    yield searchSet(source, new PeepsStream.BufferedSet(), settings.maxSet);
  });

  // search by keyName, streamed response
  // example: /peeps/stream/set/displayName/Thomas
  app.get('/peeps/stream/:keyName/:key', function *() {
    yield searchSet(source, new PeepsStream.Transform());
  });


  app.post('/peeps/map/:keyName', function *() {
    yield searchMap(source, new PeepsStream.BufferedMap(this.params.keyName));
  });

  return app;

} // function peeps

function *pong () {
  this.body = 'pong';
  this.set({
    'Content-Type': 'text/plain',
    'Content-Length': this.body.length
  });
}

function searchSet (source, stream, maxSet) {

  return function *(next) {

    this.set({
      'Content-Type': 'application/json'
    });

    this.body = stream;

    stream.on('error', this.onerror);

    var criteria = {
      keyName: this.params.keyName,
      key: (this.params.key || '').replace(/%20/g, ' '),
      startsWith: true
    };

    var max = parseInt(this.request.query.max);
    if (isNaN(max)) {
      criteria.max = maxSet;
    }
    else {
      if (isNaN(maxSet)) {
        criteria.max = max;
      }
      else {
        criteria.max = Math.min(max, maxSet);
      }
    }

    var pageSize = parseInt(this.request.query.pageSize);
    criteria.pageSize = isNaN(pageSize) ? 20 : pageSize;

    // start searching
    source.searchSet(criteria, stream);

  };
} // searchSet


function searchMap (source, stream) {

  return function *(next) {

    this.set({
      'Content-Type': 'application/json'
    });

    this.body = stream;

    stream.on('error', this.onerror);

    // start searching
    var reqBody = yield parse(this);
    var keys = reqBody.keys || [];
    var criteria = {
      keyName: this.params.keyName,
      keys: keys,
      startsWith: false,
      max: keys.length
    };

    source.searchMap(criteria, stream);

  };
} // searchMap

