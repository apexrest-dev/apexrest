# Reports, charts and Universal Theme in 26.2

Interactive Reports gain modernized filters, multi-select text filters, numeric/date ranges and drag-and-drop column ordering. Test saved reports, subscriptions, downloads and reset behavior after upgrade. Automatic reset defaults on for new applications and off for existing applications.

Key phrases such as `sort by sale date descending`, `break on category name` and `reset` can execute without an LLM when validated against the report. Release notes say this applies to AI and non-AI reports; verify both browser paths because the launch blog contains a conflicting description of the non-AI fallback. Ambiguous or unsupported input follows the report's normal processing.

AI Interactive Reports create ordinary computed-column customizations from natural language. The underlying source query is unchanged. Test review/edit/save/remove and data access with the actual user. Use report context and model/service configuration intentionally; a compiled page does not prove AI interpretation.

Chart `performance.lazyLoading` controls initial data loading. Visibility-based initialization must be tested with declarative Show/Hide, tabs, collapsible containers and Region Display Selector. Exercise custom visibility code, reduced-motion preference and refresh scheduling in a browser.

```javascript
apex.region.multipleRefresh(["sales-chart", "orders-grid"]);
```

The new multipleRefresh API coalesces eligible Chart, Interactive Grid, Cards and Template Component requests; other regions use separate requests. This is an API reference example, not observed browser behavior. Universal Theme 26.2 adds Iris appearances and styling changes; keep 26.1 theme support and refresh themes as a separately reviewed change.

Sources: [reports](https://blogs.oracle.com/apex/whats-new-in-interactive-reports-and-ai-interactive-reports), [chart and JavaScript APIs](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/new-features.html), [changed behavior](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/changed-behavior.html).
