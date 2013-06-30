var db = require('mongoose');
var Log = require('log'), log = new Log('info');

var log = new Log('info');

var models = null;
exports.setModels = function(models_) {
  models = models_;
}
/** DB API generic */
exports.genericDBAPI = function(req, res) {   
  try {
    var query = req.query;          
    var opts = {};
    var limit = 5000;
    var sort = {};
    for (q in query) {              
      try {
        if (q === 'limit') limit = parseInt(query[q]);
        else if (q === 'sort') sort = query[q];
        else if (q === '_') continue; // jquery ajax cache param
        else {          
          opts[q] = JSON.parse(query[q]);
        }
      } catch (ex) {
        opts[q] = query[q];
      }
    }        
    var model = getModelForName(req.params.collection);
    if (model === null) {
      res.send(404, req.params.collection+ ' is unknown');
    } else {
      var qry = model.find(opts).limit(limit).sort(sort).lean(true);
      console.log(qry);
      var qrystream = qry.stream();
      data = [];
      qrystream.on('data', function(doc) {      
        data.push(doc);      
        console.log(doc);
      });
      qrystream.on('error', function(err) {
        log.error('mongodbview - stream on /api/db/ %s', err);
        res.send(500, err);
      });
      qrystream.on('close', function () {
        res.set({'Content-Type': 'application/json', 'Cache-Control' : 'no-cache,no-store,must-revalidate'});
        res.send(200, JSON.stringify(data));
      });     
    }   
  } catch (ex) {          
    if (req.params && req.params.collection) log.error('mongodbview - /api/db/%s Error: %s', req.params.collection, ex);
    else log.error('mongodbview - /api/db (req.params.collection unknown) Error: %s ', ex);           
    res.send(500, ex.toString());
  }
}

exports.count = function(req, res) { 
  try {    
    var model = getModelForName(req.params.collection);
    if (model === null) {
      res.send(404, req.params.collection+ ' is unknown');
    } else {
      var qry = model.count();
      qry.exec(function(err, doc) {
        if (err !== null) res.send(500, err);
        else {
          res.set({'Content-Type': 'text/plain', 'Cache-Control' : 'no-cache,no-store,must-revalidate'});
          res.send(200, JSON.stringify(doc));
        }
      });
    }
  } catch (ex) {          
    if (req.params && req.params.collection) log.error('mongodbview - /api/db/count/%s Error: %s', req.params.collection, ex);
    else log.error('mongodbview - /api/db/count (req.params.collection unknown) Error: %s ', ex);           
    res.send(500, ex.toString());
  }
}

var getModelForName = function(modelName) {
  for (var m = 0, mx = models.length; m < mx; ++m) {
    if (models[m].modelName === modelName) return models[m];
  }
  return null;
}