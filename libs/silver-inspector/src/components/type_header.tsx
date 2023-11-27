import {Box, HStack, styled} from "../../styled-system/jsx"
import {Badge} from "../components/badge"
import {Heading} from "../components/heading"
import {Link} from "../components/link"
import {Text} from "../components/text"

import * as ecs from "silver-ecs"
import {useAliases} from "../hooks/use_aliases"
import {useWorld} from "../hooks/use_world"
import {DebugHighlighted, DebugSelected, Name} from "silver-lib"
import {memo} from "react"

type Props = {
  type: ecs.Type
  onEntitySelected(entity: ecs.Entity, select: boolean): void
}

export let TypeHeader = memo((props: Props) => {
  let world = useWorld()
  let aliases = useAliases()
  let tags = props.type.components.filter(
    component =>
      ecs.isTag(component) && component !== DebugHighlighted.components[0],
  )
  return tags.length + props.type.relationships.length > 0 ? (
    <HStack paddingX="2" fontSize="sm" gap="2" paddingBottom="4">
      {tags.length > 0 && (
        <Box flex="1">
          <Heading as="h3" fontWeight="medium" fontSize="sm">
            Tags
          </Heading>
          <HStack gap="1">
            {tags.map(tag => (
              <Badge
                key={tag.id}
                variant="solid"
                background={
                  tag === DebugSelected.components[0]
                    ? "sky.7"
                    : "accent.default"
                }
              >
                {aliases.getComponentAlias(tag)}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}
      {props.type.relationships.length > 0 && (
        <Box flex="1">
          <Heading as="h3" fontWeight="medium" fontSize="sm">
            Relationships
          </Heading>
          <styled.ul>
            {props.type.relationships.map(relationship => {
              let [relationAlias, relative] = aliases
                .getComponentAlias(relationship)
                .split(":")
              let relativeEntity = world.hydrate(Number(relative))
              relative = world.get(relativeEntity, Name) ?? relative
              return (
                <li key={relationship.id}>
                  <Text as="span" marginRight="1">
                    {relationAlias}:
                  </Text>
                  <Link
                    onClick={() =>
                      props.onEntitySelected(relativeEntity, false)
                    }
                  >
                    {relative}
                  </Link>
                </li>
              )
            })}
          </styled.ul>
        </Box>
      )}
    </HStack>
  ) : null
})
