import * as Transaction from "./transaction"
import * as Node from "./node"

export interface NodeListener {
  on_node_entities_changed(): void
  on_node_created(node: Node.T): void
  on_node_disposed(node: Node.T): void
  on_entities_in(batch: Transaction.Batch): void
  on_entities_out(batch: Transaction.Batch): void
}
