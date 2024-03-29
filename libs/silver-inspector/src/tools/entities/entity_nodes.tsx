import {Globe} from "lucide-react"
import {memo, useCallback, useMemo} from "react"
import * as S from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {Page} from "../../components/page"
import {Table} from "../../components/table"
import {Type} from "../../components/type"
import {useGraph, useNode} from "../../hooks/use_graph"

type Props = {
  onNodeSelected: (node: S.Graph.Node) => void
}

let entityRowHover = {
  color: "accent.fg",
  backgroundColor: "accent.8",
  cursor: "pointer",
}

type EntityNodeRowProps = {
  node: S.Graph.Node
  onClick(node: S.Graph.Node): void
}

let EntityNodeRow = memo((props: EntityNodeRowProps) => {
  let size = S.SparseSet.size(props.node.entities)
  let color = useMemo(
    () =>
      S.hasComponent(props.node.type, DebugSelected) ? "sky.7" : undefined,
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
    <Page title="World" icon={<Globe />}>
      <Table.Root>
        <Table.Header position="sticky" top="0" background="bg.default">
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
                (a, node) => a + S.SparseSet.size(node.entities),
                0,
              )}
            </Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table.Root>
    </Page>
  )
}
