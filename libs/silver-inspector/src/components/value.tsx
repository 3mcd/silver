import * as S from "silver-ecs"
import {useWorld} from "../hooks/use_world"
import {Code} from "./code"
import {Text} from "./text"

type Props = {
  entity: S.Entity
  component: S.Component
}

type ValueInnerProps<U extends S.Schema.T> = {
  schema: U
  value: S.Express<U>
}

export let ValueInner = <U extends S.Schema.T>(props: ValueInnerProps<U>) => {
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
  if (S.references_value(component)) {
    let value = world.entity_data[component.id][S.parse_lo(props.entity)]
    if (S.is_ref_pair(component)) {
      component = S.find_component_by_id(S.parse_hi(component.id))!
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
            value={value as S.Express<S.Schema.T>}
          />
        ) : (
          "?"
        )}
      </Code>
    )
  } else {
    return S.is_tag(props.component) ? "✅" : "?"
  }
}
