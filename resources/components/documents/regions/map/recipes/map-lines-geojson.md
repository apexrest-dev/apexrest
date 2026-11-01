# Map Lines Layer from GeoJSON

Map region with a lines layer built from GeoJSON LineString strings, stroke styling and tooltips, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.lines.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.lines.md",
  "sourceSha256": "0f4373017b1f3f06f0b392d13a2abd5a25523ef74bfafc0d0e07d954475d601a",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "synthetic-dual",
  "tables": [],
  "bindings": [],
  "submittedItems": []
}
```

## Adaptation

- Choose a free page number and rename all P1_ items and region static IDs consistently.
- Preserve the target application authentication and authorization.
- Replace synthetic dual data only with authorized project SQL and keep the column mapping aliases.
- Check the map background and initial position for the target geography.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Map Lines Layer from GeoJSON
    alias: HOME
    title: Map Lines Layer from GeoJSON
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region routes-map (
        name: Delivery Routes
        type: map
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
        }
        map {
            background: builtIn
            height: 480
        }
        controls {
            options: [
                scaleBar
                rectangleZoom
            ]
        }
        initialPositionAndZoom {
            type: staticValues
            longitude: 8
            latitude: 48
            zoomLevel: 4
        }
        attributes {
            messagesPosition: below
        }

        layer routes (
            name: Routes
            layerType: lines
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'North Route' ROUTE_NAME, 1050 DISTANCE_KM,
                           '{"type":"LineString","coordinates":[[2.35,48.86],[4.35,50.85],[13.40,52.52]]}' GEOJSON
                      from dual union all
                    select 2, 'South Route', 1420,
                           '{"type":"LineString","coordinates":[[-3.70,40.42],[2.17,41.39],[7.27,43.70],[12.50,41.90]]}'
                      from dual union all
                    select 3, 'Alpine Route', 690,
                           '{"type":"LineString","coordinates":[[8.54,47.37],[11.58,48.14],[16.37,48.21]]}'
                      from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: geojson
                geojsonColumn: GEOJSON
                primaryKeyColumn: ID
            }
            appearance {
                strokeColor: #056AC8
                strokeWidth: 4
            }
            tooltip {
                advancedFormatting: true
                htmlExpression: &ROUTE_NAME. (&DISTANCE_KM. km)
            }
        )
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "26c13fdf9dd91bc403536c2c3145bfd1c3c8fba69dc9eb58bfc9ab3cbe40a915",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
