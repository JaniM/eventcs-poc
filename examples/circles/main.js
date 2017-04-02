
(function() {
  "use strict";

  let pooled = (f) => {
    let pool = {};
    return (...args) => {
      let layer = pool;
      for (let arg of args) {
        if (!layer[arg])
          layer[arg] = {};
        layer = layer[arg];
      }
      let values = layer["_"] || (layer["_"] = []);
      if (values.length)
        return values.pop();
      let v = f(...args);
      v.release_pool = () => values.push(v);
      return v;
    };
  };

  let pooledGraphics = (f) => {
    let pooler = pooled(f);
    return (...args) => {
      let g = pooler(...args);
      g.scale.x = 1;
      g.scale.y = 1;
      return g;
    };
  };

  let rect = pooledGraphics((x, y, w, h, c) => {
    let g = new PIXI.Graphics();
    g.beginFill(c);
    g.drawRect(x, y, w, h);
    g.endFill();
    return g;
  });

  let circle = ((x, y, r, c) => {
    let g = new PIXI.Graphics();
    g.beginFill(c);
    g.drawCircle(x, y, r);
    g.endFill();
    return g;
  });

  let circleDrawer = (c) => ({
    "draw": (evt, ent) => {
      let pos = ent.query("position");
      let radius = ent.query("radius");
      let f = (g) => {
        evt.f && evt.f(g);
        g.beginFill(c);
        g.drawCircle(pos.x, pos.y, radius.radius);
        g.endFill();
      };
      return {kind: "draw", f: f};
    }
  });

  function StaticGraphic(graphic) {
    this.g = graphic;
  }
  StaticGraphic.prototype = {
    "_events": ["graphic"],
    "graphic": function(evt, ent) {
      return {kind: "graphic", graphic: this.g};
    }
  };

  let staticGraphic = (graphic) => new StaticGraphic(graphic);

  let positionGraphic = {
    "graphic": (evt, ent) => {
      let pos = ent.query("position");
      evt.graphic.position.x = pos.x;
      evt.graphic.position.y = pos.y;
      return evt;
    }
  };

  function StaticSize(w, h) {
    this.w = w;
    this.h = h;
  }
  StaticSize.prototype = {
    "_events": ["size"],
    "size": function(evt, ent) {
      return {kind: "size", width: this.w, height: this.h}
    }
  };

  let staticSize = (w, h) => new StaticSize(w, h);

  function StaticRadius(r) {
    this.r = r;
  }
  StaticRadius.prototype = {
    "_events": ["radius"],
    "radius": function(evt, ent) {
      return {kind: "radius", radius: this.r}
    }
  };

  let staticRadius = (r) => new StaticRadius(r);

  function StaticPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  StaticPosition.prototype = {
    "_events": ["position"],
    "position": function(evt, ent) {
      return {kind: "position", x: this.x, y: this.y};
    }
  };

  let staticPosition = (x, y) => new StaticPosition(x, y);

  let clickable = (cb) => ({
    "mousedown": (evt, ent) => {
      cb(evt, ent);
      return evt;
    }
  });

  let hitbox = () => ({
    "hitbox": (evt, ent) => {
      let pos = ent.query("position");
      let size = ent.query("size");
      return {kind: "hitbox", x: pos.x, y: pos.y, w: size.width, h: size.height};
    },
    "touchesPoint": (evt, ent) => {
      let hit = ent.query("hitbox");
      return {kind: "touchesPoint", yes: (evt.x > hit.x && evt.x < hit.x + hit.w && evt.y > hit.y && evt.y < hit.y + hit.h)}
    }
  });

  let hitcircle = () => ({
    "hitbox": (evt, ent) => {
      let pos = ent.query("position");
      let size = ent.query("size");
      return {kind: "hitbox", x: pos.x - size.width/2, y: pos.y - size.height/2, w: size.width, h: size.height};
    },
    "hitcircle": (evt, ent) => {
      let pos = ent.query("position");
      let size = ent.query("radius");
      return {kind: "hitcircle", x: pos.x, y: pos.y, r: size.radius};
    },
    "touchesPoint": (evt, ent) => {
      let hit = ent.query("hitcircle");
      let x = (evt.x - hit.x);
      let y = (evt.y - hit.y);
      return {kind: "touchesPoint", yes: Math.sqrt(x*x + y*y) <= hit.r}
    }
  });

  function StaticVelocity(x, y) {
    this.x = x;
    this.y = y;
  }
  StaticVelocity.prototype = {
    "_events": ["velocity"],
    "velocity": function(evt, ent) {
      return {kind: "velocity", x: this.x, y: this.y};
    }
  };

  let staticVelocity = (x, y) => new StaticVelocity(x, y);

  let staticAcceleration = (ax, ay) => ({
    "acceleration": (evt, ent) => ({kind: "acceleration", x: ax, y: ay})
  });

  let staticDrag = (d) => {
    let drag = 1;
    return ({
      "tick": (evt, ent) => {
        drag -= evt.delta / d;
        if (drag < 0) drag = 0;
        return evt;
      },
      "velocity": (evt, ent) => {
        evt.x = evt.x * drag;
        evt.y = evt.y * drag;
        return evt;
      }
    });
  };

  function ApplyVelocity() {
    this.x = 0;
    this.y = 0;
  }
  ApplyVelocity.prototype = {
    "_events": ["tick", "position"],
    "tick": function(evt, ent) {
      let vel = ent.query("velocity");
      this.x += vel.x * evt.delta;
      this.y += vel.y * evt.delta;
      return evt;
    },
    "position": function(evt, ent) {
      evt.x = evt.x ? evt.x + this.x : this.x;
      evt.y = evt.y ? evt.y + this.y : this.y;
      return evt;
    }
  };

  let applyVelocity = () => new ApplyVelocity();
  
  let applyAcceleration = () => {
    let vx = 0, vy = 0;
    return ({
      "tick": (evt, ent) => {
        let acc = ent.query("acceleration");
        vx += acc.x * evt.delta;
        vy += acc.y * evt.delta;
        return evt;
      },
      "velocity": (evt, ent) => {
        evt.x = evt.x ? evt.x + vx : vx;
        evt.y = evt.y ? evt.y + vy : vy;
        return evt;
      }
    });
  };

  let killIf = (cond, reason) => ({
    "tick": (evt, ent) => {
      if (cond(ent))
        ECS.killEntity(ent.id, reason);
      return evt;
    }
  });

  let killAfter = (t) => ({
    "tick": (evt, ent) => {
      t -= evt.delta;
      if (t <= 0)
        ECS.killEntity(ent.id);
      return evt;
    }
  });

  let ifCond = (cond, cb) => ({
    "tick": (evt, ent) => {
      if (cond(ent))
        cb(ent);
      return evt;
    }
  });

  let onDeath = (cb) => ({
    "killed": (evt, ent) => {
      cb(evt, ent);
      return evt;
    }
  });

  let clickableTarget = (outtime) => ({
    "mousedown": (evt, ent, self) => {
      let pos = ent.query("position");
      ent.addComponent(staticPosition(pos.x, pos.y));
      ent.addComponent(zoomOut(outtime, () => ent.kill("clicked")));
      ent.removeComponent(self);
      return evt;
    }
  });

  let zoomOut = (outtime, cb) => {
    let timer = outtime;
    return ({
      "tick": (evt, ent, self) => {
        timer -= evt.delta;
        if (timer <= 0) cb(ent, self);
        return evt;
      },
      "radius": (evt, ent) => {
        evt.radius *= timer/outtime;
        return evt;
      },
      "graphic": (evt, ent) => {
        let scale = timer/outtime;
        evt.graphic.scale.x = scale;
        evt.graphic.scale.y = scale;
        return evt;
      }
    });
  };

  let renderSystem = (stage) => {
    let graphics = {};
    return (event, entities) => {
      if (event.kind == "tick") {
        for (let id in entities) {
          let g = entities[id].handle({kind: "graphic"});
          if (!g) continue;
          g = g.graphic;
          if (graphics[id] !== g) {
            // console.log("Rerendering " + id);
            if (graphics[id] != null) {
              stage.removeChild(graphics[id]);
              if (graphics[id].release_pool)
                graphics[id].release_pool();
            }
            stage.addChild(g);
            graphics[id] = g;
          }
        }
      } else if (event.kind == "killed" && graphics[event.id]) {
        stage.removeChild(graphics[event.id]);
        if (graphics[event.id].release_pool)
          graphics[event.id].release_pool();
        delete graphics[event.id];
        // console.log("Removed graphic for entity " + event.id);
      }
    };
  };

  let drawSystem = (stage) => {
    let graphic = new PIXI.Graphics();
    stage.addChild(graphic);
    return (event, entities) => {
      graphic.clear();
      for (let ent of Object.values(entities)) {
        let draw = ent.query("draw")
        if (draw && draw.f) {
          draw.f(graphic);
        }
      }
    };
  };

  let mouseSystem = (interaction) => {
    let mouseDown = null, mouseUp = null, mouseMove = null;
    interaction.on('mousedown', (evt) => { mouseDown = evt.data.global; });
    interaction.on('mouseup', (evt) => { mouseUp = evt.data.global; });
    interaction.on('mousemove', (evt) => { mouseMove = evt.data.global; });
    return (evt, entities) => {
      if (mouseDown || mouseUp || mouseMove) {
        for (let ent of Object.values(entities)) {
          if (mouseDown) {
            let touch = ent.handle({kind: "touchesPoint", x: mouseDown.x, y: mouseDown.y});
            if (touch && touch.yes)
              ent.handle({kind: "mousedown", x: mouseDown.x, y: mouseDown.y});
          }
          if (mouseUp)
            ent.handle({kind: "mouseup", x: mouseUp.x, y: mouseUp.y});
          if (mouseMove)
            ent.handle({kind: "mousemove", x: mouseMove.x, y: mouseMove.y});
        }
        mouseDown = null; mouseUp = null; mouseMove = null;
      }
    };
  };

  let outElem = document.getElementById("out");

  // The basic update function
  function gameUpdate(state, delta, totalTime) {
    // console.log(delta);
    outElem.innerHTML = "Delta: " + delta + "<br/>Entities: " + Object.keys(ECS.entities).length;
    ECS.publishEvent({kind: "tick", delta: delta});
    renderer.render(state.stage);
  }

  function refreshLoop(func, state) {
    let time = null;
    let f = function(total) {
      if (time == null) time = total;
      let delta = total - time;
      time = total;
      func(state, delta / 1000, total);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  // Set up the initial state of the game and spin up the game loop
  function setup() {
    let stage = new PIXI.Container();

    ECS.init();
    ECS.addSystem(["tick"], mouseSystem(renderer.plugins.interaction));
    ECS.addSystem(["tick"], (evt, entities) => {
      for (let ent of Object.values(entities))
        ent.handle(evt);
      for (let i = 0; i < Math.floor(500 * Math.min(0.1, evt.delta)); i++)
        spawnParticle(Math.random() * 800, 0, Math.random() * 100 - 50, Math.random() * 100, Math.random() * 2 + 1, randomColor(), 5);
    });
    // ECS.addSystem(["tick"], drawSystem(stage));
    ECS.addSystem(["tick", "killed"], renderSystem(stage));
    ECS.addSystem(["killed"], (evt, entities) => {
      if (evt.reason == "clicked") {
        // console.log("You got " + evt.id);
      }
      if (evt.reason == "clicked" || evt.reason == "out") {
        spawnRandomCircle();
      }
    });
    
    for (let i = 0; i < 10; i++)
      spawnRandomCircle();

    refreshLoop(gameUpdate, {
      stage: stage,
    });
  }

  function spawnCircle(x, v, a, r, c) {
    return new ECS.Entity([
      staticGraphic(circle(0, 0, Math.floor(r), c)),         // graphic
      positionGraphic,                                       // graphic
      staticPosition(x, -50),                                // position
      staticRadius(Math.floor(r)),                           // radius, size
      staticVelocity(0, v),                                  // velocity
      staticAcceleration(0, a),                              // acceleration
      applyAcceleration(),                                   // tick, velocity
      applyVelocity(),                                       // tick, position
      hitcircle(),                                           // hitbox, hitcircle, touchesPoint
      clickableTarget(0.1),                                  // mousedown, tick, position, graphic
      killIf((ent) => ent.query("position").y>600+r, "out"), // tick
      onDeath((evt, ent) => {                                // killed
        let pos = ent.query("position");
        if (evt.reason == "out") {
          for (let i = 0; i < 10; i++)
            spawnParticle(x, 600, Math.random() * 200 - 100, -Math.random() * 100, Math.random() * 3 + 1, c, Math.random() * 2 + 0.3);
        } else {
          for (let i = 0; i < 10; i++)
            spawnParticle(pos.x, pos.y, Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 3 + 1, c, Math.random() * 2 + 0.3);
        }
      })
    ]);
  }

  function spawnParticle(x, y, vx, vy, r, c, l) {
    return new ECS.Entity([
      staticGraphic(circle(0, 0, Math.floor(r), c)),
      positionGraphic,
      staticPosition(x, y),
      staticRadius(Math.floor(r)),
      staticVelocity(vx, vy),
      staticDrag(l+0.5),
      applyVelocity(),
      killAfter(l)
    ])
  }

  function spawnRandomCircle() {
    let colors = [0xFFDD00, 0x00FF00, 0x0000DD, 0x00DDFF];
    return spawnCircle(Math.random() * 700 + 50,
                       Math.random() * 50 + 20,
                       Math.random() * 10 + 2,
                       Math.floor(Math.random() * 20 + 10),
                       randomColor());
  }

  function randomColor() {
    let colors = [0xFFDD00, 0x00FF00, 0x0000DD, 0x00DDFF];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  //Create the renderer
  let canvas = document.getElementById("gameCanvas");
  let renderer = PIXI.autoDetectRenderer(800, 600, { view: canvas });

  setup();

})();