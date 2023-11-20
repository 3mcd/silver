import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react"
import {useCallback, useState} from "react"
import {
  Entity,
  Graph,
  SparseSet,
  is_relation,
  is_relationship,
  is_tag,
  is_tag_relationship,
} from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {Stack, styled} from "../../../styled-system/jsx"
import {Button} from "../../components/button"
import {IconButton} from "../../components/icon_button"
import {Pagination} from "../../components/pagination"
import {Table} from "../../components/table"
import {Text} from "../../components/text"
import {Value} from "../../components/value"
import {useAliases} from "../../hooks/use_aliases"
import {useNode} from "../../hooks/use_graph"
import {useWorld} from "../../hooks/use_world"

type Props = {
  node: Graph.Node
  onEntitySelected: (entity: Entity, node: Graph.Node, select: boolean) => void
  onBack(): void
}

export let EntityRow = (props: {
  entity: Entity
  node: Graph.Node
  onClick(event: React.MouseEvent): void
  selected: boolean
}) => {
  return (
    <Table.Row
      onClick={props.onClick}
      backgroundColor={props.selected ? "accent.default" : undefined}
      _hover={{
        color: "accent.fg",
        backgroundColor: "accent.default",
        cursor: "pointer",
      }}
    >
      <Table.Cell>{props.entity}</Table.Cell>
      {props.node.type.components
        .filter(
          component => !is_tag(component) && !is_tag_relationship(component),
        )
        .map(component =>
          is_relation(component) ? null : (
            <Table.Cell key={component.id}>
              <Value entity={props.entity} component={component} />
            </Table.Cell>
          ),
        )}
    </Table.Row>
  )
}

export let EntityNode = (props: Props) => {
  let world = useWorld()
  let aliases = useAliases()
  let entities = SparseSet.values(props.node.entities)
  let entities_count = SparseSet.size(props.node.entities)
  let [page, setPage] = useState({page: 1, pageSize: 15})
  let on_page_change = useCallback(
    (details: {page: number; pageSize: number}) => {
      setPage(details)
    },
    [],
  )
  let offset = (page.page - 1) * page.pageSize
  let tags = props.node.type.components.filter(is_tag)
  let relationships = props.node.type.components.filter(is_relationship)
  useNode(props.node)
  return (
    <Stack height="100%">
      <styled.div>
        <Button onClick={props.onBack}>Back</Button>
      </styled.div>
      <styled.div>
        <styled.dl>
          {tags.length > 0 && (
            <>
              <styled.dt fontWeight="medium">Tags</styled.dt>
              <styled.dd marginLeft="3">
                <Text>
                  {tags
                    .map(component => aliases.getComponent(component))
                    .join(", ")}
                </Text>
              </styled.dd>
            </>
          )}
          {relationships.length > 0 && (
            <>
              <styled.dt fontWeight="medium">Relationships</styled.dt>
              <styled.dd marginLeft="3">
                <Text>
                  {relationships.map(aliases.getComponent).join(", ")}
                </Text>
              </styled.dd>
            </>
          )}
        </styled.dl>
      </styled.div>
      <styled.div overflow="auto">
        <Table.Root>
          <Table.Header position="sticky" top="0" background="bg.default">
            <Table.Row>
              <Table.Head>ID</Table.Head>
              {props.node.type.components
                .filter(
                  component =>
                    !is_tag(component) && !is_tag_relationship(component),
                )
                .map(component =>
                  is_relation(component) ? null : (
                    <Table.Head key={component.id}>
                      {aliases.getComponent(component)}
                    </Table.Head>
                  ),
                )}
            </Table.Row>
          </Table.Header>
          <Table.Body overflow="auto">
            {entities
              .sort((a, b) => {
                let a_selected = world.has(a, DebugSelected)
                let b_selected = world.has(b, DebugSelected)
                if (a_selected && !b_selected) {
                  return -1
                }
                if (!a_selected && b_selected) {
                  return 1
                }
                return 0
              })
              .slice(offset, offset + page.pageSize)
              .map(entity => (
                <EntityRow
                  key={entity}
                  entity={entity}
                  node={props.node}
                  onClick={e => {
                    props.onEntitySelected(entity, props.node, e.ctrlKey)
                  }}
                  selected={world.has(entity, DebugSelected)}
                />
              ))}
          </Table.Body>
        </Table.Root>
      </styled.div>
      {entities_count > page.pageSize && (
        <Pagination.Root
          count={entities_count}
          pageSize={page.pageSize}
          onPageChange={on_page_change}
          paddingBottom="3"
        >
          {({pages}) => (
            <>
              <Pagination.PrevTrigger asChild>
                <IconButton variant="ghost" aria-label="Next Page">
                  <ChevronLeftIcon />
                </IconButton>
              </Pagination.PrevTrigger>
              {pages.map((page, index) =>
                page.type === "page" ? (
                  <Pagination.Item key={index} {...page} asChild>
                    <Button variant="outline">{page.value}</Button>
                  </Pagination.Item>
                ) : (
                  <Pagination.Ellipsis key={index} index={index}>
                    &#8230;
                  </Pagination.Ellipsis>
                ),
              )}
              <Pagination.NextTrigger asChild>
                <IconButton variant="ghost" aria-label="Next Page">
                  <ChevronRightIcon />
                </IconButton>
              </Pagination.NextTrigger>
            </>
          )}
        </Pagination.Root>
      )}
    </Stack>
  )
}
