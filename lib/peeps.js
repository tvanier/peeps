'use strict';


var koa = require('koa');
var cors = require('koa-cors');
var router = require('koa-router');
var parse = require('co-body');
var app = koa();

var settings = {
  maxSet: 20
};

module.exports = peeps;

function peeps (config) {

  config = config || {};

  app.use(cors(config.cors));

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
    this.criteria = {};
    this.maxSet = settings.maxSet;

    yield searchSet(source, new PeepsStream.BufferedSet());
  });

  // search by keyName, streamed response
  // example: /peeps/stream/set/displayName/Thomas
  app.get('/peeps/stream/:keyName/:key', function *() {
    this.criteria = {};
    var pageSize = parseInt(this.request.query.pageSize);
    this.criteria.pageSize = isNaN(pageSize) ? 20 : pageSize;
    
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

function searchSet (source, stream) {

  return function *(next) {

    this.set({
      'Content-Type': 'application/json'
    });

    stream.on('error', this.onerror);

    this.criteria = this.criteria || {};
    this.criteria.keyName = this.params.keyName;
    this.criteria.key = (this.params.key || '').replace(/%20/g, ' ');
    this.criteria.startsWith = true;

    var max = parseInt(this.request.query.max);
    if (isNaN(max)) {
      this.criteria.max = this.maxSet;
    }
    else {
      if (isNaN(this.maxSet)) {
        this.criteria.max = max;
      }
      else {
        this.criteria.max = Math.min(max, this.maxSet);
      }
    }

    this.body = stream;
    source.searchSet(this.criteria, stream);
  };
} // searchSet


function searchMap (source, stream) {

  return function *(next) {

    this.set({
      'Content-Type': 'application/json'
    });

    stream.on('error', this.onerror);

    // start searching
    var reqBody = yield parse(this);
    var keys = reqBody.keys || [];

    this.criteria = this.criteria || {};
    this.criteria.keyName = this.params.keyName;
    this.criteria.keys = keys;
    this.criteria.startsWith = false;
    this.criteria.max = keys.length;

    this.body = stream;
    source.searchMap(this.criteria, stream);
  };
} // searchMap

