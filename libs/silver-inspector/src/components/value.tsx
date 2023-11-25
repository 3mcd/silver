import {
  Component,
  Entity,
  Express,
  Schema,
  isTag,
  parseHi,
  parseLo,
  storesValue,
} from "silver-ecs"
import {getRelation, isValueRelationship} from "silver-ecs/src/data/component"
import {useWorld} from "../hooks/use_world"
import {Code} from "./code"
import {Text} from "./text"

type Props = {
  entity: Entity
  component: Component
}

type ValueInnerProps<U extends Schema.T> = {
  schema: U
  value: Express<U>
}

export let ValueInner = <U extends Schema.T>(props: ValueInnerProps<U>) => {
  if (typeof props.schema === "object") {
    let keys = Object.keys(props.schema) as Exclude<keyof U, symbol>[]
    let children = keys.map((key, i) => {
      let innerSchema = props.schema[key]
      let innerValue = (props.value as any)[key]
      return (
        <Text as="span" key={key}>
          {key}: <ValueInner schema={innerSchema as any} value={innerValue} />
          {i === keys.length - 1 ? "" : "\n"}
        </Text>
      )
    })
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
  } else if (props.schema === "string") {
    return (
      <Text as="span" color="amber.12">
        "{props.value as unknown as string}"
      </Text>
    )
  } else {
    return (
      <Text as="span" color="blue.11">
        {Math.round((props.value as unknown as number) * 100) / 100}
      </Text>
    )
  }
}

export let Value = (props: Props) => {
  let world = useWorld()
  let component = props.component
  if (storesValue(component)) {
    let value = world.stores[component.id][parseLo(props.entity)]
    if (isValueRelationship(component)) {
      component = getRelation(parseHi(component.id))!
    }
    return (
      <Code
        whiteSpace="pre"
        display="block"
        border="none"
        background="transparent"
        color="inherit"
        fontFamily="monospace"
      >
        {"schema" in component && component.schema !== undefined ? (
          <ValueInner
            schema={component.schema}
            value={value as Express<Schema.T>}
          />
        ) : (
          "?"
        )}
      </Code>
    )
  } else {
    return isTag(props.component) ? "✅" : "?"
  }
}
