/* BACKBONE */
/* BACKBONE: Performance */
var PerfomanceModel = Backbone.Model.extend({
  defaults: {    
    "reqcounter"  : 0,
    "reqmax"      : 0,
    "reqtrend"    : 0, // -1 = negative trend, +1 positive trend    
  },
  addRequest: function() {    
    this.set('reqcounter', this.get('reqcounter') + 1);
  },
  reset: function(p1) {    
    // update max
    if (this.get('reqcounter') > this.get('reqmax')) {
      this.set('reqmax', this.get('reqcounter'));
      this.set('reqtrend', 1);
    } else if (this.get('reqcounter') === this.get('reqmax')) {
      this.set('reqtrend', 0);
    } else {
      this.set('reqtrend', -1);
    }
    this.set('reqcounter', 0);
  }
});
var PerformanceView = Backbone.View.extend({  
  title: null,
  initialize: function(opts_) {
    this.title = opts_.title || '';
    this.listenTo(this.model, 'add', this.render);
    this.listenTo(this.model, 'change:reqcounter', this.updateCounter);
    this.listenTo(this.model, 'change:reqmax', this.updateMax);
    this.listenTo(this.model, 'change:reqtrend', this.updateTrend);
    this.render(this.model);
  },
  render : function(model) {    
    this.$el.append('<div>'+this.title+':&thinsp;<span id="perfcounter_'+model.cid+'">?</span>&thinsp;Trend:&thinsp;<span id="perftrend_'+model.cid+'">?</span>&thinsp;Max:&thinsp;<span id="perfmax_'+model.cid+'">0</span></div>');
    this.updateCounter(model);    
    this.updateMax(model);
  },
  updateCounter : function(model) {
    $('#perfcounter_'+model.cid).text(model.get('reqcounter'));    
  },
  updateMax : function(model) {
    $('#perfmax_'+model.cid).text(model.get('reqmax'));   
    $('#perfmax_'+model.cid).attr('title', moment().format('H:mm:ss')); 
  },
  updateTrend : function(model) {
    var trendSymbol = null;
    if (model.get('reqtrend') < 0) trendSymbol = '-';
    else if (model.get('reqtrend') > 0) trendSymbol = '+';
    else trendSymbol = '=';
    $('#perftrend_'+model.cid).text(trendSymbol);    
  }
});
/* BACKBONE: Log view */
var LogLine = Backbone.Model.extend({
  idAttribute: '_id',
  initialize: function(data) {         
    if (data.persistentSessionId) this.set({nPSessionId: this.normalizeSessionId(data.persistentSessionId)});
    this.set({nSessionId: this.normalizeSessionId(data.sessionId)});
    if (data.url) {
      var u = this.normalizeURL(data.url);
      this.set('url-host', u.host);
      this.set('url-path', u.path);
      this.set('url-protocol', u.protocol);
    }
  },
  normalizeSessionIdRegEx: /[^\w]/g,
  normalizeSessionId: function(sessionId_) {
    if (!sessionId_) return null;
    return sessionId_.replace(this.normalizeSessionIdRegEx,'').substring(0,6);      
  },
  normalizeURLRegEx: new RegExp(/^(http|ftp|https):\/\/(.+?)\/(.*)/),
  normalizeURL: function(url_) {      
    var erg = this.normalizeURLRegEx.exec(url_);      
    return { protocol : erg[1], host: erg[2], path: '/'+erg[3] };
  }

});
var LogLineView = Backbone.View.extend({
  model: LogLine
});
var LogLineList = Backbone.Collection.extend({
  maxEntries: null,      
  model: LogLine,
  initialize: function(data, options) {
    if (!options) options = {};
    this.maxEntries = options.maxEntries || 100;
  }
});

