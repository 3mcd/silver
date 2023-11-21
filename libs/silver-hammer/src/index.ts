import React from "react"
import {createRoot} from "react-dom/client"
import {Type, World} from "silver-ecs"
import App from "./app"
import {Aliases, makeDebugAliases} from "./context/alias_context"

export {makeDebugAliases}

export let mount = (world: World, element: HTMLElement, aliases: Aliases) => {
  createRoot(element).render(React.createElement(App, {world}))
}

// import {Graph, Signal, Type, World} from "silver-ecs"
// import {Edge, Network, Node} from "vis-network"
// import {DataSet} from "vis-data"

// let make_color = (value: number) => `hsl(0,0%,${40 + value * 60}%)`
// let nodes = new DataSet<Node>([])
// let edges = new DataSet<Edge>([])
// let edge_ids = new Set<string>()
// let make_edge = (a: Type, b: Type) => {
//   let from = a.hash
//   let to = b.hash
//   let id =
//     a.components.length > b.components.length
//       ? `${to}-${from}`
//       : `${from}-${to}`
//   if (edge_ids.has(id)) return
//   let color = make_color(a.components.length / 40)
//   edge_ids.add(id)
//   edges.add({id, from, to, color})
// }

// let nodesInserted = 0

// export let mount = (world: World, root: HTMLElement, aliases?: Aliases) => {
//   let insert_node = (node: Graph.Node) => {
//     let level = node.type.components.length
//     let color = make_color(level / 10)
//     nodes.add({
//       id: node.type.hash,
//       label: node.type.component_ids
//         .map(id => aliases?.aliases[id] ?? id)
//         .join(","),
//       level,
//       color,
//     })
//     node.edges_right.forEach(nextNode => make_edge(node.type, nextNode.type))
//     node.edges_left.forEach(prevNode => make_edge(node.type, prevNode.type))
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
//   let graph_subscriber = Signal.subscribe(
//     world.graph.root.$created,
//     insert_node,
//   )
//   Graph.traverse(world.graph.root, insert_node)
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
