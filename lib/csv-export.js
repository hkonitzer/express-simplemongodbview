var fs = require('fs'), timers = require('timers'), io = require('socket.io');
var Log = require('log'), log = new Log('info');

// SETUP temp directory
var fileDir = process.env.TEMP || process.env.TMP;
if (typeof(fileDir) !== 'string' || fileDir ==='') fileDir = '/tmp';

var createCSVFile = function(modelObj, options_, callback) {
  var options = options_ || {}; 
  var prepareStringForCSV = function(str_) {
    // @TODO: remove string concentantions
    if (isNaN(str_)) {
      str_ = str_.replace(/\r|\t|\n/g, ' ');
      if (str_.indexOf('"') > -1) str_ = str_.replace(/"/g, "'");
      str_ = '"' + str_ + '"'; 
    }
    return str_;
  } 
  var transformFunction = function(data) {    
    progress++;
    var stringBuffer = [];
    var dataString = null;
    var csvSeparatordetected = false;
    var pos = 0;
    for (var d in data) {
      if (data[d] === null) continue;
      var headerName = null;
      // check for nested (sub) documents
      if (typeof(data[d]) === 'object') {
        if (data[d].length) { // sub document is an array          
          headerName = d;
          var temp = [];    
          var sep1 = true; 
          var simpleArray = false; // if object is simple array [], do not use different separators for key/value entry    
          for (var s = 0, sx = data[d].length; s < sx; ++s) {
            var r = data[d][s];            
            if (typeof(r) === 'object') {  
              for (var ri in r) {
                var tempString = null;
                if (typeof(r[ri]) === 'function') {                                    
                  if (ri === 'toHexString') tempString = r[ri](); // special handling for ObjectId                                
                } else {
                  tempString = r[ri].toString()
                }
                if (ri === 'id' || ri === 'generationTime' || tempString === null) {                  
                  continue; // special handling for ObjectId
                }
                if (r[ri] === 'ObjectID') {
                  simpleArray = true;
                  continue;
                }
                if (temp.length === 0) temp.push(tempString);
                else {  
                  if (simpleArray === false && sep1) {
                    temp.push('=');
                    sep1 = false;
                  } else {                    
                    temp.push('|');
                    sep1 = true;
                  }
                  temp.push(tempString)
                }
              }
              dataString = temp.join('');              
            } else {              
              dataString = data[d][s].toString();
            }            
          }
        } else { // sub document is an object, do nothing special  
          headerName = d.toString();
          dataString = data[d].toString();          
          for (var di in data[d]) { // simple object stated in header 
            if (csvHeader[headerName+'.'+di]) {
              headerName = headerName+'.'+di;
              dataString = data[d][di].toString();
            }
          }
        }        
      } else { // simple field (string, number, boolean)
        headerName = d;
        dataString = data[d].toString();
      }
      if (csvHeader[headerName]) {        
        var headerPos = (csvHeader[headerName] - 1);      
        stringBuffer[headerPos] = prepareStringForCSV(dataString) + csvSeparator; 
      }
    }
    // fill empty positions with csvSeparator
    for (var h = 0, hx = stringBuffer.length; h < hx; ++h) {
      if (typeof(stringBuffer[h]) === 'undefined') {
        stringBuffer[h] = csvSeparator;        
      }
    }      
    var ret = stringBuffer.join(''); // beware: DO NOT JOIN with csv separator
    ret = ret.substring(0, ret.length - 1);
    ret+='\n'; 
    if (options.socket && progress % 1000 === 0) options.socket.emit('exportProgress', progress);    
    return ret;
  }
  
  var fstat = fs.statSync(fileDir); // check for temp  
  if (!fstat.isDirectory()){
    throw 'Cannot read temp directory: '+fileDir;
  }
  var fileId = null; 
  if (options.socket) fileId = options.socket.id; else fileId = '';
  var fileName = modelObj.modelName+'_'+fileId+'.csv';
  var csvSeparator = options.seperator || ';';
  var headerLength = 0;
  var progress = 0;
  var csvHeader = {}
  var qry = modelObj.find({}).read('secondaryPreferred').lean(true);
  var fileStream = fs.createWriteStream(fileDir+'/'+fileName, { encoding: 'UTF-8' });
  // @TODO: compare with qry._fields  
  for (var p in modelObj.schema.paths) {
    var field = modelObj.schema.paths[p];
    //if (field.instance === 'ObjectID') continue;
    csvHeader[field.path] = ++headerLength;
  }
  // write header first
  var header = [];
  for (var h in csvHeader) {
    header.push(h);
  }
  fileStream.write(header.join(csvSeparator));
  fileStream.write('\n');
  fileStream.on('error', function(err) {
    log.error('mongodbview - filestream on createCSVFile %s', err);
  });  
  fileStream.on('close', function() {
    log.debug('createCSVFile - filestream closed');  
    if (options.socket) options.socket.emit('exportDone', fileName);
    if (typeof(callback) === 'function') callback(null, fileName);
  });

  var qrystream = qry.stream({transform: transformFunction }).pipe(fileStream);
  qrystream.on('error', function(err) {
    if (typeof(callback) === 'function') callback(err, null);
    log.error('mongodbview - stream on createCSVFile %s', err);
  });
  qrystream.on('close', function () { 
    if (options.socket) options.socket.emit('exportProgress', progress);    
    log.debug('createCSVFile - querystream closed');
  });  
}
exports.createCSVFile = createCSVFile;

exports.fileDownloadRoute = function(req, res, next) {
  var file = fileDir + '/' + req.params.fileName; // @TODO: Error handling  
  var fstat = fs.statSync(file);
  if (!fstat.isFile()) { 
    res.send(404);
  } else {      
    res.setHeader('Content-disposition', 'attachment; filename=' + req.params.fileName);
    res.setHeader('Content-type', 'text/csv');    
    var filestream = fs.createReadStream(file);
    filestream.pipe(res);
    filestream.on('close', function(){        
      timers.setTimeout(function() { removeFile(file); }, 3600000);    
    });
  }
}

var removeFile = function(file_) {
  fs.unlinkSync(file_);
}