import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react"
import {useCallback, useState} from "react"
import {
  Entity,
  Type,
  isRelation,
  isTag,
  isTagRelationship,
  storesValue,
} from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {Box, HStack, Stack, styled} from "../../styled-system/jsx"
import {Button} from "../components/button"
import {IconButton} from "../components/icon_button"
import {Pagination} from "../components/pagination"
import {Table} from "../components/table"
import {Text} from "../components/text"
import {Value} from "../components/value"
import {useAliases} from "../hooks/use_aliases"
import {useWorld} from "../hooks/use_world"
import {Badge} from "../components/badge"
import {Link} from "../components/link"
import {Heading} from "../components/heading"
import {TypeHeader} from "../components/type_header"

type Props = {
  type: Type
  title: string
  entities: Entity[]
  onBack(): void
  onEntitySelected(entity: Entity, select: boolean): void
  onEntityHoverIn(entity: Entity): void
  onEntityHoverOut(entity: Entity): void
}

type EntityRowProps = {
  entity: Entity
  type: Type
  onClick(event: React.MouseEvent): void
  onMouseEnter(): void
  onMouseLeave(): void
  selected: boolean
}

export let EntityRow = (props: EntityRowProps) => {
  return (
    <Table.Row
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      backgroundColor={props.selected ? "green" : undefined}
      color={props.selected ? "accent.fg" : undefined}
      _hover={{
        color: "accent.fg",
        backgroundColor: "accent.default",
        cursor: "pointer",
      }}
    >
      <Table.Cell>{props.entity}</Table.Cell>
      {props.type.components.filter(storesValue).map(component =>
        isRelation(component) ? null : (
          <Table.Cell key={component.id}>
            <Value entity={props.entity} component={component} />
          </Table.Cell>
        ),
      )}
    </Table.Row>
  )
}

export let EntityList = (props: Props) => {
  let world = useWorld()
  let aliases = useAliases()
  let [page, setPage] = useState({page: 1, pageSize: 15})
  let pageOffset = (page.page - 1) * page.pageSize
  return (
    <Stack height="100%">
      <HStack>
        <IconButton onClick={props.onBack} variant="ghost" aria-label="Back">
          <ChevronLeftIcon />
        </IconButton>
        <Heading>{props.title}</Heading>
      </HStack>
      <TypeHeader type={props.type} onEntitySelected={props.onEntitySelected} />
      <styled.div overflow="auto" flex="1">
        <Table.Root>
          <Table.Header position="sticky" top="0" background="bg.default">
            <Table.Row>
              <Table.Head>ID</Table.Head>
              {props.type.components
                .filter(
                  component =>
                    !isTag(component) && !isTagRelationship(component),
                )
                .map(component =>
                  isRelation(component) ? null : (
                    <Table.Head key={component.id}>
                      {aliases.getComponentAlias(component)}
                    </Table.Head>
                  ),
                )}
            </Table.Row>
          </Table.Header>
          <Table.Body overflow="auto">
            {props.entities
              .slice()
              .sort()
              .slice(pageOffset, pageOffset + page.pageSize)
              .map(entity => (
                <EntityRow
                  key={entity}
                  entity={entity}
                  type={props.type}
                  onClick={e => {
                    props.onEntitySelected(entity, e.ctrlKey)
                  }}
                  onMouseEnter={() => props.onEntityHoverIn(entity)}
                  onMouseLeave={() => props.onEntityHoverOut(entity)}
                  selected={world.has(entity, DebugSelected)}
                />
              ))}
          </Table.Body>
        </Table.Root>
      </styled.div>
      {props.entities.length > page.pageSize && (
        <Pagination.Root
          count={props.entities.length}
          pageSize={page.pageSize}
          onPageChange={setPage}
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
