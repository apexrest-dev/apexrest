# Semantic page edits

Use `apexrest_project action:patch` for small property changes on an existing page instead of editing `.apx` text by hand. It replaces only the value bytes of the named property. Comments, ``` literals, Oracle metadata, ids and every other component keep their bytes. A missing property or group is inserted with the file's own indentation and line endings.

| Target              | Properties                                 | APEXlang path                                                            |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `page`              | `title`                                    | `title`                                                                  |
| `region:ID`         | `title`, `sequence`                        | `name`, `layout.sequence`                                                |
| `item:NAME`         | `label`, `sequence`                        | `label.label`, `layout.sequence`                                         |
| `button:ID`         | `label`, `sequence`                        | `label`, `layout.sequence`                                               |
| `column:REGION.COL` | `heading`, `format`, `sequence`, `visible` | `heading.heading`, `appearance.formatMask`, `layout.sequence`, see below |

0. `apexrest_project action:context page:"10"` returns the page's targets with their current values, report SQL and columns, and the `digest` to patch with. Read it instead of the whole page file.
1. Without `expectedDigest` it changes nothing and returns the current page-file digest (`currentDigest`); `action:context` gives it too. (CLI: `--dry-run` shows the result without writing.)
2. Call it again with `expectedDigest`. The digest is checked again under the project edit lock, right before the atomic replace. A changed file returns `TRANSFORM_CONFLICT`: read it again.
3. A successful `patch`, `insert` or `edit` returns `context`: the new `digest` and the `changed`, `inserted` and `removed` targets with their values, taken from the bytes written. Use them for the next edit instead of calling `action:context` again. `context:"full"` returns the whole page context; `context:"none"` leaves it out.
4. A source edit is not a compiler or import result. Ship as usual.

```text
apexrest_project action:patch project:/abs/project page:"10" expectedDigest:"<currentDigest>" operations:[{"target":"column:customers.EMAIL","property":"heading","value":"E-mail address"},{"target":"item:P10_SEARCH","property":"label","value":"Search"}]
```

A `query` operation replaces a report's SQL and sets its complete column contract in one change: `columns` lists every column in display order (`name`, optional `heading`, `dataType` of `varchar2`, `number`, `date` or `timestamp`). Kept columns keep all their properties; dropped ones are removed; new ones get a heading, a data type and the next sequence. Every column must appear in the query.

Unknown targets, ambiguous ids, unsupported properties, multi-line values and constructs the scanner does not support fail before anything is written. Edit those in source.

## Add regions, items and refreshes to an existing page

`apexrest_project action:insert page:"10" components:{regions, items?, refreshes?} expectedDigest:"<digest>"` appends components to an existing page. It uses the scaffold emitter and the [scaffold](scaffold.md) region and item fields.

- Region ids must be explicit and new.
- Item names must start with the page prefix (`P10_`).
- A refresh may target new or existing regions; its dynamic action gets an unused name.
- Existing components keep their bytes. The edit uses the same digest, lock and atomic write as `patch`.
- For a working filter use the `addFilter` edit below; it also submits and binds the item.

## Several changes in one edit

`apexrest_project action:edit page:"10" expectedDigest:"<digest>" operations:[...]` combines `{"op":"set", target, property, value, columns?}` (the `patch` operations) and `{"op":"insert", components}` (the `insert` fragment) in one transaction. Every operation resolves against the page you read; the result is checked and written once, or not at all. An operation cannot target a component another operation of the same edit inserts: insert it, then edit it with the new digest.

```text
apexrest_project action:edit page:"10" expectedDigest:"<digest>" operations:[{"op":"insert","components":{"regions":[{"id":"filters","type":"staticContent","name":"Filters"}],"items":[{"name":"P10_STATUS","region":"filters","type":"selectList","label":"Status","lov":[{"label":"Open","value":"O"}]}],"refreshes":[{"items":["P10_STATUS"],"regions":["customers"]}]}},{"op":"set","target":"region:customers","property":"query","value":"select id, name, status from customers where :P10_STATUS is null or status = :P10_STATUS","columns":[{"name":"NAME"},{"name":"STATUS"}]}]
```

## Add a working filter

`{"op":"addFilter", "item":{...}, "region"?:{...}, "targets":[...]}` in `action:edit` adds the filter item (and an optional container region), makes every target query or chart series submit it (`pageItemsToSubmit`) and adds one refresh of all targets. Targets: interactive and classic reports, cards and charts.

- Every target query must reference the item as a bind variable (`:P10_STATUS`). Predicates are never rewritten: give the complete replacement SQL in `sql` (reports also need `columns`, as for a `query` patch) or, for a chart, per series in `series:[{id, sql}]`.
- A query without the bind returns `FILTER_NOT_BOUND`; other regions return `OPERATION_UNSUPPORTED`. Nothing is written.

```text
{"op":"addFilter","region":{"id":"filters","type":"staticContent","name":"Filters"},"item":{"name":"P10_STATUS","region":"filters","type":"selectList","label":"Status","lov":[{"label":"Active","value":"ACTIVE"}]},"targets":[{"region":"customers","sql":"select id, name, status from customers where (:P10_STATUS is null or status = :P10_STATUS)","columns":[{"name":"NAME"},{"name":"STATUS"}]}]}
```

## Add or reorder report columns

- `{"op":"addColumn", "region", "sql", "column":{name, heading?, dataType?, format?}, "after"?|"before"?}` adds one column at its place. `sql` is the complete query and names every column. Existing columns keep their bytes unless a renumbering is needed to make room. An interactive report's default saved report shows the new column at the same place.
- `{"op":"orderColumns", "region", "order":[every column]}` changes the display order (`layout.sequence` and the default report's `displayColumn` order). The SQL is not touched.
- A `query` patch also keeps interactive-report saved reports consistent: dropped columns leave them, new ones are shown at the end. Dropping a column a saved-report sort, filter or highlight still uses returns `COLUMN_REFERENCED`; change that in source first.

## Open an existing modal page

`{"op":"addDialogAction", "target":{page, items?, clearCache?}, "link":{region, column?, linkText?} | "button":{id, label, region}, "refresh"?, "expectedTargetDigest"?}` adds a row link (interactive report: whole row; classic report: one `column`) or a button that opens an existing modal page, plus the dialog-closed refresh of `refresh` (default: the linked region; required for a button). An existing equivalent refresh is reused.

- `items` maps modal page items to `#COLUMN#` (a column of the linked report), `&ITEM.` or a literal; unknown items or columns are refused.
- The target must be a modal dialog page (`TARGET_NOT_MODAL`). Pass its file digest as `expectedTargetDigest` to bind the edit to the modal page you read.
- Authorization is never added: a modal page that runs processes without a page authorization scheme returns a warning. Create a new modal page with scaffold.

