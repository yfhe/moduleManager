module.exports = {
  modules: [
  //  {
  //    name: 'admin',
  //    fpath: './router/admin'
  //  },
   {
     name: 'api',
     fpath: './router/api'
   }
  ],
  mongoCnf: {
    host: 'local.yfhe.site',
    //host: 'localhost',
    port: 27017,
    dbname: 'SinaWapModules'
  },
  serverPort: 8089
};
