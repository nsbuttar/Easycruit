/** Immutable helpers for editing arrays held in React state. */

export const updateAt = <T>(items: readonly T[], index: number, patch: Partial<T>): T[] =>
  items.map((item, i) => (i === index ? { ...item, ...patch } : item));

export const removeAt = <T>(items: readonly T[], index: number): T[] => items.filter((_, i) => i !== index);

/** One entry per non-empty line. */
export const linesToList = (text: string): string[] => text.split("\n");
export const listToLines = (items: readonly string[]): string => items.join("\n");
