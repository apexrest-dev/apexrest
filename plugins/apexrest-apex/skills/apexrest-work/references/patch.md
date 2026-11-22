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
3. A source edit is not a compiler or import result. Ship as usual.

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
