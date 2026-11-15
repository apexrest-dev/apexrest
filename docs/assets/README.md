# Documentation graphics

The owner-supplied APEXREST pencil-and-ruler symbol comes from `APEXREST-logo/apex rgb.svg`. The original file remains unchanged in the owner's folder. Display copies contain only the symbol, with the lettering paths removed and no background shape. Original symbol geometry and colors are preserved; a square viewBox trims empty artboard margins and an accessible title identifies the image.

[apexrest-logo.svg](apexrest-logo.svg) is shared by the README, the documentation index and every site header. The [plugin logo](../../plugins/apexrest-apex/assets/apexrest-logo.svg) and [composer icon](../../plugins/apexrest-apex/assets/apexrest-icon.svg) are byte-identical to it. Plugin metadata references the transparent SVGs through `interface.composerIcon`, `interface.logo` and `interface.logoDark`. The site and native builds include their respective assets. Logo-specific site styling preserves transparency without a background or border.

The SVG diagrams below are maintained directly in this repository in English only. They use native vector shapes and system fonts, with no scripts, external resources or embedded HTML. Each graphic has an accessible title and description, and a `viewBox` for proportional resizing.

| Asset                                      | Purpose                                                            | Text reference                               |
| ------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- |
| [overview.svg](overview.svg)               | Codex skills, shared MCP/CLI runtime, SQLcl and Oracle APEX        | [Architecture](../architecture.md)           |
| [deployment-flow.svg](deployment-flow.svg) | Delivery steps, coordination defaults and authorization boundaries | [Deployment safety](../deployment-safety.md) |

Use meaningful alternative text when embedding these images in Markdown. Keep the linked text documentation available so the graphics are never the only source of operational instructions.
