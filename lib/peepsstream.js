
var stream = require('stream');
var events = require('events');
var util = require('util');


var PeepsStream = module.exports;


PeepsStream.Transform = function (options) {
  stream.Transform.call(this, options || {});
  this._writableState.objectMode = true;

  // implements Transform
  this._transform = function (data, encoding, callback) {
    this.pushStringify(data, callback);
  }

  this.pushStringify = function (data, callback) {
    try {
      this.push(JSON.stringify(data));
    }
    catch (e) {
      callback(e);
      return;
    }

    callback();
  }

} // PeepsStream.Transform
util.inherits(PeepsStream.Transform, stream.Transform);



PeepsStream.BufferedSet = function (options) {
  PeepsStream.Transform.call(this, options);
  
  this.set = [];

  // implements Transform
  this._transform = function (entry, encoding, callback) {
    this.set.push(entry);

    callback();
  }

  this._flush = function (callback) {
    this.pushStringify(this.set, callback);
  }

} // PeepsStream.BufferedSet
util.inherits(PeepsStream.BufferedSet, PeepsStream.Transform);


PeepsStream.BufferedMap = function (keyName, options) {
  PeepsStream.Transform.call(this, options);

  this.keyName = keyName;
  this.map = {};

  // implements Transform
  this._transform = function (entry, encoding, callback) {
    this.map[entry[this.keyName]] = entry;

    callback();
  }

  this._flush = function (callback) {
    this.pushStringify(this.map, callback);
  }

} // PeepsStream.BufferedMap
util.inherits(PeepsStream.BufferedMap, PeepsStream.Transform);
