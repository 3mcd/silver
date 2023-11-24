import {ListMinus, ListPlus} from "lucide-react"
import {Fragment, memo, useCallback, useEffect} from "react"
import * as ecs from "silver-ecs"
import {isValue} from "silver-ecs/src/data/component"
import {DebugHighlighted, DebugSelected, Name} from "silver-lib"
import {Stack} from "../../../styled-system/jsx"
import {useAliases} from "../../hooks/use_aliases"
import {useNode} from "../../hooks/use_graph"
import {useWorld} from "../../hooks/use_world"
import {Heading} from "../../components/heading"
import {IconButton} from "../../components/icon_button"
import {Page} from "../../components/page"
import {TypeHeader} from "../../components/type_header"
import {Value} from "../../components/value"

type Props = {
  entity: ecs.Entity
  onBack(): void
  onEntitySelected(entity: ecs.Entity, select: boolean): void
}

export let Inner = (props: Props & {type: ecs.Type}) => {
  let aliases = useAliases()
  let world = useWorld()
  let name = world.get(props.entity, Name)
  let onSelect = useCallback(() => {
    if (world.has(props.entity, DebugSelected)) {
      world.remove(props.entity, DebugSelected)
    } else {
      world.add(props.entity, DebugSelected)
    }
  }, [world, props.entity])

  useEffect(() => {
    world.add(props.entity, DebugHighlighted)
    return () => {
      if (world.isAlive(props.entity)) {
        world.remove(props.entity, DebugHighlighted)
      }
    }
  }, [world, props.entity])

  return (
    <Page
      title={name ?? `Entity ${props.entity}`}
      onBack={props.onBack}
      extra={
        <IconButton
          aria-label="Select entity"
          variant="ghost"
          onClick={onSelect}
        >
          {world.has(props.entity, DebugSelected) ? (
            <ListMinus />
          ) : (
            <ListPlus />
          )}
        </IconButton>
      }
    >
      <TypeHeader type={props.type} onEntitySelected={props.onEntitySelected} />
      <Stack paddingX="4">
        {props.type.components.map(component =>
          isValue(component) && component !== ecs.componentAt(Name, 0) ? (
            <Fragment key={component.id}>
              <Heading as="h3">{aliases.getComponentAlias(component)}</Heading>
              <Value entity={props.entity} component={component} />
            </Fragment>
          ) : null,
        )}
      </Stack>
    </Page>
  )
}

export let Entity = (props: Props) => {
  let world = useWorld()
  let node = world.isAlive(props.entity)
    ? world.locate(props.entity)
    : world.graph.root
  // Subscribe to changes in the entity's node so we can re-render if it is
  // moved or despawned. Right now this causes a re-render for any entity
  // that is changed within the node.
  useNode(node)
  if (world.isAlive(props.entity)) {
    return <Inner {...props} type={node.type} />
  } else {
    return (
      <Page title={`Entity ${props.entity}`} onBack={props.onBack}>
        <p>This entity was despawned and no longer exists.</p>
      </Page>
    )
  }
}
