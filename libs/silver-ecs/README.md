# Silver ECS

### Relations

```ts
const Pot = ecs.tag()
const Plant = ecs.tag()
// Define a component that relates plants to a pot
const InPot = ecs.tagRelation()
// Define a type that represents a plant in a pot
const PottedPlant = ecs.type(Plant, InPot)

const world = ecs.make()
// Spawn a pot
const pot = world.spawn(Pot)
// Spawn a plant into the pot
const plant = world.spawn(PottedPlant, pot)

const logPottedPlants: ecs.System = () => {
  // Define a query that finds all pots
  const pots = ecs.query(Pot)
  // Define a query that finds all plants in a pot
  const pottedPlants = ecs.query(PottedPlant)
  return () => {
    // For every plant in every pot
    pots.each(pot => {
      pottedPlants.each(pot, plant => {
        // Log it!
        console.log(plant, "in pot", pot)
      })
    })
  }
}
```

### Changed

```ts
const syncSceneHierarchy: ecs.System = () => {
  // Define a query that finds all drawable entities whose parent has changed
  const reparented = ecs.query(Drawable, ecs.Changed(ChildOf))
  return world => {
    reparented.each((child, childMesh) => {
      // Get the new parent
      const [[parent]] = world.get(child, ChildOf)
      const parentMesh = world.get(parent, Mesh)
      // Add the child mesh to the parent mesh
      parentMesh.add(childMesh)
    })
  }
}
```

### Monitors

```ts
const debug: ecs.System = () => {
  // Monitor all spawned and despawned entities
  const spawned = ecs.query(ecs.Any, ecs.In(ecs.Any))
  const despawned = ecs.query(ecs.Any, ecs.Out(ecs.Any))
  return () => {
    spawned.each(entity => {
      console.log("spawned", entity)
    })
    despawned.each(entity => {
      console.log("despawned", entity)
    })
  }
}

```