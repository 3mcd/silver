import {ChevronLeftIcon} from "lucide-react"
import {HStack, Stack} from "../../styled-system/jsx"
import {Heading} from "../components/heading"
import {IconButton} from "../components/icon_button"
import * as ecs from "silver-ecs"
import {TypeHeader} from "../components/type_header"
import {useWorld} from "../hooks/use_world"
import {Fragment, useEffect, useMemo} from "react"
import {useAliases} from "../hooks/use_aliases"
import {Value} from "../components/value"
import {isValue} from "silver-ecs/src/data/component"
import {DebugHighlighted} from "silver-lib"

type Props = {
  entity: ecs.Entity
  onBack(): void
  onEntitySelected(entity: ecs.Entity, select: boolean): void
}

export let Entity = (props: Props) => {
  let aliases = useAliases()
  let world = useWorld()
  let type = useMemo(
    () => world.locate(props.entity).type,
    [world, props.entity],
  )
  useEffect(() => {
    world.add(props.entity, DebugHighlighted)
    return () => {
      world.remove(props.entity, DebugHighlighted)
    }
  }, [world, props.entity])
  return (
    <Stack height="100%">
      <HStack>
        <IconButton onClick={props.onBack} variant="ghost" aria-label="Back">
          <ChevronLeftIcon />
        </IconButton>
        <Heading>Entity: {props.entity}</Heading>
      </HStack>
      <TypeHeader type={type} onEntitySelected={props.onEntitySelected} />
      <Stack paddingX="4">
        {type.components.map(component =>
          isValue(component) ? (
            <Fragment key={component.id}>
              <Heading as="h3">{aliases.getComponentAlias(component)}</Heading>
              <Value entity={props.entity} component={component} />
            </Fragment>
          ) : null,
        )}
      </Stack>
    </Stack>
  )
}
