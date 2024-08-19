class SystemGraph<T> {
  vertices_ = new Map<T, Set<T>>()
}

export type T<U> = SystemGraph<U>

export const make = <T>() => {
  return new SystemGraph<T>()
}

export const edges = <T>(graph: SystemGraph<T>, vertex: T) => {
  let edges = graph.vertices_.get(vertex)
  if (edges === undefined) {
    edges = new Set()
    graph.vertices_.set(vertex, edges)
  }
  return edges
}

export const sort = <T>(
  graph: SystemGraph<T>,
  vertex: T,
  rank: number,
  ranked: Map<T, number>,
  visited: Set<T>,
) => {
  visited.add(vertex)
  const adjacentVertices = edges(graph, vertex)
  for (const adjacentVertex of adjacentVertices) {
    if (!visited.has(adjacentVertex)) {
      rank = sort(graph, adjacentVertex, rank, ranked, visited)
    }
  }
  ranked.set(vertex, rank)
  return rank - 1
}

export const add_edge = <T>(graph: SystemGraph<T>, vertex: T, dep: T) => {
  edges(graph, vertex).add(dep)
}

export const remove = <T>(graph: SystemGraph<T>, vertex: T) => {
  graph.vertices_.delete(vertex)
  graph.vertices_.forEach(graphVertex => {
    graphVertex.delete(vertex)
  })
}

export const build = <T>(graph: SystemGraph<T>) => {
  const vertices = Array.from(graph.vertices_.keys())
  const visited = new Set<T>()
  const ranks = new Map<T, number>()
  let rank = vertices.length - 1
  for (const vertex of vertices) {
    if (!visited.has(vertex)) {
      rank = sort(graph, vertex, rank, ranks, visited)
    }
  }
  return Array.from(ranks.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([t]) => t)
}
