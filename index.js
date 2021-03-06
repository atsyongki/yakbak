// Copyright 2016 Yahoo Inc.
// Licensed under the terms of the MIT license. Please see LICENSE file in the project root for terms.

var Promise = require('bluebird');
var hash = require('incoming-message-hash');
var assert = require('assert');
var mkdirp = require('mkdirp');
var path = require('path');
var buffer = require('./lib/buffer');
var proxy = require('./lib/proxy');
var record = require('./lib/record');
var curl = require('./lib/curl');

/**
 * Returns a new yakbak proxy middleware.
 * @param {String} host The hostname to proxy to
 * @param {Object} opts
 * @param {String} opts.dirname The tapes directory
 * @param {Boolean} opts.noRecord if true, requests will return a 404 error if the tape doesn't exist
 * @returns {Function}
 */

module.exports = function (host, opts) {
  // debug('opts', opts);
  assert(opts.dirname, 'You must provide opts.dirname');

  var debug = require('debug')('yakbak:server:' + host);
  
  return function (req, res) {
    
    debug('req', req.url);

    tapename = opts.tapename || tapename;

    return buffer(req).then(function (body) {
      var file = path.join(opts.dirname, tapename(req, body, opts.ignore));

      return Promise.try(function () {
        return require.resolve(file);
      }).catch(ModuleNotFoundError, function (/* err */) {

        if (opts.noRecord) {
          throw new RecordingDisabledError('Recording Disabled');
        } else {
          mkdirp.sync(opts.dirname);
          return proxy(req, body, host, opts.preFlight).then(function (pres) {
            if(pres == undefined){
              console.log('url:' + req.url +' - could not found existing file and unable to connect to server');
              res.statusCode = 404;
              res.end();
              return null;
            }
            else
              return record(pres.req, pres, file);
          });
        }

      });
    }).then(function (file) {
      if(file == null)
        return null;
      console.log('url:' + req.url + ' tapes file:' + file);
      return require(file);
    }).then(function (tape) {
      if(tape == null)
        return null;
      return tape(req, res);
    }).catch(RecordingDisabledError, function (err) {
      /* eslint-disable no-console */
      console.log('An HTTP request has been made that yakbak does not know how to handle');
      console.log(curl.request(req));
      /* eslint-enable no-console */
      res.statusCode = err.status;
      res.end(err.message);
    });

  };

};

/**
 * Returns the tape name for `req`.
 * @param {http.IncomingMessage} req
 * @param {Array.<Buffer>} body
 * @returns {String}
 */

function tapename(req, body, ignore) {
  return hash.sync(req, Buffer.concat(body), null, null, ignore) + '.js';
}

/**
 * Bluebird error predicate for matching module not found errors.
 * @param {Error} err
 * @returns {Boolean}
 */

function ModuleNotFoundError(err) {
  return err.code === 'MODULE_NOT_FOUND';
}

/**
 * Error class that is thrown when an unmatched request
 * is encountered in noRecord mode
 * @constructor
 */

function RecordingDisabledError(message) {
  this.message = message;
  this.status = 404;
}

RecordingDisabledError.prototype = Object.create(Error.prototype);
