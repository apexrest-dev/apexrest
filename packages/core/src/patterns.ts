import { createReferenceCatalog } from './reference-catalog.ts';

export type { CatalogReference as PatternReference } from './reference-catalog.ts';

const catalog = createReferenceCatalog({
  directory: 'patterns',
  prefix: 'pattern:',
  documentDirectory: 'docs',
  label: 'Pattern',
  faultPrefix: 'PATTERN',
  classification: 'pattern-reference-data',
});

export const patternSearch = catalog.search;
export const patternRead = catalog.read;
export const patternCandidates = catalog.candidates;
