export let product = <T>(array: T[][]): T[][] => {
  let n = array.length
  let lengths = Array(n)
  let cycles = Array(n)
  let total = 1
  for (let i = 0; i < n; ++i) {
    let len = array[i].length
    if (!len) {
      total = 0
      break
    }
    cycles[i] = 0
    total *= lengths[i] = len
  }
  let product = Array(total)
  for (let num = 0; num < total; ++num) {
    let item = Array(n)
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
