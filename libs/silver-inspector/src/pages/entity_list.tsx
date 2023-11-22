import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react"
import React, {memo, useCallback, useMemo, useRef, useState} from "react"
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
import {PageHeading} from "../components/page_heading"

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
  onClick(entity: Entity, ctrlKey: boolean): void
  onMouseEnter(entity: Entity): void
  onMouseLeave(entity: Entity): void
  selected: boolean
}

let entityRowHover = {
  color: "accent.fg",
  backgroundColor: "accent.default",
  cursor: "pointer",
}

export let EntityRow = memo((props: EntityRowProps) => {
  let onClick = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement, MouseEvent>) => {
      props.onClick(props.entity, event.ctrlKey)
    },
    [props.entity, props.onClick],
  )
  let timeout = useRef<number | NodeJS.Timeout | null>(null)
  let onMouseEnter = useCallback(() => {
    timeout.current = setTimeout(() => {
      props.onMouseEnter(props.entity)
    }, 500)
  }, [props.entity, props.onMouseEnter])
  let onMouseLeave = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current)
      props.onMouseLeave(props.entity)
    }
    timeout.current = null
  }, [props.entity, props.onMouseLeave])

  return (
    <Table.Row
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      backgroundColor={props.selected ? "green" : undefined}
      color={props.selected ? "accent.fg" : undefined}
      _hover={entityRowHover}
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
})

type EntityListHeaderProps = {
  type: Type
}

export let EntityListHeader = memo((props: EntityListHeaderProps) => {
  let aliases = useAliases()
  return (
    <Table.Header position="sticky" top="0" background="bg.default">
      <Table.Row>
        <Table.Head>ID</Table.Head>
        {props.type.components
          .filter(
            component => !isTag(component) && !isTagRelationship(component),
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
  )
})

export let EntityList = (props: Props) => {
  let world = useWorld()
  let [page, setPage] = useState({page: 1, pageSize: 15})
  let pageOffset = (page.page - 1) * page.pageSize
  return (
    <Stack height="100%">
      <PageHeading title={props.title} onBack={props.onBack} />
      <TypeHeader type={props.type} onEntitySelected={props.onEntitySelected} />
      <styled.div overflow="auto" flex="1">
        <Table.Root>
          <EntityListHeader type={props.type} />
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
                  onClick={props.onEntitySelected}
                  onMouseEnter={props.onEntityHoverIn}
                  onMouseLeave={props.onEntityHoverOut}
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
          overflow="auto"
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
