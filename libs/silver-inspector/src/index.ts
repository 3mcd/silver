import React from "react"
import {createRoot} from "react-dom/client"
import {Query, Type, World} from "silver-ecs"
import App from "./app"
import {Aliases, makeDebugAliases} from "./context/alias_context"

export {makeDebugAliases}

export let mount = (
  world: World,
  element: HTMLElement,
  aliases?: Aliases,
  queries?: {[name: string]: Query},
) => {
  createRoot(element).render(
    React.createElement(App, {world, aliases, queries}),
  )
}

// import {Graph, Signal, Type, World} from "silver-ecs"
// import {Edge, Network, Node} from "vis-network"
// import {DataSet} from "vis-data"

// let makeColor = (value: number) => `hsl(0,0%,${40 + value * 60}%)`
// let nodes = new DataSet<Node>([])
// let edges = new DataSet<Edge>([])
// let edgeIds = new Set<string>()
// let makeEdge = (a: Type, b: Type) => {
//   let from = a.hash
//   let to = b.hash
//   let id =
//     a.components.length > b.components.length
//       ? `${to}-${from}`
//       : `${from}-${to}`
//   if (edgeIds.has(id)) return
//   let color = makeColor(a.components.length / 40)
//   edgeIds.add(id)
//   edges.add({id, from, to, color})
// }

// let nodesInserted = 0

// export let mount = (world: World, root: HTMLElement, aliases?: Aliases) => {
//   let insertNode = (node: Graph.Node) => {
//     let level = node.type.components.length
//     let color = makeColor(level / 10)
//     nodes.add({
//       id: node.type.hash,
//       label: node.type.componentIds
//         .map(id => aliases?.aliases[id] ?? id)
//         .join(","),
//       level,
//       color,
//     })
//     node.edgesRight.forEach(nextNode => makeEdge(node.type, nextNode.type))
//     node.edgesLeft.forEach(prevNode => makeEdge(node.type, prevNode.type))
//     nodesInserted++
//   }
//   let graph = new Network(
//     root,
//     {
//       nodes,
//       edges,
//     },
//     {
//       nodes: {
//         physics: true,
//       },
//       layout: {
//         hierarchical: {
//           levelSeparation: 200,
//           nodeSpacing: 300,
//           treeSpacing: 200,
//           blockShifting: true,
//           edgeMinimization: true,
//           parentCentralization: true,
//           direction: "LR",
//           sortMethod: "directed",
//         },
//       },
//     },
//   )
//   let graphSubscriber = Signal.subscribe(
//     world.graph.root.$created,
//     insertNode,
//   )
//   Graph.traverse(world.graph.root, insertNode)
//   document.addEventListener("keyup", e => {
//     if (e.key === "`") {
//       e.preventDefault()
//       root.style.display = root.style.display === "none" ? "" : "none"
//     }
//   })
//   graph.on("click", function (properties) {
//     var ids = properties.nodes
//     var clickedNodes = nodes.get(ids)
//     console.log("clicked nodes:", clickedNodes)
//   })
// }
