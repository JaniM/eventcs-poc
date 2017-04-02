
(function() {
  "use strict";

  let rect = (x, y, w, h, c) => {
    let g = new PIXI.Graphics();
    g.beginFill(c);
    g.drawRect(x, y, w, h);
    g.endFill();
    return g;
  };

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

  let draggable = () => {
    let drag = null;
    let x = 0;
    let y = 0;
    return ({
      "mousedown": (evt, ent) => {
        drag = {x: x, y: y, ox: evt.x, oy: evt.y};
        return evt;
      },
      "mousemove": (evt, ent) => {
        if (drag) {
          x = evt.x - drag.ox + drag.x;
          y = evt.y - drag.oy + drag.y;
        }
        return evt;
      },
      "mouseup": (evt, ent) => {
        drag = null;
        return evt;
      },
      "position": (evt, ent) => {
        return {kind: "position", x: evt.x ? evt.x + x : x, y: evt.y ? evt.y + y : y};
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
    ECS.addSystem(["tick", "killed"], renderSystem(stage));

    for (let i = 0; i < 10; i++)
      spawnRectangle(Math.random() * 700, Math.random() * 500, Math.random() * 50 + 50, Math.random() * 50 + 50, 0x00AAFF);

    refreshLoop(gameUpdate, {
      stage: stage,
    });
  }

  function spawnRectangle(x, y, w, h, c) {
    return new ECS.Entity([
      staticGraphic(rect(0, 0, w, h, c)), // Gives a graphic when requested
      positionGraphic,                    // Positions it correctly
      staticPosition(x, y),               // Gives a static position when requested
      staticSize(w, h),                   // Gives a static size when requested
      hitbox(),                           // Combines them to a hitbox.
      draggable()                         // Handles dragging logic and translates the position when requested.
    ])
  }

  //Create the renderer
  let canvas = document.getElementById("gameCanvas");
  let renderer = PIXI.autoDetectRenderer(800, 600, { view: canvas });

  setup();

})();