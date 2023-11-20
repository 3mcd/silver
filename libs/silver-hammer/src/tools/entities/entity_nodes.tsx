import {Graph, SparseSet} from "silver-ecs"
import {Table} from "../../components/table"
import {Type} from "../../components/type"
import {useGraph} from "../../hooks/use_graph"
import {useCallback} from "react"

type Props = {
  onNodeSelected: (node: Graph.Node) => void
}

let EntityNodeRow = (props: {node: Graph.Node; onClick(): void}) => {
  let size = SparseSet.size(props.node.entities)
  if (size === 0) {
    return null
  }
  return (
    <Table.Row
      onClick={props.onClick}
      _hover={{
        color: "accent.fg",
        backgroundColor: "accent.default",
        cursor: "pointer",
      }}
    >
      <Table.Cell>
        <Type type={props.node.type} />
      </Table.Cell>
      <Table.Cell textAlign="right">
        {SparseSet.size(props.node.entities)}
      </Table.Cell>
    </Table.Row>
  )
}

export let EntityNodes = (props: Props) => {
  let {nodes} = useGraph()
  return (
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
            onClick={() => props.onNodeSelected(node)}
          />
        ))}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell>Total Entities</Table.Cell>
          <Table.Cell textAlign="right">
            {nodes.reduce((a, node) => a + SparseSet.size(node.entities), 0)}
          </Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  )
}
