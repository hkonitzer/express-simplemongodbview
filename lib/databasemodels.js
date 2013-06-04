var db = require('mongoose'), Schema = db.Schema;

var _AdnoceAdditionalData = new Schema({
  key: { type: String, trim: true, required: true },
  value: { type: String, trim: true, required: false },
}, { _id: false, id: false, versionKey: false });

var _AdnoceEvent = new Schema({
  id                : Schema.ObjectId,
  adnocetype        : { type: Number, required: true }, // 100 - error events, 200 - generic events, 1 - reserved for visits
  eventname         : { type: String, required: false, trim: true, index: { sparse: true } },
  sessionId         : { type: String, required: true, trim: true, index: { sparse: true } },
  data              : [ _AdnoceAdditionalData ],
  timestamp         : { type: Date, default: Date.now, required: true }
}, { autoIndex: true, versionKey: false });
_AdnoceEvent.index({ timestamp: 1 });
var AdnoceEventModel = db.model('adnoce-event', _AdnoceEvent);
exports.AdnoceEvent = AdnoceEventModel;

var _AdnoceVisit = new Schema({
  id                : Schema.ObjectId,
  url               : { type: String, required: true, trim: true },
  sessionId         : { type: String, required: true, trim: true, index: { sparse: true } },
  urlquery          : [ _AdnoceAdditionalData ],
  timestamp         : { type: Date, default: Date.now, required: true }
}, { autoIndex: true, versionKey: false });
_AdnoceVisit.index({ timestamp: 1 });
var AdnoceVisitModel = db.model('adnoce-visit', _AdnoceVisit);
exports.AdnoceVisit = AdnoceVisitModel;

var _AdnoceSession = new Schema({
  id                  : Schema.ObjectId,
  persistentSessionId : { type: String, required: false, trim: true, index: { sparse: false } },
  sessionId           : { type: String, required: true, trim: true, index: { sparse: true } },
  userAgent           : { type: String, required: false, trim: true },
  data                : [ _AdnoceAdditionalData ],
  timestamp           : { type: Date, default: Date.now, required: true }
}, { autoIndex: true, versionKey: false });
_AdnoceSession.index({ persistentSessionId: 1, sessionId: 1 });
var AdnoceSessionModel = db.model('adnoce-session', _AdnoceSession);
exports.AdnoceSession = AdnoceSessionModel;
