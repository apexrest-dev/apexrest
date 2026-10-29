import { createReferenceCatalog } from './reference-catalog.ts';

// Public page sources are reference material, not dependency-closed local recipes.
const catalog = createReferenceCatalog({
  directory: 'public-templates/26.2',
  prefix: 'oracle:26.2:public-template/',
  documentDirectory: 'documents',
  label: 'Public template',
  faultPrefix: 'PUBLIC_TEMPLATE',
  classification: 'component-reference-data',
});

export const publicTemplateSearch = catalog.search;
export const publicTemplateRead = catalog.read;
export const publicTemplateCandidates = catalog.candidates;
