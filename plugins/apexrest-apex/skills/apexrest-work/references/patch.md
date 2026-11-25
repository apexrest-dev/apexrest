# Semantic page edits

Use `apexrest_project action:patch` for small property changes on an existing page instead of editing `.apx` text by hand. It replaces only the value bytes of the named property. Comments, ``` literals, Oracle metadata, ids and every other component keep their bytes. A missing property or group is inserted with the file's own indentation and line endings.

| Target              | Properties                      | APEXlang path                                                 |
| ------------------- | ------------------------------- | ------------------------------------------------------------- |
| `page`              | `title`                         | `title`                                                       |
| `region:ID`         | `title`, `sequence`             | `name`, `layout.sequence`                                     |
| `item:NAME`         | `label`, `sequence`             | `label.label`, `layout.sequence`                              |
| `button:ID`         | `label`, `sequence`             | `label`, `layout.sequence`                                    |
| `column:REGION.COL` | `heading`, `format`, `sequence` | `heading.heading`, `appearance.formatMask`, `layout.sequence` |

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
- For a filter: a `staticContent` region, a `selectList` item and a `refreshes` entry for the report. Then add the item to the report query with a `query` patch.

## Several changes in one edit

`apexrest_project action:edit page:"10" expectedDigest:"<digest>" operations:[...]` combines `{"op":"set", target, property, value, columns?}` (the `patch` operations) and `{"op":"insert", components}` (the `insert` fragment) in one transaction. Every operation resolves against the page you read; the result is checked and written once, or not at all. An operation cannot target a component another operation of the same edit inserts: insert it, then edit it with the new digest.

```text
apexrest_project action:edit page:"10" expectedDigest:"<digest>" operations:[{"op":"insert","components":{"regions":[{"id":"filters","type":"staticContent","name":"Filters"}],"items":[{"name":"P10_STATUS","region":"filters","type":"selectList","label":"Status","lov":[{"label":"Open","value":"O"}]}],"refreshes":[{"items":["P10_STATUS"],"regions":["customers"]}]}},{"op":"set","target":"region:customers","property":"query","value":"select id, name, status from customers where :P10_STATUS is null or status = :P10_STATUS","columns":[{"name":"NAME"},{"name":"STATUS"}]}]
```
