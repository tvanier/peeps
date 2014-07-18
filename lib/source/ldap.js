
var util = require('util');
var ldapjs = require('ldapjs');

module.exports.Source = function (config) {

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
  var client = ldapjs.createClient({
    url: url,
    bindDN: config.credentials.user,
    bindCredentials: config.credentials.password,
    maxConnections: config.maxConnections || 2
  });

  this.searchSet = function (criteria, stream) {
    var key = criteria.key || '';
    criteria.filter = 
        '(' + contactTemplate[criteria.keyName] + '=' + key + (criteria.startsWith ? '*)' : ')');

    _search(criteria, stream);
  } // searchSet

  this.searchMap = function (criteria, stream) {

      var ldapAttr = contactTemplate[criteria.keyName];
      if (!ldapAttr) {
        stream.emit('error', new Error('searchMap: missing key name'));
        return;
      }

      if (!util.isArray(criteria.keys)) {
        stream.emit('error', new Error('searchMap: missing keys'));
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
      criteria.controls.push(new ldapjs.PagedResultsControl({ value: { size: criteria.pageSize } }));
    }

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
          stream.write(contact);
        })
        .on('end', function () {
          stream.end();
        })
        .on('error', function (err) {
          if (err.name == 'SizeLimitExceededError' || err.name == 'TimeLimitExceededError') {
            // partial result
            stream.end();
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
