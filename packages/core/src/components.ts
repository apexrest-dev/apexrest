import { createReferenceCatalog } from './reference-catalog.ts';

export type { CatalogReference as ComponentReference } from './reference-catalog.ts';

const catalog = createReferenceCatalog({
  directory: 'components',
  prefix: 'component:',
  documentDirectory: 'documents',
  label: 'Component',
  faultPrefix: 'COMPONENT',
  classification: 'component-reference-data',
});

export const componentSearch = catalog.search;
export const componentRead = catalog.read;
export const componentCandidates = catalog.candidates;
