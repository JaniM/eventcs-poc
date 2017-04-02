# Component event system

Components are autonomous workers that do nothing but handle events. They can keep state, but can't mutate external state nor touch any memory an entity might hold.

Entities contain components and have a function to handle events. These events get chained through all components with handlers for that kind of event to produce an answer.

In this model components represent behavior and are very composable.

### Example: Draggable

Say a system queries position from an entity. This'd mean passing an event like `{kind: "position"}` to the entity. This'd then get chained through `staticPosition` and `draggable` to produce the actual position.

In this example `draggable` has internal state for the _relative_ position it gives to the entity. It listens to mouse events using the same channel to update this internal state. When the position is queried, every component gets to apply its own view of the position.

### Example: Circles

A full-blown example featuring a fair bit of interaction between components. Check it out.

### Expectations and surprises

I expected this system to be extremely slow and unsuitable for anything. There's a lot of object allocations and every single _value_ query requires many jumps.
Turns out, it is surprisingly fast to do this even with Javascript. I think it'd be possible to implement this in a very efficient manner with a lower-level language like Rust.
However, it obviously won't be fast enough for anything serious, but it is a very nice way to write smaller projects.
