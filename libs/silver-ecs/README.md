# silver-ecs

An experimental rewrite of Javelin v2 with a simplified API and improved entity relationships.

## Experiments

### Relationship data

Entity relationships are components so they can also store component values. Relations that hold data are defined using `ecs.valueRelation`.

```ts
type Orbit = {distance: number; period: number}
let Orbits = ecs.valueRelation<Orbit>()

let sun = world.spawn()
let earth = world.spawn(Orbits, [sun, {distance: 1, period: 1}])
```

Relationship data can be retrieved similarly to normal components, using `world.get` and `ecs.query`.

```ts
// Iterate all entities that orbit the sun.
ecs.query(world, Orbits).each(sun, (entity, orbit) => {})
// Get all relationships of type `Orbits` for `sun`.
for (let [entity, orbit] of world.get(sun, Orbits)) {
}
```

### Relation topologies

Javelin v2 provides a special `ChildOf` relation that is used to create trees of entities. This rewrite supplants `ChildOf` with two modes for entity relations: `ecs.Topology.Any` and `ecs.Topology.Hierarchical`. The former has no constraints and can be used to build graphs with cycles, bidirectional relationships, etc. The latter will validate that an entity may have only one parent, and will automatically despawn an entity when its parent is deleted. By default, relations use `ecs.Topology.Any`.

```ts
let Orbits = ecs.relation()
let DockedTo = ecs.relation(ecs.Topology.Hierarchical)

let planet = world.spawn()
let station = world.spawn(Orbits, planet)
let spaceship = world.spawn(DockedTo, station)

world.despawn(planet) // despawns planet
world.despawn(station) // despawns both station and spaceship
```

Hierarchical relationships may only be added to an entity if it has no existing parent for that relation.

```ts
let Orbits = ecs.relation(ecs.Topology.Hierarchical)

let venus = world.spawn()
let earth = world.spawn()
let station = world.spawn(Orbits, venus)

world.add(station, Orbits, earth) // throws because station already has a parent for hierarchical `Orbits` relation
```

### Many-to-many relationships

An entity can have multiple relationships for non-hierarchical relations. This is useful for expressing many-to-many relationships.

```ts
let Team = ecs.relation()

let team1 = world.spawn()
let team2 = world.spawn()
let spy = world.spawn(ecs.type(Team, Team), team1, team2) // spy is on both teams
```

### Monitor queries

Monitors are distinct from queries in Javelin v2. This ECS unifies the concepts with `In` and `Out` query filters which configures a query to yield only entities who started or stopped (respectively) matching a provided type during the previous tick. This offers several benefits:

- Because monitors are just queries, you can also read/write component values in the iterator callback
- The query can be further filtered using other filter types like `ecs.Not` and `ecs.Changed`

```ts
let despawnedNonInfantryUnits = ecs.query(
  world,
  Position,
  ecs.Out(Unit),
  ecs.Not(Infantry),
)
despawnedNonInfantryUnits.each((unit, position) => {
  // Render an explosion at the despawned unit's prior position.
  drawExplosion(position)
})
```

### Query multiplicity

Entity relationships are expressed as components in both Javelin v2 and this rewrite. When an entity is related to another entity, it gets a unique component whose id is computed by concatenating the relation id and the related entity id.

In Javelin v2, querying entities by relationship looks like:

```ts
world.query(Orbits(sun))
```

The relationship must be recomputed each time the query is executed. An separate query object is created behind the scenes for each permutation of `Orbits(entity)`. In other words, the number of query objects scales 1:1 with the number of unique relationships your systems iterate. Queries have a complex implementation and allocate a non-trivial amount of objects, so compiling queries per-relationship has an observable impact on memory usage and performance in games with many entities and relationships.

The rewrite addresses this issue by only allocating a single object for queries that query by relationship. Queries instead maintain an internal map of object->subject for applicable relationships. Instead of computing a type for a specific relationship (e.g. `Orbits(sun)`), objects of query relationships are passed as arguments to the query's `each` method, which uses the aformentioned map to yield subjects of the relationship.

```ts
ecs.query(world, Orbits).each(sun, (planet, orbit) => {
  // Rotate `planet` around `sun` using relationship data.
})
```

In the above example, `sun` is the object of the `Orbits` relationship, while `planet` is the subject.

`each` accepts one object entity per-relation included in the query, e.g.

```ts
let HasMother = ecs.relation()
let HasFather = ecs.relation()
let ChildOf = ecs.type(HasMother, HasFather)

let mom = world.spawn()
let dad = world.spawn()
world.spawn(ChildOf, mom, dad)

ecs.query(world, ChildOf, ecs.In()).each(mother, father, child => {
  // `child` was born!
})
```

### Monomorphism

A small detail, but many objects have been rewritten to be monomorphic, that is conforming to a single shape. In Javelin v2, components and types both can have unique structures depending on their intended function (each with their own hidden class). This incurs a slight performance penalty because certain JS engines optimize function calls for each hidden class.
