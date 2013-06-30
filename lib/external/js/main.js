var DataCollection = Backbone.Collection.extend({
});
var SchemaModel = Backbone.Model.extend({
  idAttribute: '_id',  
  dataCollection: null,
  dataView: null,
  initialize: function(opts_) {
    this.listenTo(this, 'change', this.changeFunc);
  },
  changeFunc : function(d) {
    //console.log('add', d.changed);
  },
  count: function() {    
    var mn = this.get('modelName');
    var count = null;
    $.ajax({
      url: '/api/db/count/'+this.get('modelName'),      
      async: false,
      cache: false,
      success: function(d) {        
        count = d;
      },
      complete: function(xhr, status) {
        if (status !== 'success') alert('/api/db/count failed for model "'+mn+'"\n\rStatus: '+status);        
      },
      error: function() {        
      }
    });
    return count;
  }
});
var SchemaCollection = Backbone.Collection.extend({
  model: SchemaModel
});
/*
######## ##     ## ########   #######  ########  ######## 
##        ##   ##  ##     ## ##     ## ##     ##    ##    
##         ## ##   ##     ## ##     ## ##     ##    ##    
######      ###    ########  ##     ## ########     ##    
##         ## ##   ##        ##     ## ##   ##      ##    
##        ##   ##  ##        ##     ## ##    ##     ##    
######## ##     ## ##         #######  ##     ##    ##    
*/
var C_exportView = Backbone.View.extend({      
  menuElem: null,
  workbenchElem: null,  
  workbenchContentElem: null,
  socket: null,
  events: {
    'click li': 'openWorkbench',
    'change .csvseperator' : 'changeCSVSeperator',
    'keyup .csvseperator' : 'changeCSVSeperator'
  },
  initialize: function(opts_) {
    this.socket = opts_.socket || null;
    this.workbenchElem = opts_.workbenchElem || null;
    this.menuElem = opts_.menuElem || null;    
    if (this.menuElem === null || this.workbenchElem === null) throw ('Need menu and workbench Elements (as jQuery object)');
    if (typeof(opts_.workbenchContentElem) === 'undefined') {
      this.workbenchContentElem = $('<div>', { 'class': 'workbenchcontent ui-widget ui-widget-content ui-corner-all'});      
    } else this.workbenchContentElem = opts_.workbenchContentElem;    
    this.listenTo(this.model, 'add', this.addCollectionToMenu);
  },
  render : function(opts_) {
    this.menuElem.menu();        
    this.$el.append(this.menuElem);
    this.menuElem.show();
    this.workbenchElem.append('<div class="ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all" id="activeCollectionHeader">Workbench: <span>(select a collection)</span></div>');        
    var csvSeperatorInpElem = $('<input>', {
      'class' : 'csvseperator',
      'id'    : 'csvseperator',
      type    : 'text',
      style   : 'width: 1em;',
      required: 'required',
      value   : localStorage.getItem('csvseperator') || ';'
    });
    var d = $('<div>', { 'class' : 'options ui-widget ui-widget-content ui-corner-all', html: 'CSV Seperator:&nbsp;'})
    d.append(csvSeperatorInpElem);
    this.$el.append(d);  
    this.workbenchElem.append(this.workbenchContentElem);  
  },
  changeCSVSeperator : function(e) {
    var v = $(e.currentTarget).val();
    if (v !== '') localStorage.setItem('csvseperator', v);
  },
  addCollectionToMenu : function(model) {            
    var aElem = $('<a>', {          
      href: '#',
      text: model.get('modelName')
    })
    var liElem = $('<li>', {
      id: 'collection_'+model.get('modelName'),          
      html: aElem
    });
    liElem.data('modelId', model.cid);
    this.menuElem.append(liElem);
    return this;
  },
  openWorkbench: function(ev){
    var modelId = $(ev.currentTarget).data('modelId');
    var model = this.model.get(modelId);         
    this.workbenchElem.find('#activeCollectionHeader span').html(model.get('modelName'));  
    this.workbenchContentElem.children().remove();

    this.workbenchContentElem.append('<div>Count: '+model.count()+'</div>');        
    var statusSpan = $('<span>');
    var statusDiv = $('<div>', { html: 'Progress: '});
    statusDiv.append(statusSpan);
    this.workbenchContentElem.append(statusDiv);
    socket.emit('requestExport', { modelName: model.get('modelName'), seperator: $('input#csvseperator').val() });
    socket.on('exportProgress', function(data) {
      statusSpan.html(data);
    });
    socket.on('exportDone', function(data) {
      statusDiv.html('<a href="/download/'+data+'">File ready to download: '+data+'</a>');
      statusDiv.append('<div style="font-size: 0.8em;padding-top:0.5em;padding-bottom:0.5em;">Beware: Link expires after 1 hour after download!</div>');
    });
  }
});
/*
#### ##    ## ########  ######## ##     ## 
 ##  ###   ## ##     ## ##        ##   ##  
 ##  ####  ## ##     ## ##         ## ##   
 ##  ## ## ## ##     ## ######      ###    
 ##  ##  #### ##     ## ##         ## ##   
 ##  ##   ### ##     ## ##        ##   ##  
#### ##    ## ########  ######## ##     ##
*/

