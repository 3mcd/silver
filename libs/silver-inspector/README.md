# silver-inspector

An inspector for silver-ecs worlds.

<img src="./screenshot.png" style="width: 100%">

### Usage

```ts
import * as S from "silver-ecs"
import {mount, makeDebugAliases} from "silver-inspector"

const world = S.makeWorld()
const element = document.getElementById("inspector")
// Name your components.
const aliases = makeDebugAliases().set(Vehicle, "Vehicle")
// Add queries to the inspector.
const queries = {
  vehicles: S.query(world, Vehicle),
}
// Add the inspector to the DOM.
mount(world, element, aliases, queries)
```
