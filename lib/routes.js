var db = require('mongoose');
var Log = require('log'), log = new Log('info');

var log = new Log('info');

var models = null;
exports.setModels = function(models_) {
  models = models_;
}
/** DB API generic */
exports.genericDBAPI = function(req, res) { 
  res.set({'Content-Type': 'application/json', 'Cache-Control' : 'no-cache,no-store,must-revalidate'});
  try {
    var query = req.query;          
    var opts = {};
    var limit = 5000;
    var sort = {};
    for (q in query) {              
      try {
        if (q === 'limit') limit = parseInt(query[q]);
        else if (q === 'sort') sort = query[q];
        else {
          opts[q] = JSON.parse(query[q]);
        }
      } catch (ex) {
        opts[q] = query[q];
      }
    }    
    var model = getModelForName(req.params.collection);
    var qry = model.find(opts).limit(limit).sort(sort).lean(true);
    var qrystream = qry.stream();
    data = [];
    qrystream.on('data', function(doc) {      
      data.push(doc);      
    });
    qrystream.on('error', function(err) {
      log.error('mongodbview - stream on /api/db/ %s', err);
      res.send(500, JSON.stringify({data: null, error: err, returncode:'FAILED'}));
    });
    qrystream.on('close', function () {
      res.send(200, JSON.stringify({data: data, returncode:'SUCCESS'}));
    });        
  } catch (ex) {          
    if (req.params && req.params.collection) log.error('mongodbview - /api/db/%s Error: %s', req.params.collection, ex);
    else log.error('mongodbview - /api/db (req.params.collection unknown) Error: %s ', ex);           
    res.send(500, JSON.stringify({message: 'Error', error: ex.toString(), returncode:'FAILED'}));
  }
}

exports.count = function(req, res) { 
  res.set({'Content-Type': 'application/json', 'Cache-Control' : 'no-cache,no-store,must-revalidate'});
  try {    
    var model = getModelForName(req.params.collection);
    var qry = model.count();
    qry.exec(function(err, doc) {
      if (err !== null) res.send(500, JSON.stringify({message: 'Error', error: ex.toString(), returncode:'FAILED'}));
      else res.send(200, JSON.stringify({data: doc, returncode:'SUCCESS'})); 
    })
  } catch (ex) {          
    if (req.params && req.params.collection) log.error('mongodbview - /api/db/count/%s Error: %s', req.params.collection, ex);
    else log.error('mongodbview - /api/db/count (req.params.collection unknown) Error: %s ', ex);           
    res.send(500, JSON.stringify({message: 'Error', error: ex.toString(), returncode:'FAILED'}));
  }
}

var getModelForName = function(modelName) {
  for (var m = 0, mx = models.length; m < mx; ++m) {
    if (models[m].modelName === modelName) return models[m];
  }
  return null;
}