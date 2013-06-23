var DataModel = Backbone.Model.extend({
      idAttribute: '_id'
});
var DataCollection = Backbone.Collection.extend({
  model: DataModel
});
var SchemaModel = Backbone.Model.extend({
  idAttribute: '_id',
  dataCollection: null
});
var SchemaCollection = Backbone.Collection.extend({
  model: SchemaModel
});
var CollectionView = Backbone.View.extend({      
  menuElem: null,
  workbenchElem: null,  
  events: {
    'click li': 'openWorkbench'
  },
  initialize: function(opts_) {
    this.workbenchElem = opts_.workbenchElem || null;
    this.menuElem = opts_.menuElem || null;
    if (this.menuElem === null || this.workbenchElem === null) throw ('Need menu and workbench Elements (as jQuery object)');
    this.listenTo(this.model, 'add', this.addCollectionToMenu);
  },
  render : function() {
    this.menuElem.menu();        
    this.$el.append(this.menuElem);
    this.menuElem.show();
    this.workbenchElem.append('<div id="activeCollectionHeader">Workbench: <span>(select a collection)</span></div>');        
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
    this.workbenchElem.find('span').html(model.get('modelName'));        
  }
});