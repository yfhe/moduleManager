"use strict"
var path = require('path');
var log4js = require('log4js');
var express = require('express');
var {utils} = require('../util');
var APICODE = require('../util/apiCode');
var modelOperator = require('../lib/module');

var logger = log4js.getLogger(path.basename(__filename));
var subApp = express();
var routePath = '/api';

subApp.get('/moduleIndex', (req, res) => {
    var query = req.query;
    var moduelName = query.name && query.name.split(',');
    var gver = (query.gver && parseInt(query.gver)) || 0;
    modelOperator.getMetaIndex(moduelName, gver).then((data) => {
      //filter
      var ret = {
        indexs: [],
        curVer: 0
      };
      data.forEach((item) => {
        if(item._id === 'cacheVer'){
          ret.curVer = item.gver;
        }else{
          ret.indexs.push({
            name: item.name,
            ver: item.ver,
            metaId: item.meta
          });
        }
        // item._id && (delete item._id);
        // item.gver && (delete item.gver);
      });
      res.send({status: APICODE.ok, message: 'success', data: ret});
    }).catch((err) => {
      return res.send({status: APICODE.unknowError, message: (e instanceof Error ? e.message : e)});
    })
});

subApp.use('/module', (req, res) => {
  switch(req.method){
    case 'GET':
      var query = req.query;
      if(utils.getParams(res, query, ['metaId'])){
        modelOperator.getMetas(query.metaId.split(',')).then((data) =>{
          //filter
          data.forEach((item) => {
            item._id &&(item.id=item._id) && (delete item._id);
          });
          res.send({status: APICODE.ok, message: 'success', data: data});
        }).catch((e) => {
          return res.send({status: APICODE.unknowError, message: (e instanceof Error ? e.message : e)});
        });
      }
    break;
    case 'POST':
      var infos = req.body;
      if(utils.getParams(res, infos, ['name', 'ver', 'meta'])){
        logger.info('start insert!');
        infos.meta = JSON.parse(infos.meta);
        modelOperator.addModule(infos.name, infos.ver, infos.meta).then((ver) => {
          return res.send({status: APICODE.ok, message: 'success', data: {ver: ver}});
        }).catch((e) => {
          //logger.error(e);
          return res.send({status: APICODE.unknowError, message: (e instanceof Error ? e.message : e)});
        });
      }
    break;
    // case 'DELETE':
    // break;
    case 'PUT':
      var infos = req.body;
      if(utils.getParams(res, infos, ['orgname', 'orgver', ['name', 'ver', 'meta']])){
        logger.info('start update!');
        try{
          infos.meta && (infos.meta=JSON.parse(infos.meta));
        }catch(err){
          delete infos.meta;
        }
        modelOperator.updateModule({name:infos.orgname, ver:infos.orgver}, {name:infos.name, ver:infos.ver, meta:infos.meta}).then((status) => {
          res.send({status: APICODE.ok, message: 'success'});
        }).catch((e) => {
          return res.send({status: APICODE.unknowError, message: (e instanceof Error ? e.message : e)});
        });
      }
    break;
    default:
      return res.send({status: APICODE.permissionDeny, message: 'no resp!'})
  }
});

// subApp.use('/search', (req, res) => {
//   switch(req.method){
//     case 'GET':
//       var query = req.query;
//       if(utils.getParams(res, query, [['id','title','singer'], 'type'])){
//         switch(query.type){
//           case 'music':
//             try{
//               musicModule.Music.search((data) => {
//                 res.send({status: APICODE.ok, message: 'success', data: data});
//               }, query);
//             }catch(err){
//               return res.send({status: APICODE.unknowError, message: err.message});
//             }
//           break;
//           default:
//           break;
//         }
//       }
//     break;
//     case 'POST':
//     default:
//       return res.send({status: APICODE.permissionDeny, message: 'no resp!'});
//     //break;
//   }
// });

module.exports = {
  routePath: routePath,
  subApp: subApp,
};