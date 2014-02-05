# peeps
[![Build Status](https://travis-ci.org/tvanier/peeps.png?branch=master)](https://travis-ci.org/tvanier/peeps)

A streaming REST API to access contact information, built with Strata http://stratajs.org  
peeps allows to access contact resources (such as a directory) via a simple REST API. Contact properties (name, email, address ...) are fully configurable. Some use cases:
- predictive search (by display name for example)
- data synchronization

peeps is 100% JavaScript, it supports LDAP sources for now, thanks to the awesome http://ldapjs.org  
Tested with node 0.10 and a directory of more than 60K entries.

## API

### Retrieve a set of contacts

**GET /peeps/set/:keyName/:key?max=:max**

Search for contacts whose :keyName *starts with* :key. Typical use case: predictive search, for example  
```
GET /peeps/set/displayName/Thomas
GET /peeps/set/screenName/tva?max=10
```
The length of the returned set can be limited to :max elements. If not specified, :max defaults to the maxSetSize global search parameter configured on the peeps node.

Returns a set (JSON array) of unique contact objects.


**GET /peeps/stream/:keyName/:key?pageSize=:pageSize**

Search for contacts whose :keyName starts with :key. Typical use case: data synchronization, for example  
```
GET /peeps/stream/email/a
```
Returns a sequence of contiguous JSON contact objects like
```
{contact1}{contact2}...{contactN}  
```
Not trivial to parse, I plan to try https://github.com/dscape/clarinet


### Retrieve a map of contacts

**POST /peeps/map/:keyName**

Search for contacts whose specified keyName *matches* the one(s) passed as an array in the request body.  

Example:
```
curl -X POST http://localhost:8080/peeps/map/screenName -d "{ \"keys\": [\"tvanier\"] }" --header "Content-Type:application/json"
```

## Configuration

Currently peeps is configured via a single JSON file, which contains different sections.  
The configuration can be passed to the peeps init function. Each contact source can be configured via a property of the global configuration object, see below an example with the ldap source.

### Global search parameters

The global search parameters are configured in the "search" property of the global configuration object.  
The available search parameters are:
- maxSetSize (Number): the maximum size of a returned set of contacts, default is 20
```
{
  ...
  "search": {
    "maxSetSize": 15
  }
}
```

### LDAP source

An LDAP source is configured via an "ldap" property of the global configuration object. The ldap-specific settings contain the ldap host and port, some connection credentials, the search tree base, and the contact template, which maps peeps attributes to source ones. The current contactTemplate accepts a 2-level mapping, either direct with String values (ex: "screenName" below) or one nested object (ex: phoneNumbers below).
```
{
  ...
  "ldap": {
    "host": "myldap.com",
    "port": 389,
    "credentials": {
      "user":"CN=peeps,DC=myldap,DC=com",
      "password":"secret"
    },
    "treebase": "OU=Employees,DC=myldap,DC=com",
    "contactTemplate": {
      "distinguishedName": "distinguishedName",
      "screenName":"cn",
      "firstName": "firstName",
      "lastName": "lastName",
      "displayName": "fullName",
      "email": "mail",
      "phoneNumbers":{
          "work": "telephoneNumber",
          "mobile":"mobile"
      }
    }
  }
}
```

## Sample server 
The peeps sample server (lib/server.js) accepts a "server" configuration object where the listening port (default is 8080) can be specified:s
```
{
  ...
  "server": {
    port: 8088
  }
}
```

The sample server can be started with
```
node lib/server.js myconfig.json
```
