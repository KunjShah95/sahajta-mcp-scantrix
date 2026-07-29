// Display-only text formatting helpers. Never write the result back to
// stored/persisted data — call these at render time only.

// Capitalizes the first letter of each word, leaving every other character
// untouched (so existing internal capitals like "McDonald" or "O'Brien"
// survive, and nothing is force-lowercased).
export function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