## Shared LOVs

`apexrest_project action:lov_context lov:"STATUS"` returns the LOV (id or name), its entries or query, the file `digest` and the pages that use it. `action:lov_edit lov:"STATUS" expectedDigest:"<digest>"` with either:

- `entries:[{display, return}, ...]`: every entry of a static LOV in display order. Entries whose return value is kept keep their id and bytes.
- `query:{sql, display?, return?}`: complete replacement SQL of a local SQL-query LOV.

26.2 keeps one LOV per `shared-components/lovs/*.apx` file and 26.1 all of them in `shared-components/lovs.apx`; other layouts fail before writing. A shared LOV change is shared-component scope (`affectedPages: unknown`), never page-only: ship with `importMode:auto` or `full`.

Bind an existing list item to a shared LOV in `action:edit`: `{"op":"bindLov", "item":"P10_STATUS", "lov":"STATUS", "expectedLovDigest"?, "nullValue"?:{display, return?} | false, "displayExtraValues"?, "cascade"?:{parentItems, itemsToSubmit?, parentRequired?} | null}`. The item's static or query LOV source is replaced by the shared reference; its null and extra-value settings are kept unless given, and nothing else on the item changes. Parents and submitted items must exist on the page. 26.2 sources only.

## Move a component on the page

`{"op":"moveComponent", "component":"item:P10_NAME"|"button:ID"|"region:ID", "to":{region?, slot, sequence?}}` moves an item or button into another region, or a region under another region or (without `region`) to page level. Only its layout region/parent, slot and sequence change. Slots: items `regionBody`, `body`, `contentBody`; buttons `next`, `previous`, `create`, `edit`, `close`, `change`, `delete`, `copy`, `up`, `regionBody`, `belowBox`, `top`, `bottom` (and `rightOfInteractiveReportSearchBar` in an interactive report); sub-regions `subRegions`, `regionBody`, `body`; page-level regions `body`, `breadcrumbBar`, `leftColumn`, `rightSideColumn` (modal pages: `contentBody`, `dialogFooter`). Run `apexrest_preview action:check` afterwards: it checks the region template's own slots. For order only, use a `sequence` patch. Moves to another page are not supported.

## Show or hide report columns

`{"target":"column:orders.AMOUNT","property":"visible","value":"false"}` (or `"true"`) changes whether a column shows by default; context lists `visible` for every column. Interactive reports: the column joins or leaves the default saved report's displayed columns (a shown column takes its place by column order); the column and the query are unchanged, and users can still add it. Classic reports: `type` switches between `plainText` and `hidden`. Refused: an interactive-report column declared `type: hidden`, a report without a default saved report, and hiding a classic link or LOV column. Several visibility, heading, format and sequence changes combine in one patch or edit.

## Templates and grid layout (26.2)

| Property               | Targets          | Value                                                  | `""` resets to        |
| ---------------------- | ---------------- | ------------------------------------------------------ | --------------------- |
| `template`             | `page`, `region` | a Universal Theme template id, such as `content-block` | the theme default     |
| `templateOptions`      | `page`, `region` | `#DEFAULT#` and option CSS classes, space-separated    | the template defaults |
| `column`, `columnSpan` | `region`, `item` | `1`-`12`; column and span must fit 12 columns          | automatic             |
| `startNewRow`          | `region`, `item` | `true` or `false`                                      | `true`                |

Template ids are checked against the installed theme (after `apexrest_preview action:setup`) or the templates Oracle's Universal Theme 26.2 Reference app uses; `interactive-report` and `cards-container` fit only their region types. Template options need the installed theme: each class must belong to the template, at most one per option group. Set `template` and `templateOptions` in the same patch to change both.

## Undo and redo

`apexrest_project action:undo` reverses the last page edit (`patch`, `insert`, `edit` or a preview visual edit; a compound edit is one step) and `action:redo` restores it. Both write only when the page file still has the digest that edit left or expects; otherwise nothing is written (`TRANSFORM_CONFLICT`). A new edit after an undo clears the redo step. The history keeps 50 entries for 14 days in `.apexrest/edit-history.json`. It covers local page source only: it never reverts a deployed application, and scaffold output, shared LOV edits and manual file edits are not in it.
