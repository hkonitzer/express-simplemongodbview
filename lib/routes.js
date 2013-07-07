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
    var limit = 1000;
    var sort = {};
    var fields = '';
    var groupOp = null;
    for (q in query) {              
      try {
        if (q === 'limit') limit = parseInt(query[q], 10);
        else if (q === 'sort') sort = query[q];
        else if (q === 'fields') fields = query[q];
        else if (q === '_') continue; // jquery ajax cache param
        else if (q === 'nd') continue; // jquery ajax cache param
        else if (q === 'rows') limit = parseInt(query[q], 10); // jqgrid        
        else if (q === 'page') continue; // jqgrid
        else if (q === 'sidx') { // jqgrid
          if (query.sord) sort[query[q]] = query.sord;
          else sort = query[q];
        } else if (q === 'sord') continue; // jqgrid
        else if (q === 'filters') continue;
        else if (q === 'searchField') continue;
        else if (q === 'searchString') continue;
        else if (q === 'searchOper') continue;
        else if (q === '_search') { // jqgrid search          
          if (query.filters) {
            var filters = JSON.parse(query.filters);            
            groupOp = filters.groupOp;            
            for (var r in filters.rules) {
              var rule = filters.rules[r];
              if (!opts[rule.field]) opts[rule.field] = {};
              if (rule.op === 'ne') opts[rule.field]['$ne'] = rule.data;
              else if (rule.op === 'gt') opts[rule.field]['$gt'] = rule.data;
              else if (rule.op === 'ge') opts[rule.field]['$gte'] = rule.data;
              else if (rule.op === 'lt') opts[rule.field]['$lt'] = rule.data;
              else if (rule.op === 'le') opts[rule.field]['$lte'] = rule.data;
              else if (rule.op === 'eq') {
                if (isNaN(rule.data)) opts[rule.field]['$eq'] = rule.data;
                else opts[rule.field] = rule.data;
              }

            }

          }          
        } else {          
          opts[q] = JSON.parse(query[q]);
        }
      } catch (ex) {
        opts[q] = query[q];
      }
    } 
    // jqgrid advanced search
    if (groupOp !== null && groupOp === 'OR') {
      var orOpts = { $or: [] };
      for (var o in opts) {
        var n = {};
        n[o] = opts[o];
        orOpts['$or'].push(n);
      }
      opts = orOpts;
    }    
    var model = getModelForName(req.params.collection);
    if (model === null) {
      res.send(404, req.params.collection+ ' is unknown');
    } else {
      model.count(opts, function(cerr, totalRecords) {      
        var errorDetected = false;
        var qry = model.find(opts, fields).limit(limit).sort(sort).lean(true);          
        var qrystream = qry.stream();
        data = [];
        qrystream.on('data', function(doc) {      
          data.push(doc);              
        });
        qrystream.on('error', function(err) {
          errorDetected = true;
          //log.error('mongodbview - stream on /api/db/ %s', err);
          res.send(500, err.message);
        });
        qrystream.on('close', function () {
          if (!errorDetected) {
            res.set({'Content-Type': 'application/json', 'Cache-Control' : 'no-cache,no-store,must-revalidate'});
            res.send(200, JSON.stringify({data: data, total: 1, records: totalRecords}));
          }
        });   
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