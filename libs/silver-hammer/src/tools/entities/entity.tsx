import * as ecs from "silver-ecs"
import {Button} from "../../components/button"

type Props = {
  entity: ecs.Entity
  node: ecs.Graph.Node
  onBack(): void
}

export let Entity = (props: Props) => {
  return <Button onClick={props.onBack}>Back</Button>
}