var C_dataView = Backbone.View.extend({ 
  model: null,
  initialize: function(opts_) {       
    this.listenTo(this.model, 'sync', this.render);  
  },
  render : function(model, data, opts) {
    var tbl = $('<table>', { 'class' : 'collectionContentDataTable'});
    tbl.append('<thead>')
    var tblhead = $('<tr>');
    var tblbody = $('<tbody>');
    // create table header from first model
    var paths = opts.data.fields.split(' ');
    for (var key in paths) {
      tblhead.append('<th>'+paths[key]+'</th>');  
    }
    tbl.find('thead').append(tblhead);
    _.each(model.models, function(el, idx) {
      var tr = $('<tr>');
      _.each(el.attributes, function(value, key) {
        var cont = null;
        if (typeof(value) === 'string') cont = value;
        else if (typeof(value) === 'number') cont = value;
        else if (typeof(value) === 'object') cont = JSON.stringify(value);
        else cont = '';
        tr.append('<td>'+cont+'</td>');
      }, this);
      tblbody.append(tr);
    }, model);
    this.$el.children().remove();
    tbl.append(tblbody);
    this.$el.append(tbl);
  }
});
var C_indexView = Backbone.View.extend({      
  menuElem: null,
  workbenchElem: null,  
  events: {
    'click li': 'openWorkbench'
  },
  initialize: function(opts_) {
    this.workbenchElem = opts_.workbenchElem || null;
    this.menuElem = opts_.menuElem || null;    
    if (this.menuElem === null || this.workbenchElem === null) throw ('Need menu and workbench element (as jQuery object)');    
    this.listenTo(this.model, 'add', this.addCollectionToMenu);
  },
  render : function() {
    this.menuElem.menu();        
    this.$el.append(this.menuElem);
    this.menuElem.show();    
  },
  addCollectionToMenu : function(model) {            
    var aElem = $('<a>', {          
      href: '#',
      text: model.get('modelName')
    })
    var liElem = $('<li>', {
      id: 'collection_'+model.get('modelName'),          
      html: aElem
    });
    liElem.data('modelId', model.cid);
    this.menuElem.append(liElem);
    return this;
  },
  setupModel : function(model) {
    var mainElem = $('<div>', {
      'class' : 'collectionMain ui-helper-reset ui-helper-clearfix ui-widget ui-widget-content ui-corner-all',
      id : model.cid
    }); 
    var mainTableElem = $('<table class="collectionContentTable">');
    var mainTableBodyElem = $('<tbody>');
    var mainTableBodyTRElem = $('<tr>');
    mainTableBodyElem.append(mainTableBodyTRElem);
    mainTableElem.append(mainTableBodyElem);
    var headerElem = $('<div>', {
      'class' : 'collectionHeader ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all',
      html : 'Workbench: <span class="modelName">'+model.get('modelName')+'&nbsp;</span>(<span class="modelCount"></span>)'
    });
    mainElem.append(headerElem);
    mainElem.append(mainTableElem);
    this.workbenchElem.append(mainElem);
    var tempTD = $('<td>', { 'class' : 'collectionContentTableLeft'});
    var controlElem = $('<div>', {
      'class' : 'collectionControl ui-widget ui-widget-content ui-corner-all'
    });
    tempTD.append(controlElem);
    mainTableBodyTRElem.append(tempTD);
    tempTD = $('<td>', { 'class' : 'collectionContentTableRight'});
    var contentElem = $('<div>', { 'class': 'collectionContent ui-widget ui-widget-content ui-corner-all'}); 
    tempTD.append(contentElem);
    mainTableBodyTRElem.append(tempTD);
    var btnDiv = $('<div>');
    var btnFetch = $('<button>', { text: 'Fetch'}).button({icons: {primary : 'ui-icon-refresh'}});
    var btnClear = $('<button>', { text: 'Clear'}).button({icons: {primary : 'ui-icon-cancel'}});
    var btnRemove = $('<button>', { text: 'Remove'}).button({icons: {primary : 'ui-icon-closethick'}});
    btnFetch.on('click', model, this.processQuery);
    btnClear.on('click', model, this.clearControlElements);    
    btnRemove.on('click', model, this.removeWorkbench);
    btnDiv.append(btnFetch);
    btnDiv.append(btnClear);
    btnDiv.append(btnRemove);
    controlElem.append(btnDiv); 

    var tbl = $('<table>');
    var tblbody = $('<tbody>');
    tbl.append('<thead><tr><th title="Sort?">S</th><th title="Include?">I</th><th title="Fieldname">Path</th><th title="Query">Filter</th></thead>');
    var fetchData = localStorage.getItem(model.get('modelName')+'fetchData'); 
    if (fetchData === null) fetchData = {};
    else fetchData = JSON.parse(fetchData);

    for (var a = 0, ax = model.attributes.keys.length; a < ax; ++a) {
      var key = model.attributes.keys[a];
      var tr = $('<tr>');
      var tdsort = $('<td>');
      var tdinc = $('<td>');
      var tdlabel = $('<td>');
      var tdqry = $('<td>');
      var ctrlElemId = key + model.cid;
      var inpTemp =$('<input>', { type: 'checkbox', 'class' : 'sortselector'});      
      if (fetchData !== null && fetchData.sort) {                  
        if (fetchData.sort[key]) inpTemp.prop('checked', true); else inpTemp.prop('checked', false);  
      } else {
        inpTemp.prop('checked', false);
      }
      tdsort.append(inpTemp);
      inpTemp =$('<input>', { type: 'checkbox', 'class' : 'includeselector'});
      if (key.indexOf('_') === 0) inpTemp.addClass('includeselectorinternal');      
      if (key === 'id') {
        inpTemp.prop('checked', true);
        inpTemp.prop('disabled', true);
      } else if (fetchData !== null && fetchData.fields) {
        if (fetchData.fields.indexOf(key) === -1) inpTemp.prop('checked', false); else inpTemp.prop('checked', true);  
      } else {
        if (inpTemp.hasClass('includeselectorinternal')) inpTemp.prop('checked', false); else inpTemp.prop('checked', true);  
      } 
      tdinc.append(inpTemp);
      tdlabel.append('<label class="controlElem" for="'+ctrlElemId+'">'+key+'</label>');
      tdqry.append('<input class="controlElem" id="'+ctrlElemId+'">');
      tr.data('key', key);
      tr.append(tdsort);
      tr.append(tdinc);
      tr.append(tdlabel);
      tr.append(tdqry);
      tblbody.append(tr);
    }    
    tbl.append(tblbody);
    controlElem.append(tbl);         
    mainElem.draggable({ stack: '.collectionMain', scope: '.collectionMain' });
    mainElem.resizable({ minWidth: tbl.width(), minHeight: 100 });
    mainElem.on('keyup', 'input.controlElem', model, this.processQuery);
    // init view for data
    if (!model.has('dataView')) model.set('dataView', new C_dataView({ 
      model: model.get('dataCollection'),
      el: contentElem, 
    }));
    var countRefreshTimer = window.setInterval(function() {
      headerElem.find('span.modelCount').html(model.count())
    }, 300000);
    model.set('countRefreshTimer', countRefreshTimer);
  },
  processQuery: function(ev) {
    var model = ev.data;
    var key = ev.keyCode;
    var fieldsArray = [];
    var data = { sort : {}};    
    if (key === 13 || ev.type === 'click') {      
      var modelElem = $('#' + model.cid);
      modelElem.find('input').each(function(){
        var key = $(this).parent().parent().data('key');
        if ($(this).hasClass('sortselector') && $(this).prop('checked') === true) {
          data.sort[key] = -1;
        } else if ($(this).hasClass('includeselector') && $(this).prop('checked') === true) {
          fieldsArray.push(key);
        } else if ($(this).hasClass('controlElem') && $(this).val() !== '') {
          data[key] = $(this).val();          
        }        
      });
      if (fieldsArray.length > 0) data.fields = fieldsArray.join(' '); 
      else alert('You have to select at least 1 path');
      localStorage.setItem(model.get('modelName')+'fetchData', JSON.stringify(data));      
      modelElem.find('.collectionContent').html('<div>Loading&hellip;</div>');
      model.get('dataView').model.fetch({
        reset: true, 
        data: data,
        error : function(model, response, options) {
          modelElem.find('.collectionContent').html('<div class="ui-state-error ui-corner-all"><div><span class="ui-icon ui-icon-alert" style="float: left; margin-right: .3em;"></span>Error: '+response.responseText+'</div></div>');          
        } 
      });      
    } else if (key === 27) {
      $(ev.currentTarget).val('');
    }
  },
  clearControlElements: function(ev){
    var model = ev.data;
    var modelElem = $('#' + model.cid);  
    localStorage.removeItem(model.get('modelName')+'fetchData');  
    modelElem.find('input').each(function(){
      if ($(this).hasClass('sortselector')) {
        $(this).prop('checked', false);        
      }
      else if ($(this).hasClass('includeselector')) {
        if ($(this).hasClass('includeselectorinternal')) $(this).prop('checked', false); else $(this).prop('checked', true);       
      }
      else if ($(this).hasClass('controlElem')) $(this).val('');      
    });
    modelElem.find('.collectionContent').children().remove();
  },
  removeWorkbench: function(ev){
    var model = ev.data;
    //window.clearInterval(model.get('countRefreshTimer'));
    $('#'+model.cid).hide();
  },
  openWorkbench: function(ev){
    var modelId = $(ev.currentTarget).data('modelId');
    var model = this.model.get(modelId); 
    if (document.getElementById(modelId) === null) {
      this.setupModel(model);
    } 
    var modelElem = $('#' + model.cid);
    modelElem.show();
    var modelContentElem = modelElem.find('.collectionContent');
    modelElem.find('.collectionHeader span.modelCount').html(model.count());
  }
});