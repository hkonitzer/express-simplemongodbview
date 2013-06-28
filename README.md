                                        
# Express-SimpleMongoDBView

Simple Collection Viewer for MongoDB. Designed for users without knowledge about internals. There is no admin access to the MongoDB instance needed.
Can also export an collection as CSV file.
Use [SMOG](https://github.com/wearefractal/smog) or [Mongo-Express](https://github.com/andzdroid/mongo-express) if you need a (full featured) MongoDB client.

## Features

### View

not implented yet

### Export

Exports an collection as CSV file

## Installation

  `$ npm install express-simplemongodbview`

  SimpleMongoDBView needs serveral modules, see dependencies

## Setup

The app needs to know which models to use. So you need an js file with the model definitions.
This file has to export the models like this example (databasemodels.js):

```js
var db = require('mongoose'), Schema = db.Schema;

var _MySchema = new Schema({
  id                : Schema.ObjectId,
  type              : { type: Number, required: true }, 
  name              : { type: String, required: false, trim: true, index: { sparse: true } },  
  timestamp         : { type: Date, default: Date.now, required: true }
});
var MySchema = db.model('myschema', _MySchema);
exports.MySchema = MySchema;
```
SimpleMongoDBView detect all schemas exported the way above.

Now, use it as standalone app:

```js
  var mongoose = require('mongoose');
  var dbview = require('express-simplemongodbview');
  var config = {  
    modelDefinitionFile : __dirname + '/databasemodels.js',
    web: {
      host : 'localhost',
      port : 80
    }
  }
  mongoose.connect('mongodb://localhost:27017/mycollection', {}, function(){
    dbview.start(config);    
  });
```
Check http://localhost and http://localhost/export

You can also use this in your existing applications, change the port accordingly.

## Dependencies

* [Connect](https://github.com/senchalabs/connect) 2.x
* [Express](https://github.com/visionmedia/express) 3.x
* [EJS](git://github.com/visionmedia/ejs.git) 0.x
* [Socket.io](http://socket.io) 0.9.x
* [MongoDB](http://mongodb.github.com/node-mongodb-native/) 1.x
* [Mongoose](https://github.com/learnboost/mongoose/) 3.x
* [Log](https://github.com/visionmedia/log.js/) 1.x"


## License

[MIT License](http://www.opensource.org/licenses/mit-license.php)

## Author

Copyright (c) 2013, [Hendrik Konitzer] (hkonitzer@gmail.com)
