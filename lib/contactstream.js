
var stream = require('stream');
var events = require('events');
var util = require('util');


var ContactStream = module.exports;


ContactStream.Readable = function () {
  stream.Readable.call(this);

  var canPush = false;

  // implements Readable
  this._read = function (size) {
    canPush = true;
  }

  this.pushContact = function (contact) {
    if (canPush) {
      canPush = this.push(JSON.stringify(contact));
    }

    // drop contact object?
  }

} // ContactStream.Readable
util.inherits(ContactStream.Readable, stream.Readable);


// base class for buffered streams
ContactStream.Buffered = function () {
  events.EventEmitter.call(this);

  this.push = function (data) {
    if (data == null) {
      this.emit('end');
    }
  }

} // ContactStream.Buffered
util.inherits(ContactStream.Buffered, events.EventEmitter);


ContactStream.BufferedSet = function () {
  ContactStream.Buffered.call(this);
  
  this.contacts = [];

  this.pushContact = function (contact) {
    this.contacts.push(contact);
  }

} // ContactStream.BufferedList
util.inherits(ContactStream.BufferedSet, ContactStream.Buffered);


ContactStream.BufferedMap = function (keyName) {
  ContactStream.Buffered.call(this);

  this.keyName = keyName;
  this.contacts = {};

  this.pushContact = function (contact) {
    this.contacts[contact[this.keyName]] = contact;
  }

} // ContactStream.BufferedMap
util.inherits(ContactStream.BufferedMap, ContactStream.Buffered);