var LogView = Backbone.View.extend({
  datalog: null,
  el: $("#log"),
  showMaxEntries: null, // show only x entries
  lastLoglineTimestamp: null, // last log recieved
  lineFilter: { active  : false, conditions : [] },

  // mustache style templating, because default style is already used by ejs
  //template: _.template('<div class="logline {{sid}}"></div>', null, { interpolate : /\{\{(.+?)\}\}/g }), 
  initialize: function(options) {       
    // filter setup    
    _.extend(this.lineFilter, Backbone.Events);
    this.lineFilter.on('change', this.changeFilter, this);    
    // bind events
    this.listenTo(this.model, 'add', this.render);    
    this.listenTo(this.model, 'remove', this.removeLineForModel);        
    this.$el.on('click', '.logfilter span', this, this.removeFilterView);
    this.$el.on('click', '.addfilter', this, this.addFilterView);
    // options     
    this.lastLoglineTimestamp = moment();    
    if (options.showDatalogline === false) this.datalog = false; else this.datalog = true;     
    if (options.showMaxEntries && !isNaN(options.showMaxEntries)) this.showMaxEntries = options.showMaxEntries;
    else {
      if (this.datalog === true) this.showMaxEntries = Math.round(this.$el.height() / 52); 
      else this.showMaxEntries = Math.round(this.$el.height() / 30); 
    }    
    // add header
    this.$el.append('<div class="logheader"></div>');         
    this.$el.append('<div style="display:none;" class="logfilter">Filter active: </div>');
  },
  changeFilter: function(action, filterOption) {  
    var alreadyInUse = false;  
    for (var f = 0, fx = this.lineFilter.conditions.length; f < fx; ++f) { // get through the conditions array
      var keys = _.keys(this.lineFilter.conditions[f]); // get the key (first part)
      for (var k = 0, kx = keys.length; k < kx; ++k) { // should be only one key
        if (_.has(filterOption, keys[k])) // if the given option has the same key = compare the values 
          if (filterOption[keys[k]] === this.lineFilter.conditions[f][keys[k]]) {  
            if (action === 'remove') this.lineFilter.conditions[f] = null; // set position in array to null (see _.compact below)
            else alreadyInUse = true;              
            break;              
        }
      }
    }
    if (action === 'remove') {
      this.lineFilter.conditions = _.compact(this.lineFilter.conditions); // removes all null values
    } else if (action === 'add' && !alreadyInUse) { // add
      this.lineFilter.conditions.push(filterOption);    
    }
    if (this.lineFilter.conditions.length > 0) this.lineFilter.active = true; else this.lineFilter.active = false;
    this.renderFilterView();
  },
  addFilter: function(filterOption) {    
    this.lineFilter.trigger('change', 'add', filterOption);
  },
  removeFilter: function(filterOption) {
    this.lineFilter.trigger('change', 'remove', filterOption);
  },
  removeLineForModel: function(model) {    
    var el = this.$el.find('#logline'+model.cid);
    if (el.length > 0) el.fadeOut('slow', function(){
      el.remove();
    });
  },
  addFilterView: function(ev) {
    var filterElem = $(this);
    var cond = {};
    cond[filterElem.data('conditionkey')] = filterElem.data('conditionvalue');
    ev.data.addFilter(cond);
  },
  removeFilterView: function(ev) {    
    var filterElem = $(this);
    var cond = {};
    cond[filterElem.data('conditionkey')] = filterElem.data('conditionvalue');
    ev.data.removeFilter(cond);
  },
  renderFilterView: function() {
    var filterElemHead = this.$el.children('.logfilter');
    if (this.lineFilter.active === false) {
      filterElemHead.hide();
    } else {
      filterElemHead.children().remove();
      for (var f = 0, fx = this.lineFilter.conditions.length; f < fx; ++f) { 
        var keys = _.keys(this.lineFilter.conditions[f]);
        for (var k = 0, kx = keys.length; k < kx; ++k) {
          var filterElem = $('<span class="filterelem">'+keys[k]+'='+this.lineFilter.conditions[f][keys[k]]+'</span>');          
          filterElem.data('conditionkey', keys[k]);
          filterElem.data('conditionvalue', this.lineFilter.conditions[f][keys[k]]);
          filterElemHead.append(filterElem);
        }
      }
      filterElemHead.show();
    }
  },
  render: function(model) {               
    // create time difference for last request
    var ts = moment(new Date(model.get('timestamp')));
    var oldts = this.lastLoglineTimestamp;
    this.lastLoglineTimestamp = ts;    
    // check for filter     
    if (this.lineFilter.active === true) {
      var linePassedFilter = false;
      for (var f = 0, fx = this.lineFilter.conditions.length; f < fx; ++f) { // get through the conditions array
        var keys = _.keys(this.lineFilter.conditions[f]);
        for (var k = 0, kx = keys.length; k < kx; ++k) {
          if (_.has(model.attributes, keys[k])) {
            if (this.lineFilter.conditions[f][keys[k]] === model.attributes[keys[k]]) {
              linePassedFilter = true;
              break;
            }
          }
        }
      }
      if (linePassedFilter === false) return false;
    }
    // remove models if max reached (avoid memory overhead)
    var maxReached = (model.collection.maxEntries < model.collection.length);    
    if (maxReached) model.collection.shift();
    // remove lines if max reached
    var maxShowEntriesReached = (this.showMaxEntries < this.$el.children('.logline').length+1);    
    // init div
    var loglinediv = $('<div>', {'id' : 'logline'+model.cid, 'class' : 'logline '+model.get('nSessionId'), style: 'display: none;'});
    // add timestamps
    var diff = ts.diff(oldts);
    if (diff <= 1000) difftext = diff+'ms';
    else {        
      diff = Math.round(diff / 1000);
      if (diff <= 60) difftext = diff+'s';          
      else {          
        diff = Math.round(diff / 60);
        if (diff <= 60) difftext = diff+'m';
        else {
          diff = Math.round(diff / 60);
          if (diff <= 60) difftext = diff+'h';
        }
      }
    }
    loglinediv.append('<div class="loglinecontent timediff">'+difftext+'</div>');
    loglinediv.append('<div class="loglinecontent timestamp">'+ts.format('H:mm:ss.SSS')+'</div>');
    // add session id (normalized) with user agent as title
    var ua = model.get('userAgent') || 'n/a';
    loglinediv.append('<div class="loglinecontent sid" title="'+ua+'">'+model.get('nSessionId')+'</div>');
    // add counter element for this particular event (data itself is added later; retrieved from server)
    var counterDiv = $('<div>', {'class' : 'loglinecontent counter'});    
    // add type element
    var typeDiv = $('<div>', {'class' : 'loglinecontent adnocetype addfilter', title: model.get('adnocetype')});
    var payloadDiv = $('<div>', {'class' : 'loglinecontent addfilter'});
    typeDiv.data('conditionkey', 'adnocetype');        
    typeDiv.data('conditionvalue', model.get('adnocetype'));
    loglinediv.append(typeDiv);    
    switch(model.get('adnocetype')) {
      // error event
      case 100:
        payloadDiv.addClass('eventname');
        payloadDiv.attr('title', model.get('adnocetype'));
        payloadDiv.text(model.get('eventname'));
        payloadDiv.data('conditionkey', 'eventname');        
        payloadDiv.data('conditionvalue', model.get('eventname'));
        typeDiv.text('F');           
      // generic event
      case 200:        
        payloadDiv.addClass('eventname');
        payloadDiv.attr('title', model.get('adnocetype'));
        payloadDiv.text(model.get('eventname'));
        payloadDiv.data('conditionkey', 'eventname');        
        payloadDiv.data('conditionvalue', model.get('eventname'));
        typeDiv.text('E');           
        break;
      default: // a view
        // add url and counter for views
        loglinediv.append(counterDiv);
        payloadDiv.addClass('url');
        payloadDiv.attr('title', model.get('url-host'));
        payloadDiv.text(model.get('url-path'));
        payloadDiv.data('conditionkey', 'url-path');        
        payloadDiv.data('conditionvalue', model.get('url-path'));
        typeDiv.text('V');   
    }    
    loglinediv.append(payloadDiv);    
    // add additonaldata recieved as key/value pairs
    var dataloglineDiv = null;
    if (this.datalog) dataloglineDiv = $('<div>', {'class' : 'loglinecontentbot'});        
    var additionalData = model.get('data');    
     
    // iterate additional data, because we need the view counter var always (all other can be surpressed)
    if (additionalData && additionalData.length > 0) {
      for (var d = 0, dmax = additionalData.length; d < dmax; ++d) {                    
        if (additionalData[d].key === 'views') { // add views
          counterDiv.text(additionalData[d].value);
          if (!this.datalog) break; else continue; // go away if additional log line is unwanted
        }
        if (!this.datalog) continue;          
        else dataloglineDiv.append('<div class="loglinecontent datastore '+additionalData[d].key+'">'+additionalData[d].key+':'+additionalData[d].value+'</div>');      
      }
    }            
    if (this.datalog) {
      // get url query
      var uq = model.get('urlquery');
      if (uq && uq.length > 0) {
        for (var d = 0, dmax = uq.length; d < dmax; ++d) {                              
          dataloglineDiv.append('<div class="loglinecontent datastore">Q: '+uq[d].key+'='+uq[d].value+'</div>');      
        }
      }
      // append url query and other data collected above
      loglinediv.append(dataloglineDiv);
    }
    // done, add the whole log line
    this.$el.append(loglinediv);
    if (maxShowEntriesReached) {
      var lins = (this.$el.children('.logline').length - this.showMaxEntries);
      var el = this.$el.find('.logline:lt('+lins+')');
      el.fadeOut('fast', function(){
        el.remove();
        loglinediv.fadeIn('slow'); 
      });
    } else loglinediv.fadeIn('slow'); 
    return true;
  }
});

