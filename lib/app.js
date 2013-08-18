var http = require('http'), https = require('https'), url = require('url'), fs = require('fs');
var db = require('mongoose');
var Log = require('log'), log = new Log('info');
var express = require('express'), ejs = require('ejs');
var q = require('promised-io/promise'), Deferred = q.Deferred;

var csv = require(__dirname+'/csv-export.js');
exports.csv = csv;
var routes = require(__dirname+'/routes.js');
var routesMiddleware = [];
var modelDefinitionFiles = [];
var models = [];
exports.models = models;
var app = null, webServer = null;
var fileStore = {};  
var configuration = null;
var APP_VERSION = null;

var loadStaticAssets = function (req, res) {    
  var extension = req.params[1].substring(req.params[1].lastIndexOf('.') + 1);
  var binary = false;
  if (extension === 'css') res.set('Content-Type', 'text/css');
  else if (extension === 'js') res.set('Content-Type', 'application/javascript');
  else if (extension === 'png') { binary = true; res.set('Content-Type', 'image/png'); }
  else if (extension === 'gif') { binary = true; res.set('Content-Type', 'image/gif'); }
  if (process.env.NODE_ENV  === 'development') res.setHeader('Cache-Control', 'no-cache,no-store');
  else res.setHeader('Cache-Control', 'max-age=172800,public'); 
  if (fileStore[req.params[1]]) res.send(200, fileStore[req.params[1]]);
  else {
    var file = __dirname + '/external/'+req.params[0]+req.params[1];
    if (binary) {
      fs.stat(file, function (err, stat) {
        if (err) {
          res.send(404);
        } else {
          var img = fs.readFileSync(file);        
          res.contentLength = stat.size;
          res.end(img, 'binary');
        }
      });
    } else {
      fs.readFile(file, 'utf8', function(err, data) {  
      if (err === null) {
        res.send(200, data);        
      } else {
        log.error(err);
        res.send(404);
      } 
      });
    }
  } 
};


function ConfigurationException(message) {
   this.message = message;
   this.name = "ConfigurationException";
}


