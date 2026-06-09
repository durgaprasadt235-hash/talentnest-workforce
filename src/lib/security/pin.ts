import { compare, hash } from "bcryptjs"

const PIN_HASH_ROUNDS = 12

export function hashPin(pin: string) {
  return hash(pin, PIN_HASH_ROUNDS)
}

export function verifyPin(pin: string, pinHash: string) {
  return compare(pin, pinHash)
}
