import {ChevronLeftIcon} from "lucide-react"
import {Fragment, memo, useEffect, useMemo} from "react"
import * as ecs from "silver-ecs"
import {isValue} from "silver-ecs/src/data/component"
import {DebugHighlighted, Name} from "silver-lib"
import {HStack, Stack} from "../../styled-system/jsx"
import {Heading} from "../components/heading"
import {IconButton} from "../components/icon_button"
import {TypeHeader} from "../components/type_header"
import {Value} from "../components/value"
import {useAliases} from "../hooks/use_aliases"
import {useWorld} from "../hooks/use_world"
import {PageHeading} from "../components/page_heading"

type Props = {
  entity: ecs.Entity
  onBack(): void
  onEntitySelected(entity: ecs.Entity, select: boolean): void
}

export let Entity = memo((props: Props) => {
  let aliases = useAliases()
  let world = useWorld()
  let type = useMemo(
    () => world.locate(props.entity).type,
    [world, props.entity],
  )
  let name = world.get(props.entity, Name)
  useEffect(() => {
    world.add(props.entity, DebugHighlighted)
    return () => {
      world.remove(props.entity, DebugHighlighted)
    }
  }, [world, props.entity])
  return (
    <Stack height="100%">
      <PageHeading
        title={name ?? `Entity: ${props.entity}`}
        onBack={props.onBack}
      />
      <TypeHeader type={type} onEntitySelected={props.onEntitySelected} />
      <Stack paddingX="4">
        {type.components.map(component =>
          isValue(component) && component !== ecs.componentAt(Name, 0) ? (
            <Fragment key={component.id}>
              <Heading as="h3">{aliases.getComponentAlias(component)}</Heading>
              <Value entity={props.entity} component={component} />
            </Fragment>
          ) : null,
        )}
      </Stack>
    </Stack>
  )
})
