export const parseEmailList = (raw: string): string[] =>
  raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
