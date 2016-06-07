var path = require('path');
var fs = require('fs');
var assert = require('assert');

var log4js = require('log4js');
var request = require('request');
var url = require('url');
var through2 = require('through2');
var svn = require('svn-interface');

var {utils, FileCache} = require('../util');
var logger = log4js.getLogger(path.basename(__filename));

class ModuleClient{
  constructor(){
    //default cnf
    this.cnf = {
      cachePath: './cache',
      cacheTimeout: 86400,
      api:{
        host: 'http://localhost:8089/',
        path: {
          index: 'api/moduleIndex',
          module: 'api/module'
        },
        validMethod: ['POST', "GET", "PUT", "DELETE"]
      },
      curVer: 0
    };
    
    // this.fileCacheIns = new FileCache(this.cnf.cachePath, 100);
    this.moduleIndex = {};
    // var moduleIndexCacheContent = this.fileCacheIns.getCache('moduleIndex')
  }
  sendRequest(method, type, data){
    return new Promise((done, fail) => {
      var apiCnf = this.cnf.api;
      var params;
      if(!apiCnf.path.hasOwnProperty(type) || apiCnf.validMethod.indexOf(method) === -1){
        return fail('invalid request params!');
      }
      params = {
        method: method,
        url: url.resolve(apiCnf.host, apiCnf.path[type]),
      };
      if(method === 'GET'){
        params.url += '?' + data;
      }else{
        utils.extend(params, {
          //json: true,
          // body: data,
          // headers: {
          //   'Content-Type':'application/x-www-form-urlencoded'
          // }
          form: data
        });
      }
      logger.debug('ready for sent', params);
      request(params).pipe(through2(function(chunk, enc, cb){
        logger.debug('receiving data……');
        !this.respContent && (this.respContent='');
        this.respContent += chunk;
        cb();
      }, function(cb){
        logger.debug('receive done!');
        try{
          done(JSON.parse(this.respContent))
        }catch(err){
          logger.error(this.respContent);
        }
        fail('invalid resp!');
      }))
    });
  }
  updateIndex(ver){
    ver = ver || this.cnf.curVer || 0;
    return new Promise((done, fail) => {
      logger.debug('start update!');
      this.sendRequest('GET', 'index', 'gver='+ver).then((resp) => {
        if(!resp || resp.status !== 0){
          return fail(resp.message);
        }
        if(resp.data.curVer > ver){
          resp.data.indexs.forEach((indexItem) => {
            var indexKey = this.buildIndexKey(indexItem);
            indexKey && indexItem.metaId && (this.moduleIndex[indexKey]=indexItem.metaId);
          });
          this.cnf.curVer = resp.data.curVer;
        }
        done(this.moduleIndex);
      }).catch((err) => {logger.error(err);fail(e)});
    })
  }
  findModule(name){
    return new Promise((done, fail) => {
      this.sendRequest('GET', 'index', 'name='+name).then((resp) => {
        if(resp && resp.status == 0){
          var existVer = [];
          resp.data.indexs.forEach((item) => {
            existVer.push(item.ver);
          });
          done(existVer);
        }else{
          fail(resp && resp.message);
        }
      });
    })
  }
  buildIndexKey(indexItem){
    if(indexItem.name && indexItem.ver){
      return indexItem.name+'_'+indexItem.ver;
    }
    return null;
  }
  getInfoFromSvn(fpath){
    return new Promise((done, fail) => {
      logger.debug(fpath);
      fpath = path.resolve(fpath);
      logger.debug(fpath);
      if(fs.existsSync(fpath)){
        svn.info(fpath, {}, (e, data) => {
          logger.debug(data);
          assert.equal(e, null);
          var metaInfo = data.info.entry;
          var ftype = metaInfo._attribute.kind;
          if(ftype !== 'file'){
            fail('file type ' + ftype + 'not support now!');
          }
          var ret = {
            type: 'svn',
          };
          ret.url = metaInfo.url._text;
          ret.submiter = metaInfo.commit.author._text;
          ret.date = new Date(metaInfo.commit.date._text).getTime();
          ret.curRevision = metaInfo.commit._attribute.revision;
          done(ret);
        })
      }else{
        fail('path not exist!');
      }
    })
  }
  prevSubmit(fpath, name, ver, submiter, desc){
    return new Promise((done, fail) => {
      if(!/^http/.test(fpath)){ //本地文件
        this.getInfoFromSvn(fpath).then((metaInfo) => {
          metaInfo.desc = desc;
          submiter && (metaInfo.submiter = submiter);
          this.submitModule(name, ver, metaInfo).then((data) => {
            if(data){
              done('add success!');
            }else{
              done('update success!');
            }
          });
        }).catch((err) => {
          logger.error(err);
          fail('获取svn 信息失败！');
        })
      }else{
        var metaInfo = {
          type: 'http',
          url: fpath,
          submiter: submiter,
          desc: desc,
          date: date.now()
        }
        this.submitModule(name, ver, metaInfo).then((data) => {
          if(data){
              done('add success!');
            }else{
              done('update success!');
            }
        });
      }
    });
  }
  submitModule(name, ver, metaInfo){
    return new Promise((done, fail) => {
      this.updateIndex().then((indexMap) => {
        var indexKey = this.buildIndexKey({name: name, ver: ver});
        if(indexMap.hasOwnProperty(indexKey)){
          this.sendRequest('PUT', 'module', {
            orgname: name,
            orgver: ver,
            meta: JSON.stringify(metaInfo)
          }).then((resp) => {
            if(resp && resp.status == 0){
              done(resp.data);
            }else{
              fail(resp && resp.message);
            }
          });
        }else{
          this.sendRequest('POST', 'module', {
            name: name,
            ver: ver,
            meta: JSON.stringify(metaInfo)
          }).then((resp) => {
            if(resp && resp.status == 0){
              done();
            }else{
              fail(resp && resp.message);
            }
          });
        }
      })
    })
  }
  getModuleByIds(ids){
    return new Promise((done, fail) => {
      ids = utils._type(ids) === 'string' ? [ids] : ids;
      this.sendRequest('GET', 'module', 'metaId='+ids.join(',')).then((resp) => {
        logger.debug(resp)
        if(!resp || resp.status !== 0){
          return fail(resp.message);
        }
        var retMap = {};
        resp.data.forEach((item) => {
          item.curRevision && (item.url+='@'+item.curRevision);
          retMap[item.id] = {
            type: item.type,
            url: item.url
          }
        });
        done(retMap);
      }).catch((err) => {fail(err)});
    })
  }
  getModule(name, ver){
    return new Promise((done, fail) => {
      var indexKey = this.buildIndexKey({name: name, ver: ver});
      this.updateIndex().then((indexMap) => {
        if(indexMap.hasOwnProperty(indexKey)){
          var metaId = indexMap[indexKey];
          this.getModuleByIds(metaId).then((retMap) => {
            if(retMap.hasOwnProperty(metaId)){
              done(retMap[metaId]);
            }else{
              done(null);
            }
          }).catch((err) => {fail(err)});;
        }else{
          done(null);
        }
      }).catch((err) => {fail(err)});
    });
  }
}

module.exports = new ModuleClient();