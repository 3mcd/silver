import {Portal} from "@ark-ui/react"
import * as ecs from "silver-ecs"
import {useAliases} from "../hooks/use_aliases"
import {Code} from "./code"
import {Text} from "./text"
import {Tooltip} from "./tooltip"
import {Fragment} from "react"

type Props = {
  type: ecs.Type
}

type ComponentProps = {
  component: ecs.Component
}

export let Component = (props: ComponentProps) => {
  let aliases = useAliases()
  let alias = aliases.getComponentAlias(props.component) ?? props.component.id
  let schema = "schema" in props.component ? props.component.schema : undefined
  if (schema === undefined) {
    return <Text as="span">{alias}</Text>
  }
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Text as="span" cursor="pointer" textDecoration="underline">
          {alias}
        </Text>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Arrow>
            <Tooltip.ArrowTip />
          </Tooltip.Arrow>
          <Tooltip.Content>
            <Code
              whiteSpace="pre"
              display="block"
              backgroundColor="transparent"
              color="inherit"
              border="none"
            >
              {JSON.stringify(schema, null, 2)}
            </Code>
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  )
}

export let Type = (props: Props) => {
  return (
    <Text>
      {props.type.components.map((component, i) =>
        ecs.isRelation(component) ? null : (
          <Fragment key={component.id}>
            <Component component={component} />
            {i < props.type.components.length - 1 && ", "}
          </Fragment>
        ),
      )}
    </Text>
  )
}
