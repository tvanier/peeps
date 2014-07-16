'use strict';

var path = require('path');

var config = {
  server: {
    port: 8080
  }
};

if (process.argv.length > 2) {
  try {

    config = require(path.join(process.cwd(), process.argv[2]));
  }
  catch (e) {
    console.log('cannot parse configuration ' + e);
  }
}

var http = require('http');
var peeps = require('./peeps');
var app = peeps(config);
http.createServer(app.callback()).listen(config.server.port);
