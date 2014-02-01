# peeps

A streaming REST API to access contact information, built with Strata http://stratajs.org
peeps allows to access contact resources (such as a directory) via a simple REST API. Contact properties (name, email, address ...) are fully configurable. Some use cases:
- predictive search by name
- data synchronization

peeps is 100% JavaScript, it supports LDAP sources for now, thanks to the awesome http://ldapjs.org
Tested with node 0.10 and a directory of more than 60K entries.

## API

### Search by name

**GET /peeps/set/name/:name?max=:max**

Search for contacts whose name *starts with* :name
Typical use case: predictive search

Returns a set (JSON array) of unique contact objects.


**GET /peeps/stream/name/:name?pageSize=:pageSize**

Search for contacts whose name starts with :name
Typical use case: data synchronization

Returns a sequence of JSON contact objects. Not trivial to parse, I plan to try https://github.com/dscape/clarinet

### Search by key

**POST /peeps/map/:keyName**

Search for contacts whose specified keyName *matches* the one(s) passed as an array in the request body.

Example:
    curl -X POST http://localhost:8080/peeps/map/screenName -d "{ \"keys\": [\"tvanier\"] }" --header "Content-Type:application/json"


## Configuration

The peeps sample server (lib/server.js) accepts a JSON file where the listening port can be specified:
```
{
  port: 8088
}
```

The configuration can be passed to the peeps init function. Each contact source can be configured via a property of the global configuration object, see below an example with the ldap source.

### LDAP source

An LDAP source is configured via an "ldap" property of the global configuration object. The ldap-specific settings contain the ldap host and port, some connection credentials, the search tree base, and the contact template, which maps peeps attributes to source ones.

```
{
  "port": 8088,
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