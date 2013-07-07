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
    this.gridOptions = {
        url: this.model.get('dataCollection').url,
        datatype: 'json',
        postData: {},
        mtype: 'GET',
        cmTemplate: { 
          sortable: true, hidden: false, editable: false, 
          searchoptions: { 
            sopt: ['eq','ne','lt','le','gt','ge']
          }
        },
        colNames: [],
        colModel: [],
        jsonReader : {
          id: '_id',
          repeatitems: true,
          root: 'data',
          total: function (obj) { return obj.total; },
          records: function (obj) { return obj.records; },
          page: function (obj) { return 1; }
        },        
        idPrefix: this.model.get('modelName'),
        prmNames: { nd: '_' },
        height: '100%',
        autowidth: true,
        shrinkToFit: true,
        loadonce: false,
        pager: '#pager' + this.model.cid,
        rowNum: 30,
        rowList: [10, 30, 50, 100, 1000],
        pgbuttons: false,
        pginput: false,        
        hidegrid: true,
        sortable: true,        
        sortname: "_id",
        sortorder: "desc",
        scroll: false,
        viewrecords: true,
        gridview: true,
        autoencode: true,
        caption: ''
    }
    var colModelInit = [];
    this.gridOptions.colNames.push('_id');
    this.gridOptions.colModel.push({ name: '_id', width: '140px', hidden: false, frozen: true, sortable: false, searchoptions:{ sopt:['eq'] }});
    for (var a = 0, ax = this.model.attributes.keys.length; a < ax; ++a) {
      var attr = this.model.attributes.keys[a];
      if (attr === '_id') continue;
      this.gridOptions.colNames.push(attr);
      this.gridOptions.colModel.push({ 
        name: attr
      });
    }    
    var savedColModel = localStorage.getItem(this.gridOptions.idPrefix);
    if (savedColModel) {
      savedColModel = JSON.parse(savedColModel);
      for (var s in savedColModel) {
        if (savedColModel[s].hidden === true) {
          for (var c in this.gridOptions.colModel) {
            if (this.gridOptions.colModel[c].name === savedColModel[s].name) this.gridOptions.colModel[c].hidden = true;
          }
        }
      }
    }
    $(this.el).jqGrid(this.gridOptions);   
    $(this.el).jqGrid('navGrid', this.gridOptions.pager, {edit:false,add:false,del:false,refresh:true,search:true}, {}, {}, {}, {multipleSearch:true, showQuery: true, multipleGroup: false} );
    $(this.el).jqGrid('filterToolbar',{searchOperators : false});
    var thatel = $(this.el);
    $(this.el).jqGrid('navButtonAdd', this.gridOptions.pager, { 
      caption: "Columns", title: "Reorder Columns", 
      onClickButton : function (){ 
        thatel.jqGrid('columnChooser', {
          done: function(perm) {            
            if (perm) {
              localStorage.setItem(this.getGridParam('idPrefix'), JSON.stringify(this.getGridParam('colModel')));             
            }
          }
        });
      } 
    });
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
    mainElem.hide();    
    var headerElem = $('<div>', {
      'class' : 'collectionHeader ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all',
      html : 'Workbench: <span class="modelName">'+model.get('modelName')+'&nbsp;</span>(<span class="modelCount"></span>)'
    });
    headerElem.on('click', model, this.removeWorkbench);
    mainElem.append(headerElem);    
    this.workbenchElem.append(mainElem);    
    var contentElem = $('<table>', { 'id' : 'table'+model.cid }); 
    mainElem.append(contentElem);
    var contentElemPager = $('<div>', { 'id' : 'pager'+model.cid }); 
    mainElem.append(contentElemPager);

    // init view for data
    if (!model.has('dataView')) model.set('dataView', new C_dataView({ 
      model: model,
      el: contentElem
    }));
    var countRefreshTimer = window.setInterval(function() {
      headerElem.find('span.modelCount').html(model.count())
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
      modelElem.find('.collectionHeader span.modelCount').html(model.count());
      modelElem.show();  
    } else {
      modelElem.hide();
    }
  }
});