/*
    #### ##    ## #### ######## 
     ##  ###   ##  ##     ##    
     ##  ####  ##  ##     ##    
     ##  ## ## ##  ##     ##    
     ##  ##  ####  ##     ##    
     ##  ##   ###  ##     ##    
    #### ##    ## ####    ##    
*/
var start = function(configuration_, callback) {
  if (typeof(configuration_) !== 'object') throw new ConfigurationException('No configuration given!');
  else configuration = configuration_;
  var modelDefinitions = null;
  // general  
  if (typeof(configuration.web) === 'undefined') throw new ConfigurationException('Web configuration missing');
  else if (typeof(configuration.modelDefinitionFile) === 'undefined') {    
    if (typeof(configuration.modelDefinitions) === 'undefined') {
      throw new ConfigurationException('You have to specify a file with the model definitions or the modeldefinitions via require');
    } else {
      modelDefinitions = configuration.modelDefinitions;
    }
  }
  else if (typeof(configuration.modelDefinitionFile) === 'string') modelDefinitionFiles.push(configuration.modelDefinitionFile);
  else if (typeof(configuration.modelDefinitionFile) === 'object') modelDefinitionFiles = configuration.modelDefinitionFile;
  // get the models
  // beware: node will not load these files froman other location than his home dir (__dirname)
  if (modelDefinitions === null) {
    // from files
    for (i = 0, ix = modelDefinitionFiles.length; i < ix; ++i) {
      modelDefinitions = require(modelDefinitionFiles[i]);    
      for (var m in modelDefinitions) {    
        for (var n in modelDefinitions[m]) {
          if (n === 'modelName')  {      
            models.push(modelDefinitions[m]);
          }
        }
      }
    }
  } else {
    // from given object
    // @TODO: make dry
    for (var m in modelDefinitions) {         
      for (var n in modelDefinitions[m]) {
        if (n === 'modelName')  {      
          models.push(modelDefinitions[m]);
        }
      }
    }
  }
  if (models.length === 0) throw new ConfigurationException('No models found in file "'+modelDefinitionFile+'"');  
  // Testing Models via promise-io (see countForModel function)
  var arrayOfPromises = [];
  for (var m = 0, mx = models.length; m < mx; ++m) arrayOfPromises.push(countForModel(models[m]));
  var group = q.all(arrayOfPromises);  // execute promise
  group.then(function(resultArray){    
    log.info('mongodbview - %s models found', resultArray.length);
    routes.setModels(models);
    for (var r = 0, rx = resultArray.length; r < rx; ++r) log.info('mongodbview - testing models: name=%s, count=%s', resultArray[r].name, resultArray[r].count);    
    // express setup
    if (typeof(configuration.web.host) !== 'string') throw new ConfigurationException('You have to specify the web host!');
    else if (typeof(configuration.web.port) !== 'number') throw new ConfigurationException('You have to specify the web port!');
    app = express();
    app.configure(function(){
      app.set('views', __dirname + '/views');
      app.set('view engine', 'ejs');
    });
    configuration.web.dumpExceptions = configuration.web.dumpExceptions || true;
    configuration.web.showStack = configuration.web.showStack || true;
    configuration.web.cookiesecret = configuration.web.cookiesecret || 'simplemongodbviewercookiesecret';
    configuration.web.cdnURL = configuration.web.cdnURL || '/external';
    app.use(express.bodyParser())
    .use(express.query())    
    .use(express.compress())
    .use(express.cookieParser(configuration.web.cookiesecret))        
    .use(app.router)
    .use(express.errorHandler({ dumpExceptions: configuration.web.dumpExceptions, showStack: configuration.web.showStack })); 
    // static routes
    // store some static assets (css) in memory
    if (process.env.NODE_ENV  !== 'development') {
      fs.readFile(__dirname + '/external/css/main.css', 'utf8', function(err, data){            
        if (err === null) fileStore['main.css'] = ejs.render(data, {cdnurl : configuration.web.cdnURL});
      });      
    }
    // Get app version from package json
    var pckjs = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString());
    APP_VERSION = pckjs.version;    
    // Auth
    var authCheck = express.basicAuth(function(user, pass) {
      return user === configuration.auth.user && pass === configuration.auth.password;
    });
    // add auth if enabled via config
    if (configuration.auth && configuration.auth.enabled === true) {
      if (!configuration.auth.password) configuration.auth.password = 'admin';
      if (!configuration.auth.user) configuration.auth.user = 'admin';
      routesMiddleware.push(authCheck);
    }
    // external requests (in case, no CDN is defined)
    app.get(/^\/external\/(.*\/|)(.*)$/, loadStaticAssets);            
    // html routes
    app.get('/', routesMiddleware, processView); 
    app.get('/export', routesMiddleware, processView);
    // collection route
    app.get('/collection/:collection', routesMiddleware, collectionView);
    // DB API
    app.get('/api/db/:collection', routesMiddleware, routes.genericDBAPI);
    app.get('/api/db/count/:collection', routesMiddleware, routes.count);
    // download API
    app.get('/download/:fileName', routesMiddleware, csv.fileDownloadRoute);
    // create the server
    webServer = http.createServer(app);    
    webServer.listen(configuration.web.port, configuration.web.host, function() {    
      log.info('mongodbview web server - "%s" running on port %s', configuration.web.host, configuration.web.port); 
      if (typeof(callback) === 'function') callback(null, models);
    });    
    // setup websockets
    var io = require('socket.io').listen(webServer);
    io.configure(function (){
      io.set('log level', 1);
    });
    io.sockets.on('connection', function(socket) {      
      socket.on('requestExport', function(data) {
        csv.createCSVFile(getModelForName(data.modelName), { seperator: data.seperator, socket: socket, sort: { timestamp : 1 }}, function(err, fileName) {
          if (err !== null) log.error(err);
        });
      })
    });
  });
}
exports.start = start;

var processView = function(req, res, next) {  
  if (req.route.path === '/export') view = 'export';
  else view = 'index';  
  var respData = {version: APP_VERSION, view: view, cdnurl: configuration.web.cdnURL, models: models};        
  res.render(view, respData);    
}
/** Collection route */
var collectionView = function(req, res) {
  var model = getModelForName(req.params.collection);
  console.dir(model.schema);
  if (model === null) {
    res.send(404, req.params.collection+ ' is unknown');
  } else {
    var respData = {version: APP_VERSION, cdnurl: configuration.web.cdnURL, collection: req.params.collection, schema: model.schema };        
    res.render('collection', respData);   
  }
}

var countForModel = function(model) {  
  var deferred = new Deferred();
  var qry = model.count();   
  qry.exec(function(err, doc) { 
    if (err === null) deferred.resolve({name: model.modelName, count: doc});
    else deferred.reject(err);
  });
  return deferred.promise;
}

var getModelForName = function(modelName) {
  for (var m = 0, mx = models.length; m < mx; ++m) {
    if (models[m].modelName === modelName) return models[m];
  }
  return null;
}
