# Documentation graphics

The owner-supplied APEXREST pencil-and-ruler symbol comes from `APEXREST-logo/apex rgb.svg`. The original file remains unchanged in the owner's folder. Display copies contain only the symbol, with the lettering paths removed and no background shape. Original symbol geometry and colors are preserved; a square viewBox trims empty artboard margins and an accessible title identifies the image.

[apexrest-logo.svg](apexrest-logo.svg) is shared by the README, the documentation index and every site header. The [plugin logo](../../plugins/apexrest-apex/assets/apexrest-logo.svg) and [composer icon](../../plugins/apexrest-apex/assets/apexrest-icon.svg) are byte-identical to it. Plugin metadata references the transparent SVGs through `interface.composerIcon`, `interface.logo` and `interface.logoDark`. The site and native builds include their respective assets. Logo-specific site styling preserves transparency without a background or border.

The SVG diagrams below are maintained directly in this repository in English only. They use native vector shapes and system fonts, with no scripts, external resources or embedded HTML. Each graphic has an accessible title and description, and a `viewBox` for proportional resizing.

| Asset                                      | Purpose                                                            | Text reference                               |
| ------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- |
| [overview.svg](overview.svg)               | Codex skills, shared MCP/CLI runtime, SQLcl and Oracle APEX        | [Architecture](../architecture.md)           |
| [deployment-flow.svg](deployment-flow.svg) | Delivery steps, coordination defaults and authorization boundaries | [Deployment safety](../deployment-safety.md) |

### Explainer video

| Asset                                                                        | Purpose                                                                                     | Text reference                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| [apexrest-2-scoped-updates.mp4](apexrest-2-scoped-updates.mp4)               | 90-second English explainer of scoped APEXlang updates (H.264/AAC, 1080×1350, 30 fps, captions burned in) | [README](../../README.md), [APEX 26.2](../apex-26.2.md) |
| [apexrest-2-scoped-updates-poster.png](apexrest-2-scoped-updates-poster.png) | Cover frame used as the README thumbnail                                                    | [README](../../README.md)           |
| [apexrest-2-scoped-updates.srt](apexrest-2-scoped-updates.srt)               | Caption file matching the spoken narration                                                  | —                                   |

Provenance: rendered on October 7, 2026 from an original, deterministic HTML Canvas motion-graphics project (source commit `23ccdc8`). All diagrams, page wireframes and the sales chart are original illustrations with synthetic data; the only reused asset is the APEXREST symbol above. Narration is a synthetic voice (Kokoro-82M, Apache-2.0, voice `am_michael`), not a recording or clone of a real person; no music, stock footage or third-party logos are used. The locked narration text and the claims it makes were checked against `README.md`, `docs/apex-26.2.md` and `docs/deployment-safety.md` at that commit. The end card shows `npm install -g apexrest`; the registry package and the repository source bundle are separate distribution paths (see the README version note). The website build copies only image assets, so the video is served from the repository, not from GitHub Pages.

Use meaningful alternative text when embedding these images in Markdown. Keep the linked text documentation available so the graphics are never the only source of operational instructions.
