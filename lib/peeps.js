'use strict';

var strata = require('strata');
var ContactStream = require('./contactstream');
var util = require('util');


var LdapSource = function (config) {
  var ldap = require('ldapjs');

  var searchAttributes = [];
  var contactTemplate = config.contactTemplate || {};

  function _initSearchAttributes (map) {
    Object.keys(map).forEach(function (key) {
      if (typeof map[key] === 'string') {
        // direct mapping
        searchAttributes.push(map[key]);
      }
      else if (typeof map[key] === 'object') {
        // indirect mapping
        if (typeof map[key].ldap === 'string') {
          searchAttributes.push(map[key].ldap);
        }
        else {
          _initSearchAttributes(map[key]);
        }
      }
    });
  } // _initSearchAttributes
  _initSearchAttributes(contactTemplate);


  // initialize the LDAP client
  var url = 'ldap://' + config.host + ':' + config.port;
  var client = ldap.createClient({
    url: url,
    bindDN: config.credentials.user,
    bindCredentials: config.credentials.password,
    maxConnections: config.maxConnections || 2
  });

  this.searchName = function (criteria, stream) {
    criteria.filter = '(|'
        + '(' + contactTemplate['screenName'] + '=' + criteria.name + (criteria.startsWith ? '*)' : ')')
        + '(' + contactTemplate['displayName'] + '=' + criteria.name + (criteria.startsWith ? '*)' : ')')
        + '(' + contactTemplate['firstName'] + '=' + criteria.name + (criteria.startsWith ? '*)' : ')')
        + '(' + contactTemplate['lastName'] + '=' + criteria.name + (criteria.startsWith ? '*)' : ')')
        + ')';


    _search(criteria, stream);
  } // searchName

  this.searchMap = function (criteria, stream) {

      var ldapAttr = contactTemplate[criteria.keyName];
      if (!ldapAttr) {
        stream.emit('error', { message: 'missing key name' });
        return;
      }

      if (!util.isArray(criteria.keys)) {
        stream.emit('error', { message: 'missing keys' });
        return;
      }

      criteria.filter = '(|';
      criteria.keys.forEach( function (key) {
        criteria.filter += '(' + ldapAttr + '=' + key + ')';
      });
      criteria.filter += ')';

      _search(criteria, stream);
  } // searchMap

  function _search (criteria, stream) {
    criteria.controls = [];
    if (criteria.pageSize > 0) {
      criteria.controls.push(new ldap.PagedResultsControl({ value: { size: criteria.pageSize } }));
    }

    console.log(util.inspect(criteria));
    client.search(config.treebase, {
      scope: 'sub',
      filter: criteria.filter,
      attributes: criteria.attributes || searchAttributes,
      sizeLimit: typeof criteria.max === 'string' ? parseInt(criteria.max) : criteria.max
    },
    criteria.controls,
    function (ldapErr, ldapRes) {
      if (ldapErr) {
        // ldap search error
        stream.emit('error', ldapErr);
        return;
      }

      // ldapRes emits 'searchEntry', 'searchReference', end', 'error'
      ldapRes
        .on('searchEntry', function (entry) {
          var contact = _createContact(entry);
          stream.pushContact(contact);  
        })
        .on('end', function () {
          stream.push(null);
        })
        .on('error', function (err) {
          if (err.name == 'SizeLimitExceededError' || err.name == 'TimeLimitExceededError') {
            // partial result
            stream.push(null);
            return;
          }

          stream.emit('error', err);
        });

    });

  } // _search

  // transform an LDAP entry into a contact object
  function _createContact (entry) {
    var contact = {};
    var entityAttributes = entry.attributes || [];

    // transform entity attributes array into map
    // key is attribute type, value is array of values
    var attributes = {};
    for (var i = 0; i < entityAttributes.length; i++) {
      var attr = entityAttributes[i];
      attributes[attr.type] = attr.vals;
    }

    Object.keys(contactTemplate).forEach(function (key) {
      if (typeof contactTemplate[key] === 'string') {
        // direct mapping
        ldap = contactTemplate[key];

        var vals = attributes[ldap];
        if (vals) {
          vals.length == 1 ? contact[key] = vals[0] : contact[key] = vals;
        }
      }

      else if (typeof contactTemplate[key] === 'object') {
        contact[key] = {};

        for (var subkey in contactTemplate[key]) {
          ldap = contactTemplate[key][subkey];

          if (attributes[ldap]) {
            contact[key][subkey] = attributes[ldap][0]; //.replace(/[\(\)\-\s\[\]\.]/g, '');
          }
        }
      }
    }); // forEach

    return contact;
  } // _createContact



  // open the LDAP connection
  console.log('resolving LDAP host "' + config.host + '"');
  require('dns').resolve4(config.host, function (err) {
    if (err) {
      console.log('cannot resolve LDAP host "' + config.host + '"');
      return;
    }

    client.bind(
      config.credentials.user,
      config.credentials.password,
      function(err) {
        if (err) { console.log('cannot bind to LDAP directory: ' + err); }
        else     { console.log('connected to LDAP directory'); }
      }
    );
  });

}



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
    source = new LdapSource(config.ldap);
  }

  if (!source) {
    return;
  }

  strata.get('/peeps/stream/name/:name', function (env, cb) {
    // search by name, streamed response
    var req = strata.Request(env);
    req.params(function (err, params) {
      var criteria = {
        name: env.route.name,
        startsWith: true,
        pageSize: parseInt(params.pageSize)
      };

      var stream = new ContactStream.Readable();
      source.searchName(criteria, stream);

      var resHeaders = {
        'content-type': 'application/json-stream'
      };

      cb(200, resHeaders, stream);
    });
  });

  strata.get('/peeps/set/name/:name', function (env, cb) {
    // search by name, buffered response

    var req = strata.Request(env);
    req.params(function (err, params) {

      var criteria = {
        name: env.route.name,
        startsWith: true,
        max: params.max
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
      source.searchName(criteria, stream);

    });
  }); // GET /peeps/set/name/:name

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
