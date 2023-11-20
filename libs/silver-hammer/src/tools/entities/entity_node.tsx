import {Entity, Graph, SparseSet, is_relation, is_tag} from "silver-ecs"
import {Button} from "../../components/button"
import {Table} from "../../components/table"
import {Text} from "../../components/text"
import {Value} from "../../components/value"
import {useAliases} from "../../hooks/use_aliases"

type Props = {
  node: Graph.Node
  onEntitySelected: (entity: Entity, node: Graph.Node) => void
  onBack(): void
}

export let EntityRow = (props: {
  entity: Entity
  node: Graph.Node
  onClick(): void
}) => {
  return (
    <Table.Row
      onClick={props.onClick}
      _hover={{
        color: "accent.fg",
        backgroundColor: "accent.default",
        cursor: "pointer",
      }}
    >
      <Table.Cell>{props.entity}</Table.Cell>
      {props.node.type.components.map(component =>
        is_relation(component) ? null : (
          <Table.Cell key={component.id}>
            {"schema" in component && component.schema ? (
              <Value entity={props.entity} component={component} />
            ) : (
              <Text as="span">{is_tag(component) ? "✅" : "unknown"}</Text>
            )}
          </Table.Cell>
        ),
      )}
    </Table.Row>
  )
}

export let EntityNode = (props: Props) => {
  let aliases = useAliases()
  let entities = SparseSet.values(props.node.entities)
  return (
    <>
      <Button onClick={props.onBack}>Back</Button>
      <Table.Root>
        <Table.Header position="sticky" top="0" background="bg.default">
          <Table.Row>
            <Table.Head>ID</Table.Head>
            {props.node.type.components.map(component =>
              is_relation(component) ? null : (
                <Table.Head key={component.id}>
                  {aliases.getComponent(component)}
                </Table.Head>
              ),
            )}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {entities.map(entity => (
            <EntityRow
              key={entity}
              entity={entity}
              node={props.node}
              onClick={() => props.onEntitySelected(entity, props.node)}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </>
  )
}
