var http = require('http'), https = require('https'), url = require('url'), fs = require('fs');
var db = require('mongoose');
var Log = require('log'), log = new Log('info');
var express = require('express'), ejs = require('ejs');
var q = require('promised-io/promise');
var Deferred = q.Deferred;


var modelDefinitionFiles = [];
var models = [];
var app = null, webServer = null;
var fileStore = {};  
var configuration = null;

var loadStaticAssets = function (req, res) {    
  var extension = req.params[1].substring(req.params[1].lastIndexOf('.') + 1);
  if (extension === 'css') res.set('Content-Type', 'text/css');
  else if (extension === 'js') res.set('Content-Type', 'application/javascript');
  else if (extension === 'png') res.set('Content-Type', 'image/png');
  else if (extension === 'gif') res.set('Content-Type', 'image/gif');
  if (process.env.NODE_ENV  === 'development') res.setHeader('Cache-Control', 'no-cache,no-store');
  else res.setHeader('Cache-Control', 'max-age=172800,public');
  if (fileStore[req.params[1]]) res.send(200, fileStore[req.params[1]]);
  else fs.readFile(__dirname + '/external/'+req.params[0]+'/'+req.params[1], 'utf8', function(err, data) { 
    if (err === null) {
      res.send(200, data);        
    } else {
      log.error(err);
      res.send(404);
    } 
  });
};


function ConfigurationException(message) {
   this.message = message;
   this.name = "ConfigurationException";
}

var start = function(configuration_) {
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
      console.log('m=%s', m) 
      for (var n in modelDefinitions[m]) {
        if (n === 'modelName')  {      
          models.push(modelDefinitions[m]);
        }
      }
    }
  }
  if (models.length === 0) throw new ConfigurationException('No models found in file "'+modelDefinitionFile+'"');  
  // Testing Models
  var arrayOfPromises = [];
  for (var m = 0, mx = models.length; m < mx; ++m) arrayOfPromises.push(countForModel(models[m]));
  var group = q.all(arrayOfPromises); 
  group.then(function(resultArray){    
    log.info('mongodbview - %s models found', resultArray.length);
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
    // external requests (in case, no CDN is defined)
    app.get(/^\/external\/(.*\/|)(.*)$/, loadStaticAssets);            
    // html routes
    app.get('/', function(req, res, next) {  
      var respData = {cdnurl: configuration.web.cdnURL, models: models};        
      res.render('index', respData);    
    }); 
    // create the server
    webServer = http.createServer(app);    
    webServer.listen(configuration.web.port, configuration.web.host, function() {    
      log.info('mongodbview web server - "%s" running on port %s', configuration.web.host, configuration.web.port);  
    });
  });
}
exports.start = start;

var countForModel = function(model) {  
  var deferred = new Deferred();
  var qry = model.count();   
  qry.exec(function(err, doc) { 
    if (err === null) deferred.resolve({name: model.modelName, count: doc});
    else deferred.reject(err);
  });
  return deferred.promise;
}

