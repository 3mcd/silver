import {Globe} from "lucide-react"
import {memo, useCallback, useMemo} from "react"
import * as ecs from "silver-ecs"
import {Stack} from "../../../styled-system/jsx"
import {PageHeading} from "../../components/page_heading"
import {Table} from "../../components/table"
import {Type} from "../../components/type"
import {useGraph, useNode} from "../../hooks/use_graph"
import {DebugSelected} from "silver-lib"

type Props = {
  onNodeSelected: (node: ecs.Graph.Node) => void
}

let entityRowHover = {
  color: "accent.fg",
  backgroundColor: "accent.default",
  cursor: "pointer",
}

type EntityNodeRowProps = {
  node: ecs.Graph.Node
  onClick(node: ecs.Graph.Node): void
}

let EntityNodeRow = memo((props: EntityNodeRowProps) => {
  let size = ecs.SparseSet.size(props.node.entities)
  let color = useMemo(
    () =>
      ecs.hasComponent(props.node.type, DebugSelected) ? "green" : undefined,
    [props.node.type],
  )
  let onClick = useCallback(() => {
    props.onClick(props.node)
  }, [props.node, props.onClick])
  useNode(props.node)
  return size === 0 ? null : (
    <Table.Row
      onClick={onClick}
      _hover={entityRowHover}
      backgroundColor={color}
    >
      <Table.Cell>
        <Type type={props.node.type} />
      </Table.Cell>
      <Table.Cell textAlign="right">{size}</Table.Cell>
    </Table.Row>
  )
})

export let EntityNodes = (props: Props) => {
  let {nodes} = useGraph()
  return (
    <Stack height="100%">
      <PageHeading title="World" icon={<Globe />} />
      <Table.Root>
        <Table.Header position="sticky" top="0" background="rgba(30,30,30,0.8)">
          <Table.Row>
            <Table.Head>Type</Table.Head>
            <Table.Head textAlign="right">Entity Count</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {nodes.map(node => (
            <EntityNodeRow
              key={node.id}
              node={node}
              onClick={props.onNodeSelected}
            />
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.Cell>Total Entities</Table.Cell>
            <Table.Cell textAlign="right">
              {nodes.reduce(
                (a, node) => a + ecs.SparseSet.size(node.entities),
                0,
              )}
            </Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table.Root>
    </Stack>
  )
}
