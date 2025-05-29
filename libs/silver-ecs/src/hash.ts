export const HASH_BASE = 0x811c9dc5 | 0
export const HASH_ENTROPY = 0x01000193 | 0

export let make_hash = (): number => {
  return HASH_BASE
}

export let hash_word = (hash: number = HASH_BASE, term: number): number =>
  Math.imul(hash ^ term, HASH_ENTROPY)

export let hash_words = (words: number[]): number => {
  let hash = HASH_BASE
  for (let i = 0; i < words.length; i++) {
    hash = hash_word(hash, words[i])
  }
  return hash
}

export let as_uint = (hash: number): number => {
  return hash >>> 0
}
