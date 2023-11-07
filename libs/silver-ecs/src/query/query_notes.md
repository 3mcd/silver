## How do queries handle relationships?

A query may specify more than one relation.

```ts
query = query(world, type(OnTeam /* 1 */, InVehicle /* 2 */))
```

This query listens for nodes that match `(OnTeam, InVehicle)`. Nodes with these components are guaranteed to have at least one relationship for both `OnTeam` and `InVehicle`. The node might look something like:

```ts
node = {
  type: [1 /* OnTeam */, 2 /* InVehicle */, 198, 255],
}
```

Where `1` and `2` correspond to the `OnTeam` and `InVehicle` components, respectively, and `198` and `255` are relationships. Each relationship component id is constructed from the related entity id and the relevant relation id. In the above example, `255` can be thought of as the concatenation of `InVehicle` + `55`, the vehicle's entity id. Entities in this node are both on the same team and riding in the same vehicle.

When executing this query's `each` method, one must provide a related team and vehicle:

```ts
query.each(t /* 98 */, v /* 55 */, e => {
  // `e` is on team `t` and in vehicle `v`
})
```

When a query learns of a new node that stores entities on a team and in a vehicle (i.e. matches `(OnTeam, InVehicle)`), it marshals the node's entities into a multi-dimensional map that looks something like this:

```ts
relationship_map = {
  [hash(98, 55)]: [e1], // live list of entities on team 98 and in vehicle 55
}
```

When executed, the query uses the provided `t` and `v` arguments to look up the matching entities in the aforementioned map.

```ts
query.each(t, v, e => {})
// translates roughly to:
relationship_map[t][v].forEach(e => {
  // `e` is on team `t` and in vehicle `v`
})
```

One complication arises when the node stores entities (like spies) that belong to multiple teams. In this case, the node might look something like:

```ts
node = {
  type: [1, 2, 198, 199, 255],
}
```

This type contains an additional relationship to team `99`. Entities in this table are on both teams `198` and `199`, and in the same vehicle.

Because the query only accepts a single team argument, it stores the entities the same way as before:

```ts
relationship_map = {
  [hash(98, 55)]: [e1],
  [hash(99, 55)]: [e1],
}
```

But what about a query that accepts two team arguments?

```ts
q = query(world, type(OnTeam, OnTeam, InVehicle))
```

In this case, the query stores the entities in a slightly different way:

```ts
relationship_map = {
  [hash(98, 99, 55)]: [e1],
  [hash(99, 98, 55)]: [e1],
}
```

Because the query requires multiple team arguments, the two teams could be provided in various orders. So we store the entities in both orders to ensure that we can look them up regardless of the order in which they are provided.

```ts
q.each(t1, t2, v, e => {})
// produces the same results as:
q.each(t2, t1, v, e => {})
```

## How do queries handle wildcards (`"*"`)?

For wildcard queries, we'd need to find all permutations of the wildcard entity relations and their component values.

```ts
q = query(type(Orbits, Geometry))
q.each("*", (entity, [orbits, orbit], geometry) => {})
```

If we have two planets, both orbiting a star, the query would yield the following results:

```ts
results = [
  [planet_1, [star_1, planet_1_orbit], planet_1_geometry],
  [planet_2, [star_1, planet_2_orbit], planet_2_geometry],
]
```

But what if we have a planet that orbits the star, and a moon that orbits the planet?

```ts
results = [
  [planet_1, [star_1, planet_1_orbit], planet_1_geometry],
  [planet_2, [star_1, planet_2_orbit], planet_2_geometry],
  [moon_1, [planet_1, moon_1_orbit], moon_1_geometry],
]
```

### Many relations

Queries can include many relations, and therefore many wildcards.

Imagine the query also wants to match on the body's solar system:

```ts
q = query(type(InSystem, Orbits, Geometry))
q.each(
  "*", // InSystem
  "*", // Orbits
  (entity, system, [orbits, orbit], geometry) => {},
)
```

We'd need to compute all permutations of these two relations to give the proper results:

```ts
results = [
  [planet_1, system_1, [star_1, planet_1_orbit], planet_1_geometry],
  [planet_2, system_2, [star_2, planet_2_orbit], planet_2_geometry],
  [moon_1, system_1, [planet_1, moon_1_orbit], moon_1_geometry],
]
```

### Many same relations (e.g. `Topology.Any`)

Finally, what if a body can be influenced by gravity of many objects, thereby "orbiting" both? The results of the above query for a binary star system would look like:

```ts
results = [
  [planet_1, system_1, [star_1, planet_1_star_1_orbit], planet_1_geometry],
  [planet_1, system_1, [star_2, planet_1_star_2_orbit], planet_1_geometry],
]
```
