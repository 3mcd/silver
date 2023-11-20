import {Component, Entity, is_tag, parse_lo} from "silver-ecs"
import {useWorld} from "../hooks/use_world"
import React, {useMemo} from "react"
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
      let schema = props.component.schema!
      let keys = Object.keys(props.component.schema)
      let value = world.stores[props.component.id][parse_lo(props.entity)] as
        | Record<string, string | number>
        | string
        | number
      let children: React.ReactNode
      if (typeof schema === "object") {
        children = keys.map(key => {
          let inner_schema = schema[key]
          let inner_value: string | number = (
            value as Record<string, string | number>
          )[key]
          if (inner_schema === "string") {
            inner_value = `"${inner_value}"`
          } else {
            inner_value = (inner_value as number).toFixed(3)
          }
          return <Text as="span" key={key}>{`${key}: ${inner_value}\n`}</Text>
        })
      } else if (schema === "string") {
        children = <Text as="span">{value as string}</Text>
      } else {
        children = <Text as="span">{(value as number).toFixed(3)}</Text>
      }
      return (
        <Code
          whiteSpace="pre"
          display="block"
          border="none"
          background="transparent"
          color="inherit"
        >
          {children}
        </Code>
      )
    } else {
      return is_tag(props.component) ? "✅" : "?"
    }
  }, [])
  return value
}
