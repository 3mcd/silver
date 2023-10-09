export const make = () => 0

export const word = (hash: number, word: number) =>
  Math.imul((hash << 5) ^ (word | 0), 0x9e3779b9)

export const words = (words: number[]) => {
  let hash = 0
  for (let i = 0; i < words.length; i++) {
    hash = word(hash, words[i])
  }
  return hash
}