// Charts
var EPHChart = function(opts, data_) {  
  //@TODO: Refactor to backbone     
  var data = data;    
  var rawData = null;
  var keepRawData = opts.keepRawData || false;
  var datalength = 0;  
  var x = d3.scale.linear()
      .domain([0, 1])
      .range([0, opts.width]);

  var y = d3.scale.linear()
      .domain([0, opts.height])
      .rangeRound([0, opts.height]);
      
  var chart = null;
  var scaleFactor = 1;
  var maxValue = 0;
  var maxValueData = 0;
  var bars = opts.bars || 24;
  var startBar = null;
  var surpressAppendValuesToDataRects = false; 


  this.setChart = function(chart_) {
    chart = _chart;
  }

  this.getChart = function() {
    return chart;
  }

  this.getRawData = function() {
    return rawData;
  }

  var setRawData = function(data_) {
    rawData = data_;
  }
  this.setRawData = setRawData;

  this.getData = function() {
    return data;
  }

  var setData = function(data_) {
    data = data_;
  }
  this.setData = setData;

  this.addValue = function(c) {
    if (data) {
      data.shift();
      data.push({ time: (data[data.length-1].time)+1, value: 0, originalValue: c});      
    }
    calc();
    // @TODO: no transition if addValue is called
    surpressAppendValuesToDataRects = true;
  }

  this.redraw = function(data_) {
    if (data_) setData(data_);      
    chart.selectAll('g .valuetext').remove();
    var rect = chart.selectAll("rect")
      .data(data, function(d) { return d.time; });
    rect.enter().insert("rect", "line")
        .attr("x", function(d, i) { return x(i + 1) - .5; })
        .attr("y", function(d) { return opts.height - y(d.value) - .5; })
        .attr("width", opts.width)
        .attr("height", function(d) { return y(d.value); })
        .style("fill", "rgb(10, 46, 78)")
      .transition()
        .duration(1000)
        .attr("x", function(d, i) { return x(i) - .5; });

    rect.transition()
        .duration(1000)
        .attr("x", function(d, i) { return x(i) - .5; });

    rect.exit().transition()
        .duration(1000)
        .attr("x", function(d, i) { return x(i - 1) - .5; })
        .remove();       
    appendMiddleMark();   
    if (!surpressAppendValuesToDataRects) appendValuesToDataRects();
  }

  var appendMiddleMark = function() {
    if (maxValue === 0) return false;
    var my = maxValue;
    var midValueToShow = maxValueData / 2;    
    if (scaleFactor < 3) {      
      my = opts.height - (my / 2);     
    } else {
      my = opts.height - (my / scaleFactor);;   
    }        
    if (my > (opts.height - 14)) { 
      midValueToShow = opts.height / 2;
      my = 50;    
    }
    chart.selectAll('.middlemarkline').remove();
    chart.append('line')
      .attr('class', 'middlemarkline')
      .attr('x1', 45)
      .attr('x2', opts.width * data.length)
      .attr('y1', my)
      .attr('y2', my)
      .style('stroke', 'rgb(255, 255, 32)');
    chart.append('svg:text')
      .attr('class', 'middlemarkline')
      .attr('x', 5)
      .attr('y', my + 4.5)       
      .style('fill', '#00CC00') 
      .text(Math.round(midValueToShow)); 
    return true;
  }
  var appendValuesToDataRects = function() {
    var fontsize = null;
    if (opts.width < 12) return false;
    else if (opts.width < 15) fontsize = '0.5em';
    else fontsize = '0.9em';    
    chart.selectAll('g').append('svg:text')
      .attr('class', 'valuetext')      
      .attr("y", function(d) { return opts.height - 5; }) 
      .style("font-size", fontsize) 
      .style('fill', '#FFF')
      .text(function(d, i) { 
        if (d.value < 18) return '';
        else return (d.value); 
      })
      .attr("x", function(d, i) {         
        var tx =  (opts.width - this.getComputedTextLength()) / 2;
        return x(i) + tx; 
      });
      return true;
  }
  this.appendValuesToDataRects = appendValuesToDataRects;
  var create = function(data_) {         
    var title = opts.title || '';  
    if (data_) setData(data_);  
    $(opts.el).children('span').remove();
    chart = d3.select(opts.el).append("svg")
      .attr("class", "chart");
    chart.attr("width", (opts.width * data.length))
      .attr("height", opts.height);           
    chart.selectAll("rect")
      .data(data)
    .enter().append('g')
      .append('rect')
        .attr("x", function(d, i) { return x(i) - .5; })
        .attr("y", function(d) { return opts.height - y(d.value) - .5; })          
        .attr("width", opts.width)
        .attr("height", function(d) { return y(d.value); });     
    appendMiddleMark();
    appendValuesToDataRects();
    chart.append("line")
      .attr("x1", 0)
      .attr("x2", opts.width * data.length)
      .attr("y1", opts.height - .5)
      .attr("y2", opts.height - .5)
      .style("stroke", "#FFF");        
    
    chart.append("svg:text")
      .attr("x", 10)
      .attr("y", 18 )       
      .style("fill", "#00CC00") 
      .style("font-size", "0.9em") 
      .text(title+" (total: "+datalength+")"); 
  }
  this.create = create;

  var calc = function(dataSet_, initalData_) {
    //@TODO: This can be done faster
    if (!initalData_) initalData_ = data;
    if (dataSet_) {
      for (var d in dataSet_) {
        var t = null;
        switch (opts.startBar) {
          case 'currentMinute':
            t = moment(dataSet_[d].timestamp).minute();
            break;
          default:
            t = moment(dataSet_[d].timestamp).hour();
        }            
        initalData_[t].originalValue++;              
      }         
    }
    maxValueData = _.max(initalData_, function(dataSet) {
      return dataSet.originalValue;
    }).originalValue;    
    maxValue = maxValueData; 
    scaleFactor = 1;
    while (maxValue > opts.height) {
      scaleFactor = scaleFactor + 1;
      maxValue = maxValueData / scaleFactor;                  
    }
    if (scaleFactor > 0) {
      for (var i = 0, ix = initalData_.length; i < ix; ++i) {
        if (initalData_[i].originalValue > 0) {          
          initalData_[i].value = Math.round(initalData_[i].originalValue / scaleFactor);                
        }
      }  
    }              
    if (dataSet_) {  
      var fillNew = bars - startBar;              
      var testy1 = initalData_.slice(0, startBar), testy2 = [];    
      for (var i =  -bars, ix = -startBar; i < ix; ++i) {      
        testy2.push({ time: i, originalValue: 0, value: 0 });
      }     
      setData(testy2.reverse().concat(testy1)); 
    } else {
      setData(initalData_);
    }
    return true;
  }
  var loadData = function(now, callback) {
    var reqparams  = {'timestamp' : {'$gte' : now.startOf('day').utc().valueOf() }, 'sort' : {'timestamp' : 1}};        
    if (opts.requestParameters) {
      for (var o in opts.requestParameters) {
        reqparams[o] = opts.requestParameters[o];
      }
    }        
    $.getJSON(opts.requestUrl, reqparams).success(function(rd){
      var initalData = [];
      datalength = rd.data.length;
      for (var i = 0, ix = (bars - 1); i <= ix; ++i) {
        initalData[i] = { time: i, originalValue: 0, value: 0 }
      }                           
      calc(rd.data, initalData); 
      if (keepRawData) setRawData(rd.data);                  
      if (typeof(callback) === 'function') callback(null);
    });
  }
  this.loadData = loadData;
  this.init = function(now, callback) {
    if (!opts.startBar) opts.startBar = 'currentHour';
    switch (opts.startBar) {
      case 'currentMinute':
        startBar = now.minute();
        break;
      default:
        startBar = now.hour();   
    }
    
    loadData(now, function(error) {
      if (error === null) create();
      if (typeof(callback) === 'function') callback(error);
    });
  }
}

