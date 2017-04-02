
var ECS = ECS || (function(exports) {

  let systems, entities, entityCount;

  exports.init = function() {
    systems = {};
    exports.entities = entities = {};
    entityCount = 0;
  };

  exports.addSystem = function(events, callback) {
    for (let evt of events) {
      if (systems[evt] == null)
        systems[evt] = [];
      systems[evt].push(callback);
    }
  };

  let publishEvent = exports.publishEvent = function(event) {
    for (let system of systems[event.kind]) {
      system(event, entities);
    }
  }

  let killEntity = exports.killEntity = function(id, reason) {
    entities[id].handle({kind: "killed", reason: reason});
    delete entities[id];
    publishEvent({kind: "killed", id: id, reason: reason});
  };

  function generateId() {
    return entityCount++;
  }

  class Entity {
    constructor(components) {
      this.components = components;
      this.componentQueues = {};
      this.id = generateId();
      this.addedComponents = [];
      this.removedComponents = [];
      entities[this.id] = this;

      this.buildQueues();
    }

    buildQueues() {
      this.componentQueues = {};
      for (let i = 0, l = this.components.length; i < l; i++) {
        let comp = this.components[i];
        let kinds = comp._events || Object.keys(comp);
        for (let kind of kinds) {
          let handler = comp[kind];
          let last = this.componentQueues[kind];
          if (last)
            this.componentQueues[kind] = (evt, ent) => handler.call(comp, last(evt, ent) || evt, ent, i);
          else
            this.componentQueues[kind] = (evt, ent) => handler.call(comp, evt, ent, i);
        }
      }
    }

    handle(evt) {
      if (!this.componentQueues[evt.kind])
        return null;
      evt = this.componentQueues[evt.kind](evt, this);
      this.updateComponents();
      return evt;
    }

    updateComponents() {
      let did = false;
      if (this.removedComponents.length > 0) {
        let o = 0;
        for (let i of this.removedComponents) {
          this.components.splice(i-o, 1);
          o++
        }
        this.removedComponents.length = 0;
        did = true;
      }
      if (this.addedComponents.length > 0) {
        for (let c of this.addedComponents) {
          this.components.push(c);
        }
        this.addedComponents.length = 0;
        did = true;
      }
      if (did)
        this.buildQueues();
    }

    query(kind) {
      return this.handle({kind: kind});
    }

    publish(event) {
      event.from = this.id;
      exports.publishEvent(event);
    }

    addComponent(comp) {
      this.addedComponents.push(comp);
    }

    removeComponent(index) {
      this.removedComponents.push(index);
    }

    kill(reason) {
      killEntity(this.id, reason);
    }
  }

  exports.Entity = Entity;

  return exports;
})({});
