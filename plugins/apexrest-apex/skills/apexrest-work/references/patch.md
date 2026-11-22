# Semantic page edits

Use `apexrest_project action:patch` for small property changes on an existing page instead of editing `.apx` text by hand. It replaces only the value bytes of the named property. Comments, ``` literals, Oracle metadata, ids and every other component keep their bytes. A missing property or group is inserted with the file's own indentation and line endings.

| Target              | Properties                      | APEXlang path                                                 |
| ------------------- | ------------------------------- | ------------------------------------------------------------- |
| `page`              | `title`                         | `title`                                                       |
| `region:ID`         | `title`, `sequence`             | `name`, `layout.sequence`                                     |
| `item:NAME`         | `label`, `sequence`             | `label.label`, `layout.sequence`                              |
| `button:ID`         | `label`, `sequence`             | `label`, `layout.sequence`                                    |
| `column:REGION.COL` | `heading`, `format`, `sequence` | `heading.heading`, `appearance.formatMask`, `layout.sequence` |

1. Call it with `page`, `operations` and `dryRun:true`, or without `expectedDigest`. The answer gives the current page-file digest (`currentDigest`) and changes nothing.
2. Call it again with `expectedDigest`. The digest is checked again under the project edit lock, right before the atomic replace. A changed file returns `TRANSFORM_CONFLICT`: read it again.
3. A source edit is not a compiler or import result. Ship as usual.

```text
apexrest_project action:patch project:/abs/project page:"10" expectedDigest:"<currentDigest>" operations:[{"target":"column:customers.EMAIL","property":"heading","value":"E-mail address"},{"target":"item:P10_SEARCH","property":"label","value":"Search"}]
```

Unknown targets, ambiguous ids, unsupported properties, multi-line values and constructs the scanner does not support fail before anything is written. Edit those in source.
