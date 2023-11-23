export let make = () => 0

export let word = (hash: number, word: number) =>
  Math.imul((hash << 4) ^ (word | 0), 0x9e3779b9)

export let words = (words: number[]) => {
  let hash = 0
  for (let i = 0; i < words.length; i++) {
    hash = word(hash, words[i])
  }
  return hash
}
