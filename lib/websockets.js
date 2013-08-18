"use strict";
var Log = require('log'), log = new Log('info');

var WebSocket = function() {
    var io = null;    
    var that = this;
    var socket = null;
    var socketConnection = function(socket_) {        
        socket = socket_;
    }

    this.logDBOperation = function(err, modelName, ts, op, query) {        
        socket.emit('dbop', {error: err, modelName: modelName, timestamp: ts, op: op, query: query});
    }

    this.init = function(io_, path) {                 
        io = io_.of(path).on('connection', socketConnection);                
    }

}

var socket = new WebSocket();
exports.socket = socket;