import {Waypoints} from "lucide-react"
import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import ForceGraph3D, {
  ForceGraphMethods,
  GraphData,
  LinkObject,
  NodeObject,
} from "react-force-graph-3d"
import * as ecs from "silver-ecs"
import SpriteText from "three-spritetext"
import {Stack} from "../../../styled-system/jsx"
import {PageHeading} from "../../components/page_heading"
import {useAliases} from "../../hooks/use_aliases"
import {useGraph} from "../../hooks/use_graph"

let makeNodeColor = ({size}: NodeObject<{size: number}>) => {
  if (size === 0) {
    return "#5a4c47"
  }
  if (size === 1) {
    return "#6f5f58"
  }
  if (size < 4) {
    return "#a18072"
  }
  if (size < 8) {
    return "#ae8c7e"
  }
  if (size < 16) {
    return "#d4b3a5"
  }
  return "#ede0d9"
}

type NodeData = {size: number; node: ecs.Graph.Node}
type Node = NodeObject<NodeData>
type Link = LinkObject<NodeData>

let spriteCache = ecs.SparseMap.make<SpriteText>()

type Props = {
  onNodeSelected(node: ecs.Graph.Node): void
}

const GROUPS = 12

export let GraphVis = (props: Props) => {
  let {nodes} = useGraph()
  let aliases = useAliases()
  let root = useRef<HTMLDivElement>(null)
  let [rect, setRect] = useState<DOMRect>()
  let graph = useRef<ForceGraphMethods<Node>>()
  let nodeCache = useRef<Node[]>([])
  let linkCache = useRef<{[id: string]: Link}>({})
  let data = useMemo(() => {
    let data: GraphData<NodeData> = {nodes: [], links: []}
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i]
      let nodeObject = (nodeCache.current[node.id] ??= {
        id: node.id,
        node,
        name: node.type.componentIds.join(","),
        size: node.type.components.length,
      })
      data.nodes.push(nodeObject)
      node.edgesRight.forEach(nextNode => {
        let linkObject = (linkCache.current[`${node.id}:${nextNode.id}`] ??= {
          source: node.id,
          target: nextNode.id,
        })
        data.links.push(linkObject)
      })
    }
    return data
  }, [nodes])
  let onNodeClick = useCallback(
    (node: Node, event: MouseEvent) => {
      if (event.ctrlKey) {
        props.onNodeSelected(node.node)
        return
      }
      let distance = 200
      let x = node.x!
      let y = node.y!
      let z = node.z!
      let ratio = 1 + distance / Math.hypot(x, y, z)
      graph.current?.cameraPosition(
        {x: x * ratio, y: y * ratio, z: z * ratio},
        {x, y, z},
        800,
      )
    },
    [graph, props.onNodeSelected],
  )

  useEffect(() => {
    if (!root.current) {
      return
    }
    let observer = new ResizeObserver(entries => {
      let controls = graph.current?.controls()
      if (controls) {
        ;(controls as any).handleResize()
      }
      setRect(entries[0].contentRect)
    })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let renderer = graph.current!.renderer()
    return () => {
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }, [])

  return (
    <Stack height="100%" ref={root}>
      <PageHeading title="Graph" icon={<Waypoints />} />
      <ForceGraph3D
        ref={graph}
        graphData={data}
        width={rect?.width}
        height={rect?.height}
        backgroundColor="rgba(0,0,0,0)"
        // @ts-expect-error
        nodeAutoColorBy={d => d.node.type.components.length % GROUPS}
        // @ts-expect-error
        linkAutoColorBy={d =>
          nodeCache.current[d.source as number].node.type.components.length %
          GROUPS
        }
        nodeThreeObject={node => {
          let sprite = ecs.SparseMap.get(spriteCache, node.id as number)
          if (!sprite) {
            let text = node.node.type.components
              .slice(0, 6)
              .map(component =>
                aliases.getComponentAlias(component).slice(0, 3),
              )
              .join(",")
            if (node.node.type.components.length > 6) {
              text += `+${node.node.type.components.length - 6}`
            }
            sprite = new SpriteText(text || "root", 2, "white")
            sprite.fontFace = "monospace"
            sprite.backgroundColor = node.color
            sprite.borderRadius = 2
            sprite.padding = 1
            ecs.SparseMap.set(spriteCache, node.id as number, sprite)
          }
          return sprite
        }}
        onNodeClick={onNodeClick}
      />
    </Stack>
  )
}