var TopViewChart = function(opts, data_) {  
  //@TODO: Refactor to backbone     
  var x = d3.scale.linear()
      .domain([0, 1])
      .range([0, opts.width - 13]);

  var y = d3.scale.linear()
      .domain([0, opts.height])
      .rangeRound([0, opts.height]);

  var data = data;
  var maxValue = 0;
  var maxValueData = 0;
  var chart = null;
  var scaleFactor = 1;  
  var bars = opts.bars || 5;  
  var mapKey = opts.mapKey || null;
  var keyNormalizeRegExp = opts.keyNormalizeRegExp || null;
  var refreshInterval = opts.refreshInterval || 900000;

  this.setChart = function(chart_) {
    chart = _chart;
  }

  this.getChart = function() {
    return chart;
  }

  this.getData = function() {
    return data;
  }

  var setData = function(data_) {
    data = data_;
  }
  this.setData = setData;  

  var redraw = function(data_) {
    if (!data_) data_ = data; 
    else setData(data_);   
    //@TODO: Transistion redraw
    chart.selectAll('g.datagroup').remove();     
    create(calc(data_));
  }
  this.redraw = redraw;

  var refreshIntervalTimer = null;
  var updateRefresh = 5000;
  var singleTimerVal = (refreshInterval / updateRefresh);  
  var actualTimerStep = singleTimerVal;
  var singleTimerHeight = (opts.height - 2) / singleTimerVal; 
  var refreshTimerRect = null;
  var timerRedraw = function() {
    actualTimerStep = --actualTimerStep;
    if (actualTimerStep < 1) actualTimerStep = singleTimerVal;  
    var newH = actualTimerStep * singleTimerHeight;
    refreshTimerRect.transition().duration(1000).attr('y', opts.height  - (singleTimerHeight * actualTimerStep)).attr('height', newH);    
    return actualTimerStep;
  }
  this.timerRedraw = timerRedraw;

  var refreshBars = function() {
    var t = timerRedraw();
    if (t === 1) {
      window.clearInterval(refreshIntervalTimer);
      refreshTimerRect.transition().duration(1000).attr('y', opts.height).attr('height', 0); 
      loadData(function() {
        refreshIntervalTimer = window.setInterval(refreshBars, updateRefresh);
      });
    }
  }  
  this.refreshBars = refreshBars;
  
  var create = function(data_) {     
    if (!data_) return false;
    $(opts.el).children('span').remove();
    
    if (chart === null) chart = d3.select(opts.el).append('svg')
      .attr('class', 'chart');
    
    chart.attr('width', (opts.width))
      .attr('height', opts.height);               
    var barHeight = opts.height / bars;
    var textCenterYHelper = ((barHeight +2) - 16) / 2;
    chart.selectAll('rect.datagroup')
      .data(data_)
    .enter().append('g')
      .attr('data-key', function(d) { return d.key; })
      .attr('data-value', function(d) { return (d.count * scaleFactor); })
      .attr('class', 'datagroup')      
      .append('rect')
        .attr('x', 0)
        .attr('y', function(d, i) { return (i * barHeight); })
        .attr('width', function(d, i) { return y(d.count); })
        .attr('height', barHeight);   
    chart.selectAll('g')
      .append('svg:text')
        .attr('x', 3)
        .attr('y', function(d, i) { return (i * barHeight) + ((barHeight / 2)) + textCenterYHelper; })
        .style('fill', '#FFF')
        .style('font-size', '0.8em')
        .attr('class', function(d, i) { return 'valuetext' + i; })
        .text(function(d, i) {  if (d.key.length > 40) d.key = d.key.substring(d.key.length-40, d.key.length); return d.key;});
    chart.selectAll('g')
      .append('svg:text')
        .attr('x', function(d, i) { 
          var ab = 20; if (d.count>99) ab = 30; else if (d.count > 999) ab = 35; 
          var bp = y(d.count-ab), tl = chart.select('.valuetext'+i).node().getComputedTextLength() + ab;
          if (bp >= tl) return bp; else return tl; 
        })
        .attr('y', function(d, i) { return (i * barHeight) + ((barHeight / 2)) + textCenterYHelper; })
        .style('fill', '#FFF')
        .style('font-size', '0.8em')
        .text(function(d, i) { return  Math.round(d.count *scaleFactor) });
    if (refreshTimerRect === null) {
      refreshTimerRect = chart.append('rect')
        .attr('x', opts.width - 10)
        .attr('y', 0)
        .attr('width', 10)
        .attr('height', opts.height - 2)
        .style('fill', '#00CC00')
        .attr('class', 'timerrect');
    }
  }
  this.create = create;

  var calc = function(dataSet_) {
    var topMap = {}; 
    var topArr = [];
    _.map(dataSet_, function(v, k) { 
      if (!topMap[v[mapKey]]) topMap[v[mapKey]] = 1; else {
        topMap[v[mapKey]]++;
      }
      return true;
    });
    maxValueData = _.max(topMap, function(d) {      
      return d;
    });
    maxValue = maxValueData; 
    scaleFactor = 1;
    while (maxValue > (opts.width - 13)) {
      scaleFactor = scaleFactor + .75;      
      maxValue = maxValueData / scaleFactor;           
    }
    if (scaleFactor > 1) {
      for (var i in topMap) {
        topMap[i] = topMap[i] / scaleFactor;    
      } 
    } 
    var regExpErg = null;
    for (var t in topMap) {
      var k = t;
      if (keyNormalizeRegExp !== null) {
        regExpErg = keyNormalizeRegExp.exec(k);
        if (regExpErg === null) continue;
        else {
          k = regExpErg[regExpErg.length - 1];
        }
      }
      topArr.push({ key: k, count: topMap[t]});
    }
    topArr = topArr.sort(function(a, b) {           
      return (parseFloat(b.count) - parseFloat(a.count));
    });
    topArr = topArr.slice(0,bars);    
    return topArr;
  }
  var loadData = function(callback) {
    var reqparams  = {'timestamp' : {'$gte' : moment().startOf('day').utc().valueOf() }, 'sort' : {'timestamp' : 1}};        
    if (opts.requestParameters) {
      for (var o in opts.requestParameters) {
        reqparams[o] = opts.requestParameters[o];
      }
    }        
    $.getJSON(opts.requestUrl, reqparams).success(function(rd) { 
      if (chart === null) create(calc(rd.data)); else redraw(rd.data);      
      setData(rd.data);
      if (typeof(callback) === 'function') callback(null);
    });
  }
  this.loadData = loadData;
  this.init = function(data_, callback) { 
    if (!data_) {
      loadData(function() {
        if (typeof(callback) === 'function') callback(null);  
        if (refreshIntervalTimer === null) refreshIntervalTimer = window.setInterval(refreshBars, updateRefresh);
      });      
    } else {  
      create(calc(data_));
      setData(data_);
      if (typeof(callback) === 'function') callback(null);
      if (refreshIntervalTimer === null) refreshIntervalTimer = window.setInterval(refreshBars, updateRefresh);
    }
  }
}


