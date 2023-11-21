import * as ecs from "silver-ecs"
import {Button} from "../components/button"

type Props = {
  type: ecs.Type
  entity: ecs.Entity
  onBack(): void
}

export let Entity = (props: Props) => {
  return <Button onClick={props.onBack}>Back</Button>
}
