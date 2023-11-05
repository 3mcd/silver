export const cartesian = <T>(array: T[][]): T[][] => {
  const n = array.length
  const lengths = Array(n)
  const cycles = Array(n)
  let total = 1
  for (let i = 0; i < n; ++i) {
    const len = array[i].length
    if (!len) {
      total = 0
      break
    }
    cycles[i] = 0
    total *= lengths[i] = len
  }
  const product = Array(total)
  for (let num = 0; num < total; ++num) {
    const item = Array(n)
    for (let j = 0; j < n; ++j) {
      item[j] = array[j][cycles[j]]
    }
    product[num] = item
    for (let idx = 0; idx < n; ++idx) {
      if (cycles[idx] == lengths[idx] - 1) {
        cycles[idx] = 0
      } else {
        cycles[idx] += 1
        break
      }
    }
  }
  return product
}

export const permute = <T>(array: T[], n: number) => {
  const base = array.length
  const counter = Array(n).fill(base === 1 ? array[0] : 0)
  if (base === 1) return [counter]
  const permutations = []
  const increment = (i: number) => {
    if (counter[i] === base - 1) {
      counter[i] = 0
      increment(i - 1)
    } else {
      counter[i]++
    }
  }
  for (let i = base ** n; i--; ) {
    const permutation = []
    for (let j = 0; j < counter.length; j++) {
      permutation.push(array[counter[j]])
    }
    permutations.push(permutation)
    increment(counter.length - 1)
  }
  return permutations
}
