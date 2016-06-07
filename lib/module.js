var fs = require('fs');
var path = require('path');
var log4js = require('log4js');

var cnf = require('../config');
var {utils, EventFactory, MongoDB} = require('../util');

var logger = log4js.getLogger(path.basename(__filename));

class ModuleOperator extends EventFactory {
  constructor(){
    super();
    this.waitQueue = [];
    this.collMap = {
      //gcnf: 'ModuleCnf',
      meta: 'ModuleMetas',
      index: 'ModuleIndex'
    }
    //init meta ver
    // this.connectDb().then((conn) => {
    //   conn.query(this.collMap.index, {_id: 'cacheVer'}).then((data) => {
    //     //logger.info(data);
    //     if(!data || !data.length){
    //       conn.insert(this.collMap.index, {_id: 'cacheVer'}).then((data) => {
    //         //logger.info(data);
    //       });
    //     }
    //   });
    // })
    // this.connectDb().then((conn) => {
    //   conn.query(this.collMap.gcnf, {}, {}).then(datas)
    // })
  }
  connectDb(){
    return new Promise((done, fail) => {
      //logger.info('connect')
      if(this.connecting){
        return this.waitQueue.push(done);
      }
      if(this._con){
        done(this._con);
      }else{
        this.connecting = true;
        var mongoCnf = cnf.mongoCnf;
        (new MongoDB(mongoCnf.host, mongoCnf.port, mongoCnf.dbname)).then((con) => {
          this._con = con;
          this.connecting = false;
          //logger.info('connected');
          this.waitQueue.forEach((callFunc) => {
            callFunc(this._con);
          });
          this.waitQueue = [];
          done(this._con);
        }).catch((e) => {
          fail(null, e);
        });
      }
    });
  }
  getMetaIndex(name, gver){
    return new Promise((done, fail) => {
      var metaQuery = {};
      switch(utils._type(name)){
        case 'array':
          metaQuery.name = {'$in': name};
        break;
        case 'string':
          metaQuery.name = name;
        break;
        default:
          metaQuery.gver = {'$gte': gver};
        break;
      }
      this.connectDb().then((conn) => {
        //logger.info('query start!', conn, metaQuery);
        conn.query(this.collMap.index, metaQuery, {}).then((datas) => {
          //logger.info('query done!', datas);
          done(datas);
        }).catch((e) => {
          fail(e);
        });
      }).catch((e) => {
        fail(e);
      });
    })
  }
  getMetas(meta_id){
    return new Promise((done, fail) => {
      var metaQuery = {};
      switch(utils._type(meta_id)){
        case 'array':
          metaQuery._id = {'$in': meta_id};
        break;
        case 'string':
          metaQuery._id = meta_id;
        break;
        default:
          return fail('invalid meta id!');
        break;
      }
      this.connectDb().then((conn) => {
        //logger.info('query start!');
        conn.query(this.collMap.meta, metaQuery, {}).then((datas) => {
          done(datas);
        }).catch((e) => {
          fail(e);
        });
      }).catch((e) => {
        fail(e);
      });
    })
  }
  addIndexVer(conn){
    //logger.info('start add ver!');
    return conn.findAndModify(this.collMap.index, {_id: 'cacheVer'}, {'$inc':{'gver':1}}, {upsert:true, w:1, returnOriginal: false});
  }
  updateModule(orgin, update){
    return new Promise((done, fail) => {
      var query, doc;
      if(orgin && update && orgin.name && orgin.ver){
        query = {name: orgin.name, ver: orgin.ver};
        //logger.info('update start!');
        return this.connectDb().then((conn) => {
          conn.query(this.collMap.index, query, {}).then((data) => {
            if(data && data.length){
              var metaId = data[0].meta;
              // let tmp = {};
              // update.name && (tmp.name=update.name);
              // update.ver && (tmp.ver=update.ver);
              // update.meta && (tmp.meta=update.meta);
              doc = {'$set':utils.filterSqlInsert(update)};
              conn.update(this.collMap.meta, {_id: metaId}, doc).then((info) => {
                done(true, info);
              }).catch((e) => {
                fail(e);
              })
            }else{
              fail('module:'+orgin.name+' ver:'+orgin.ver+'not exist!');
            }
          }).catch((e) => {
            fail(e);
          })
        }).catch((e) => {
          fail(e);
        });
      }
      fail('name or ver invalid!');
    });
  }
  addModule(name, ver, metas){
    return new Promise((done, fail) => {
      if(name && ver){
        this.connectDb().then((conn) => {
          conn.query(this.collMap.index, {name: name, ver:ver}, {}).then((data) => {
            if(!data || !data.length){
              conn.insert(this.collMap.meta, metas, {}).then((resp) => {
                ////logger.info('add module', info);
                var _id = resp.ops[0] && resp.ops[0]._id;
                //logger.info('insert meta done!');
                if(_id){
                  this.addIndexVer(conn).then((data) => {
                    // //logger.info(data);
                    var curVer = data.value.gver;
                    conn.insert(this.collMap.index, {name: name, ver: ver, meta: _id, gver: curVer}, {}).then((resp) => {
                      done(curVer);
                    }).catch((e) => {
                      fail(e);
                    });
                  }).catch((e) => {
                    faile(e);
                  });
                  
                }
              }).catch((e) => {
                fail(e);
              })
            }else{
              fail('module:'+name+' with ver:'+ver+'is exist!');
            }
          }).catch((e) => {
            fail(e);
          })
        }).catch((e) => {
          fail(e);
        })
      }else{
        fail('invalid parmas!');
      }
    });
  }
}

module.exports = new ModuleOperator();