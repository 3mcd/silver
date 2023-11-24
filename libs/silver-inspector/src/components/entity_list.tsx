import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react"
import React, {memo, useCallback, useState} from "react"
import {
  Entity,
  Type,
  isRelation,
  isTag,
  isTagRelationship,
  storesValue,
} from "silver-ecs"
import {DebugSelected} from "silver-lib"
import {Stack, styled} from "../../styled-system/jsx"
import {Button} from "./button"
import {IconButton} from "./icon_button"
import {PageHeading} from "./page_heading"
import {Pagination} from "./pagination"
import {Table} from "./table"
import {TypeHeader} from "./type_header"
import {Value} from "./value"
import {useAliases} from "../hooks/use_aliases"
import {useWorld} from "../hooks/use_world"

type Props = {
  type: Type
  entities: Entity[]
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
  backgroundColor: "accent.8",
  cursor: "pointer",
}

export let EntityRow = memo((props: EntityRowProps) => {
  let onClick = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement, MouseEvent>) => {
      props.onClick(props.entity, event.ctrlKey)
    },
    [props.entity, props.onClick],
  )
  let onMouseEnter = useCallback(() => {
    props.onMouseEnter(props.entity)
  }, [props.entity, props.onMouseEnter])
  let onMouseLeave = useCallback(() => {
    props.onMouseLeave(props.entity)
  }, [props.entity, props.onMouseLeave])

  return (
    <Table.Row
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      backgroundColor={props.selected ? "grass.7" : undefined}
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
    <>
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
    </>
  )
}
