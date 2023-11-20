import {Component, Entity, is_tag, parse_lo} from "silver-ecs"
import {useWorld} from "../hooks/use_world"
import {useMemo} from "react"
import {Code} from "./code"
import {Text} from "./text"

type Props = {
  entity: Entity
  component: Component
}

export let Value = (props: Props) => {
  let world = useWorld()
  let value = useMemo(() => {
    if ("schema" in props.component && props.component.schema) {
      let keys = Object.keys(props.component.schema)
      let value = world.stores[props.component.id][
        parse_lo(props.entity)
      ] as Record<string, string | number>
      return (
        <Code
          whiteSpace="pre"
          display="block"
          border="none"
          background="transparent"
          color="inherit"
        >
          {keys.map(key => (
            <Text as="span" key={key}>{`${key}: ${value[key]}\n`}</Text>
          ))}
        </Code>
      )
    } else {
      return is_tag(props.component) ? "✅" : "unknown"
    }
  }, [])
  return value
}
