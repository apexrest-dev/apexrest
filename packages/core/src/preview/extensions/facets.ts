import { registerExtension } from '../extensions.ts';
import { renderCards } from './facets/cards.ts';
import { FACETS_CLIENT } from './facets/client.ts';
import { renderDisplaySelector, renderListView } from './facets/lists.ts';
import { facetsRoute, filterSql, renderFilters } from './facets/search.ts';

/**
 * Search and cards: Faceted Search and Smart Filters (genuine `apex.facets` widget, filtering
 * the bound region on the server), the Cards region, List View and Region Display Selector.
 */
registerExtension({
  name: 'facets',
  regions: {
    facetedSearch: (renderer, ctx, region) => renderFilters(renderer, ctx, region),
    smartFilters: (renderer, ctx, region) => renderFilters(renderer, ctx, region),
    cards: (renderer, ctx, region) => renderCards(renderer, ctx, region),
    listView: (renderer, ctx, region) => renderListView(renderer, ctx, region),
    regionDisplaySelector: (renderer, ctx, region) => renderDisplaySelector(renderer, ctx, region),
  },
  regionSql: filterSql,
  routes: { facets: facetsRoute },
  client: FACETS_CLIENT,
  css: `.apex-local-facet-items{display:none}`,
});
