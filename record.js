var http = require('http');
var yakbak = require('./index');

http.createServer(yakbak('http://BHPBIO-10000573', {
  dirname: __dirname + '/tapes',
  ignore: true
})).listen(3000);