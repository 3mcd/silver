# silver-inspector

An inspector for silver-ecs worlds.

<img src="./screenshot.png" style="width: 100%">

### Usage

```ts
import * as ecs from "silver-ecs"
import {mount, makeDebugAliases} from "silver-inspector"

const world = ecs.makeWorld()
const element = document.getElementById("inspector")
// Name your components.
const aliases = makeDebugAliases().set(Vehicle, "Vehicle")
// Add queries to the inspector.
const queries = {
  vehicles: ecs.query(world, Vehicle),
}
// Add the inspector to the DOM.
mount(world, element, aliases, queries)
```
