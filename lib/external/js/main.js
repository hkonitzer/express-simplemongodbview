var DataModel = Backbone.Model.extend({
  idAttribute: '_id'
});
var DataCollection = Backbone.Collection.extend({
  model: DataModel
});
var SchemaModel = Backbone.Model.extend({
  idAttribute: '_id',
  dataCollection: null,  
  count: function() {    
    var mn = this.get('modelName');
    var count = null;
    $.ajax({
      url: '/api/db/count/'+this.get('modelName'),
      dataType: 'json',
      async: false,
      cache: false,
      success: function(d) {
        count = d.data;
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
var C_indexView = Backbone.View.extend({      
  menuElem: null,
  workbenchElem: null,  
  events: {
    'click li': 'openWorkbench'
  },
  initialize: function(opts_) {
    this.workbenchElem = opts_.workbenchElem || null;
    this.menuElem = opts_.menuElem || null;    
    if (this.menuElem === null || this.workbenchElem === null) throw ('Need menu and workbench Elements (as jQuery object)');
    if (typeof(opts_.workbenchContentElem) === 'undefined') {
      this.workbenchContentElem = $('<div>', { 'class': 'ui-widget ui-widget-content ui-corner-all'});      
    } else this.workbenchContentElem = opts_.workbenchContentElem;    
    this.listenTo(this.model, 'add', this.addCollectionToMenu);
  },
  render : function() {
    this.menuElem.menu();        
    this.$el.append(this.menuElem);
    this.menuElem.show();
    this.workbenchElem.append('<div class="ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all" id="activeCollectionHeader">Workbench: <span>(select a collection)</span></div>');        
    this.workbenchElem.append(this.workbenchContentElem);        
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
  }
});