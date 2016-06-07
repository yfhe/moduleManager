var express = require('express');
var log4js = require('log4js');
//var modules = require('./modules');
var cnf = require('./config');
var bodyParser = require('body-parser');
/*
 * require module
 * */
/*var validModule = [];
cnf.modules && cnf.modules.forEach((obj) => {
  obj.name && obj.pathName && require(obj.pathName);
  validModule.push(obj.name);
});*/

var log = log4js.getLogger(__filename);
var musicApp = express();
/*body parser plugin */
musicApp.use(bodyParser.urlencoded({extended:false}));
//musicApp.use(bodyParser.json())

//var moduleMap = modules.map;
cnf.modules.forEach((obj) => {
  var tmp = require(obj.fpath);
  musicApp.use(tmp.routePath, tmp.subApp);
});

/*musicApp.get('/', (req,rep) => {
  log.info('req root');
  rep.send('hellow world!');
});*/
log.info('###start server on '+cnf.serverPort+'####');
musicApp.listen(cnf.serverPort);
