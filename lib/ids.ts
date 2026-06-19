import { customAlphabet } from "nanoid"

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
const gen = customAlphabet(alphabet, 20)

/** Prefixed, sortable-ish id, e.g. mem_a1b2c3... */
export const newId = (prefix: string): string => `${prefix}_${gen()}`
