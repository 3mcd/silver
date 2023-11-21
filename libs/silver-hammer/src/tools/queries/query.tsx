import {useLayoutEffect, useMemo, useState} from "react"
import * as ecs from "silver-ecs"
import {useWorld} from "../../hooks/use_world"
import {EntityList} from "../../pages/entity_list"
import {QueryDef} from "../../context/query_context"
import {useNode} from "../../hooks/use_graph"

type Props = {
  query: QueryDef
  onBack(): void
  onEntitySelected(entity: ecs.Entity, ctrlKey: boolean): void
  onEntityHoverIn(entity: ecs.Entity): void
  onEntityHoverOut(entity: ecs.Entity): void
}

export let Query = (props: Props) => {
  let world = useWorld()
  let [results, setResults] = useState<ecs.Entity[]>([])
  let system = useMemo<ecs.System>(() => {
    return () => {
      return () => {
        let results: ecs.Entity[] = []
        props.query.query.each(entity => {
          results.push(entity)
        })
        setResults(results)
      }
    }
  }, [props.query, world])
  let version = useNode(props.query.query.node)
  useLayoutEffect(() => {
    ecs.run(world, system)
  }, [props.query, system, version])
  return (
    <EntityList
      entities={results}
      type={props.query.query.type}
      onEntitySelected={props.onEntitySelected}
      onEntityHoverIn={props.onEntityHoverIn}
      onEntityHoverOut={props.onEntityHoverOut}
      onBack={props.onBack}
    />
  )
}
