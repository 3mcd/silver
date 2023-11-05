import * as ecs from "silver-ecs/dev"

const Edge = ecs.relation()
const Node = ecs.tag()
const ConnectedNode = ecs.type(Node, Edge)

const world = ecs.make()
const root = world.spawn(Node)
const nodes: ecs.Entity[] = [root]

let n0 = 0
let i = 0
const t = performance.now()
while (i++ < 1_000) {
  const connect: ecs.Entity[] = []
  const count = Math.floor(Math.random() * Math.min(nodes.length, 5)) + 1
  for (let i = 0; i < count; i++) {
    connect.push(nodes[nodes.length - i - 1])
    n0++
  }
  const node = world.spawn(ConnectedNode, connect)
  nodes.push(node)
}

world.step()

console.log(
  `created ${nodes.length} nodes with ${n0} edges in`,
  performance.now() - t,
  "ms",
)

const system: ecs.System = world => {
  const nodes = ecs.query(world, Node)
  const edges = ecs.query(world, Edge)
  let n = 0
  return () => {
    const t = performance.now()
    nodes.each(node => {
      edges.each(node, () => {
        n++
      })
    })
    console.log(`computed ${n} edges in`, performance.now() - t, "ms")
  }
}

ecs.run(world, system)
