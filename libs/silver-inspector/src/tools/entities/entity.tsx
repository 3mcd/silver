import {ListMinus, ListPlus, MoreHorizontal, Trash} from "lucide-react"
import {Fragment, useCallback, useEffect} from "react"
import * as S from "silver-ecs"
import {DebugHighlighted, DebugSelected, Name} from "silver-lib"
import {HStack, Stack} from "../../../styled-system/jsx"
import {Heading} from "../../components/heading"
import {IconButton} from "../../components/icon_button"
import {Menu} from "../../components/menu"
import {Page} from "../../components/page"
import {Text} from "../../components/text"
import {TypeHeader} from "../../components/type_header"
import {Value} from "../../components/value"
import {useAliases} from "../../hooks/use_aliases"
import {useNode} from "../../hooks/use_graph"
import {useWorld} from "../../hooks/use_world"

type Props = {
  entity: S.Entity
  onBack(): void
  onEntitySelected(entity: S.Entity, select: boolean): void
}

export let Inner = (props: Props & {type: S.Type}) => {
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
  let onDespawn = useCallback(() => {
    world.despawn(props.entity)
  }, [world, props.entity])

  useEffect(() => {
    world.add(props.entity, DebugHighlighted)
    return () => {
      if (world.isAlive(props.entity)) {
        world.remove(props.entity, DebugHighlighted)
      }
    }
  }, [world, props.entity])

  let selected = world.has(props.entity, DebugSelected)

  return (
    <Page
      title={name ?? `Entity ${props.entity}`}
      onBack={props.onBack}
      extra={
        <HStack gap={0}>
          <IconButton
            aria-label={selected ? "Deselect entity" : "Select entity"}
            title={selected ? "Deselect entity" : "Select entity"}
            variant="ghost"
            onClick={onSelect}
          >
            {selected ? <ListMinus /> : <ListPlus />}
          </IconButton>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton variant="ghost">
                <MoreHorizontal />
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content backgroundColor="bg.solid">
                <Menu.ItemGroup id="group-1">
                  <Menu.Item id="despawn" onClick={onDespawn}>
                    <HStack gap="2">
                      <Trash /> Despawn
                    </HStack>
                  </Menu.Item>
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </HStack>
      }
    >
      <TypeHeader type={props.type} onEntitySelected={props.onEntitySelected} />
      <Stack paddingX="4">
        {props.type.ordered.map(component =>
          S.isValue(component) && component !== S.componentAt(Name, 0) ? (
            <Fragment key={component.id}>
              <Heading as="h3" fontWeight="medium" fontSize="md">
                {aliases.getComponentAlias(component)}
              </Heading>
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
        <Text padding="4">This entity was despawned and no longer exists.</Text>
      </Page>
    )
  }
}
