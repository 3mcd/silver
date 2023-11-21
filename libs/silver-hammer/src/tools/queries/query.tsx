import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react"
import {useCallback, useLayoutEffect, useMemo, useState} from "react"
import * as ecs from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {Stack, styled} from "../../../styled-system/jsx"
import {Button} from "../../components/button"
import {IconButton} from "../../components/icon_button"
import {Pagination} from "../../components/pagination"
import {Table} from "../../components/table"
import {Text} from "../../components/text"
import {useAliases} from "../../hooks/use_aliases"
import {useWorld} from "../../hooks/use_world"
import {EntityRow} from "../entities/entity_node"

type Props = {
  query: ecs.Query
  onBack(): void
  onEntitySelected(
    entity: ecs.Entity,
    node: ecs.Graph.Node,
    ctrlKey: boolean,
  ): void
}

export let Query = (props: Props) => {
  let world = useWorld()
  let aliases = useAliases()
  let [page, setPage] = useState({page: 1, pageSize: 15})
  let on_page_change = useCallback(
    (details: {page: number; pageSize: number}) => {
      setPage(details)
    },
    [],
  )
  let [results, setResults] = useState<[ecs.Entity, values: unknown[]][]>([])
  let system = useMemo<ecs.System>(() => {
    return () => {
      return () => {
        let results: [ecs.Entity, values: unknown[]][] = []
        props.query.each((entity, ...rest) => {
          results.push([entity, rest])
        })
        setResults(results)
      }
    }
  }, [props.query, world])
  let offset = (page.page - 1) * page.pageSize
  let tags = props.query.type.components.filter(ecs.is_tag)
  useLayoutEffect(() => {
    ecs.run(world, system)
  }, [props.query, system])
  let entities_count = results.length ?? 0
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
          {props.query.type.relationships.length > 0 && (
            <>
              <styled.dt fontWeight="medium">Relationships</styled.dt>
              <styled.dd marginLeft="3">
                <Text>
                  {props.query.type.relationships
                    .map(aliases.getComponent)
                    .join(", ")}
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
              {props.query.type.components
                .filter(
                  component =>
                    !ecs.is_tag(component) &&
                    !ecs.is_tag_relationship(component),
                )
                .map(component =>
                  ecs.is_relation(component) ? null : (
                    <Table.Head key={component.id}>
                      {aliases.getComponent(component)}
                    </Table.Head>
                  ),
                )}
            </Table.Row>
          </Table.Header>
          <Table.Body overflow="auto">
            {results
              .sort(([a], [b]) => {
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
              .map(([entity]) => (
                <EntityRow
                  key={entity}
                  entity={entity}
                  node={props.query.node}
                  onClick={e => {
                    props.onEntitySelected(entity, props.query.node, e.ctrlKey)
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
