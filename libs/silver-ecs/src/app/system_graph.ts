class SystemGraph<T> {
  vertices_ = new Map<T, Set<T>>()
}

export type T<U> = SystemGraph<U>

export let make = <T>() => {
  return new SystemGraph<T>()
}

export let edges = <T>(graph: SystemGraph<T>, vertex: T) => {
  let edges = graph.vertices_.get(vertex)
  if (edges === undefined) {
    edges = new Set()
    graph.vertices_.set(vertex, edges)
  }
  return edges
}

export let sort = <T>(
  graph: SystemGraph<T>,
  vertex: T,
  rank: number,
  ranked: Map<T, number>,
  visited: Set<T>,
) => {
  visited.add(vertex)
  let adj_vertices = edges(graph, vertex)
  for (let adj_vertex of adj_vertices) {
    if (!visited.has(adj_vertex)) {
      rank = sort(graph, adj_vertex, rank, ranked, visited)
    }
  }
  ranked.set(vertex, rank)
  return rank - 1
}

export let add_edge = <T>(graph: SystemGraph<T>, vertex: T, dep: T) => {
  edges(graph, vertex).add(dep)
}

export let remove = <T>(graph: SystemGraph<T>, vertex: T) => {
  graph.vertices_.delete(vertex)
  graph.vertices_.forEach(graphVertex => {
    graphVertex.delete(vertex)
  })
}

export let build = <T>(graph: SystemGraph<T>) => {
  let vertices = Array.from(graph.vertices_.keys())
  let visited = new Set<T>()
  let ranks = new Map<T, number>()
  let rank = vertices.length - 1
  for (let vertex of vertices) {
    if (!visited.has(vertex)) {
      rank = sort(graph, vertex, rank, ranks, visited)
    }
  }
  return Array.from(ranks.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([t]) => t)
}
