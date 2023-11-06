import * as ecs from "silver-ecs/dev"
import {Edge, Network, Node} from "vis-network"
import {DataSet} from "vis-data"

const getColor = (value: number) => `hsl(0,0%,${40 + value * 60}%)`
const network = document.getElementById("network")!
const nodes = new DataSet<Node>([])
const edges = new DataSet<Edge>([])
const edgeIds = new Set<string>()
const makeTypeId = (type: ecs.Type) => type.component_ids.toString()
const makeEdge = (a: ecs.Type, b: ecs.Type) => {
  const from = makeTypeId(a)
  const to = makeTypeId(b)
  const id =
    a.components.length > b.components.length
      ? `${to}-${from}`
      : `${from}-${to}`
  if (edgeIds.has(id)) return
  const color = getColor(a.components.length / 40)
  edgeIds.add(id)
  edges.add({id, from, to, color})
}

let nodesInserted = 0

const onNodeInserted = (node: ecs.Graph.Node) => {
  const id = makeTypeId(node.type)
  const level = node.type.components.length
  const color = getColor(level / 10)
  nodes.add({
    id,
    label: node.type.component_ids.map(id => alpha[id - 3]).join(","),
    level,
    color,
  })
  node.edges_right.forEach(nextNode => makeEdge(node.type, nextNode.type))
  node.edges_left.forEach(prevNode => makeEdge(node.type, prevNode.type))
  nodesInserted++
}

const alpha = "abcdefghijklmnopqrstuvwxyz0123456789".split("")
const world = ecs.make()
const componentsA = Array.from({length: alpha.length / 3}).map(ecs.tag)
const componentsB = Array.from({length: alpha.length / 3}).map(ecs.tag)
const componentsC = Array.from({length: alpha.length / 3}).map(ecs.tag)
const componentsD = componentsA
  .slice(0, componentsA.length / 2 - 1)
  .concat(componentsB.slice(0, componentsA.length / 2 - 1))
const components = [componentsA, componentsB, componentsC, componentsD]
const spawnRandom = () => {
  const tags = components[Math.floor(Math.random() * components.length)].sort(
    () => Math.random() - 0.5,
  )
  const type = ecs.type(
    ...tags.slice(
      Math.floor(Math.random() * tags.length),
      Math.floor(Math.random() * tags.length),
    ),
  )
  // @ts-ignore
  world.spawn(type)
  const now = performance.now()
  world.step()
  const elapsed = performance.now() - now
  console.log(`spawn took ${elapsed}ms (${nodesInserted} nodes inserted)`)
  nodesInserted = 0
}

let graph: Network | undefined
let graphSubscriber: (() => void) | undefined

const toggleGraph = () => {
  if (graph) {
    graph.destroy()
    graphSubscriber?.()
    graph = undefined
    graphSubscriber = ecs.Signal.subscribe(
      world.graph.root.$created,
      () => nodesInserted++,
    )
    edges.clear()
    nodes.clear()
    edgeIds.clear()
  } else {
    graph = new Network(
      network,
      {
        nodes,
        edges,
      },
      {
        nodes: {
          physics: true,
        },
        layout: {
          hierarchical: {
            levelSeparation: 200,
            nodeSpacing: 300,
            treeSpacing: 200,
            blockShifting: true,
            edgeMinimization: true,
            parentCentralization: true,
            direction: "LR",
            sortMethod: "directed",
          },
        },
      },
    )
    graphSubscriber = ecs.Signal.subscribe(
      world.graph.root.$created,
      onNodeInserted,
    )
    ecs.Graph.traverse(world.graph.root, onNodeInserted)
  }
}

const toggle = document.getElementById("toggle")!
const spawn = document.getElementById("spawn")!

spawn.addEventListener("click", spawnRandom)
toggle.addEventListener("click", toggleGraph)

toggleGraph()
