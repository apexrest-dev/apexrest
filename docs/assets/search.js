const navigation = document.querySelector('.sidebar details');
if (window.matchMedia('(max-width: 760px)').matches) navigation.open = false;
const input = document.querySelector('#search'),
  results = document.querySelector('#search-results');
let index;
input.addEventListener('input', async () => {
  const query = input.value.trim().toLowerCase();
  results.replaceChildren();
  if (query.length < 2) return;
  try {
    if (!index) {
      const response = await fetch(document.body.dataset.base + 'search-index.json');
      if (!response.ok) throw new Error('Search index unavailable');
      index = await response.json();
    }
    if (input.value.trim().toLowerCase() !== query) return;
    for (const row of index
      .filter((r) =>
        query.split(/\s+/).every((term) => (r.title + ' ' + r.text).toLowerCase().includes(term)),
      )
      .sort(
        (a, b) =>
          Number(b.title.toLowerCase().includes(query)) - Number(a.title.toLowerCase().includes(query)),
      )
      .slice(0, 8)) {
      const li = document.createElement('li'),
        a = document.createElement('a');
      a.href = row.url;
      a.textContent = row.title;
      li.append(a);
      results.append(li);
    }
    if (!results.children.length) results.textContent = document.body.dataset.searchEmpty;
  } catch {
    if (input.value.trim().toLowerCase() !== query) return;
    results.textContent = document.body.dataset.searchError;
  }
});
