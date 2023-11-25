export const HASH_BASE = 0x811c9dc5 | 0
export const HASH_ENTROPY = 0x01000193 | 0

export let make = (): number => HASH_BASE

export let word = (hash: number, term: number): number =>
  Math.imul(hash ^ term, HASH_ENTROPY)

export let words = (words: number[]): number => {
  let hash = HASH_BASE
  for (let i = 0; i < words.length; i++) {
    hash = word(hash, words[i])
  }
  return hash
}

export let normalize = (hash: number): number => hash >>> 0
