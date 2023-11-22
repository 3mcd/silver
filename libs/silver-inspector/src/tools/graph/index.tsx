import {Waypoints} from "lucide-react"
import {useEffect, useMemo, useRef, useState} from "react"
import ForceGraph3D, {GraphData} from "react-force-graph-3d"
import * as ecs from "silver-ecs"
import {Stack} from "../../../styled-system/jsx"
import {PageHeading} from "../../components/page_heading"
import {useWorld} from "../../hooks/use_world"

export let Graph = () => {
  let world = useWorld()
  let root = useRef<HTMLDivElement>(null)
  let data = useMemo(() => {
    let data: GraphData = {
      nodes: [],
      links: [],
    }
    ecs.Graph.traverse(world.graph.root, node => {
      data.nodes.push({
        id: node.id,
        name: node.type.componentIds.join(","),
      })
      node.edgesRight.forEach(nextNode => {
        data.links.push({
          source: node.id,
          target: nextNode.id,
        })
      })
      node.edgesLeft.forEach(prevNode => {
        data.links.push({
          source: prevNode.id,
          target: node.id,
        })
      })
    })
    return data
  }, [])

  let [rect, setRect] = useState<DOMRect>()

  useEffect(() => {
    if (!root.current) return
    let observer = new ResizeObserver(entries => {
      setRect(entries[0].contentRect)
    })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  return (
    <Stack height="100%" ref={root}>
      <PageHeading title="Graph" icon={<Waypoints />} />
      <ForceGraph3D
        graphData={data}
        width={rect?.width}
        height={rect?.height}
        backgroundColor="rgba(0,0,0,0)"
      />
    </Stack>
  )
}
