/**
 * Normalize text for search by removing accents and converting to lowercase
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Prepare search term for SQL ILIKE query
 * Converts wildcards (*) to SQL wildcards (%)
 * Adds wildcards to beginning and end if not present
 */
export function prepareSearchTerm(term: string): string {
  // Replace * with %
  let prepared = term.replace(/\*/g, "%")

  // If no wildcards present, add them to beginning and end
  if (!prepared.includes("%")) {
    prepared = `%${prepared}%`
  }

  return prepared
}
