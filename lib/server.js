'use strict';

var fs = require('fs');
var path = require('path');

var config = {
  port: 8080
};

if (process.argv.length > 2) {
  try {

    config = require(path.join(process.cwd(), process.argv[2]));
  }
  catch (e) {
    console.log('cannot parse configuration ' + e);
  }
}

var strata = require('strata');

function defaultHandler (env, cb) {

  // default request handler
  var body = 'no route exists for ' + env.pathInfo;
  var response = strata.Response(env);
  response.status = 404;
  response.contentType = 'text/html';
  response.contentLength = Buffer.byteLength(body);
  response.body = body;
  response.send(cb); 

}

//strata.use(strata.contentLength);
strata.use(strata.commonLogger);

strata.run(defaultHandler,
  {
    port: config.port
  }
);

var peeps = require('./peeps');
peeps.init(config);
