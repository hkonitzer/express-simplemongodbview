var DataCollection = Backbone.Collection.extend({
});
var SchemaModel = Backbone.Model.extend({
  idAttribute: '_id',  
  dataCollection: null,
  dataView: null,
  modelName: null,
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
  gridOptions: null,
  initialize: function(opts_) {       
    //this.listenTo(this.model, 'sync', this.render); 
    // postData: { fields : 'Ktnr KuKla Misch Grp Anz_best Anz_GS Nums_w Ret_w created'},    
    var modelcid = this.model.cid;
    $(this.el).append('<a href="/collection/'+this.model.get('modelName')+'" target="_blank">Open Workbench</a>');
    $(this.el).append('<div>Count: <span class="modelCount"></span></div>');
    var props = this.model.get('properties');    
    var propListElem = $('<ul>');
    var propElem = null;
    for (var i = 0, ix = props.length; i < ix; ++i) {
      var p = props[i];
      var propElem = $('<li>'+p.property+': '+p.type+', Index: '+p.index+'</li>');
      propListElem.append(propElem);
    }
    $(this.el).append(propListElem);
    
  },
  render : function(model, data, opts) {    
    
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
      'class': 'sepcialmenuitem',
      text: model.get('modelName')
    })
    var liElem = $('<li>', {
      id: 'collection_'+model.get('modelName')
    });
    liElem.append(aElem);
    
      
    
    
    liElem.data('modelId', model.cid);
    this.menuElem.append(liElem);
    return this;
  },
  setupModel : function(model) {
    var mainElem = $('<div>', {
      'class' : 'collectionMain ui-helper-reset ui-helper-clearfix ui-widget ui-widget-content ui-corner-all',
      id : model.cid
    }); 
    mainElem.hide();    
    var headerElem = $('<div>', {
      'class' : 'collectionHeader ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all'
    });
    headerElem.append('<div class="collectionHeaderText"><span class="modelName">'+model.get('modelName')+'&nbsp;</span></div>');
    headerElem.append('<div class="collectionHeaderAjaxLoader"><img src="/external/img/ajax-loader.gif"></div>');
    var closeElem = $('<span style="float:right;cursor:pointer;margin-top:0.2em;" class="ui-icon ui-icon-closethick"></span>')
    headerElem.append(closeElem);
    closeElem.on('click', model, this.removeWorkbench);
    mainElem.append(headerElem);    
    this.workbenchElem.append(mainElem);    
    var contentElem = $('<div>', { 'id' : 'table'+model.cid }); 
    mainElem.append(contentElem);    
    // init view for data
    if (!model.has('dataView')) model.set('dataView', new C_dataView({ 
      model: model,
      el: contentElem
    }));
    mainElem.draggable().resizable();
    var countRefreshTimer = window.setInterval(function() {
      mainElem.find('span.modelCount').html(model.count())
    }, 300000);
    model.set('countRefreshTimer', countRefreshTimer);
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
    if (modelElem.filter(':hidden').length === 1) {
      modelElem.find('span.modelCount').html(model.count());
      modelElem.show();  
    } else {
      modelElem.hide();
    }
    
    var colview = window.open('/collection/'+model.get('modelName'), 'Collection View', 'resizable=yes,dependent=no,toolbar=no,status=yes,menubar=no,location=no');
    colview.focus();
  }
});