export const product = <T>(array: T[][]): T[][] => {
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
