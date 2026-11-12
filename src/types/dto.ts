import type { Prisma } from '@prisma/client';

/**
 * Forme JSON d'une donnée serveur une fois transmise au navigateur :
 * Decimal → chaîne exacte, Date → chaîne ISO.
 */
export type Jsonify<T> = T extends Date
  ? string
  : T extends Prisma.Decimal
    ? string
    : T extends (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

export function toJson<T>(value: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(value)) as Jsonify<T>;
}
