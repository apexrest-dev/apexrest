# Map Polygons with Color Scheme

Map region with a GeoJSON polygons layer colored by a numeric value through a sequential color scheme, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.polygons.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.polygons.md",
  "sourceSha256": "841e7a88a4438a4fdecc41f3c248b5f65cb2c74429ca6e49182b1ee14b197742",
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
    name: Map Polygons with Color Scheme
    alias: HOME
    title: Map Polygons with Color Scheme
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region sales-territories (
        name: Sales Territories
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
            longitude: 10
            latitude: 48
            zoomLevel: 4
        }
        attributes {
            messagesPosition: below
        }

        layer territories (
            name: Territories
            layerType: polygons
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'West' TERRITORY, 120 REVENUE,
                           '{"type":"Polygon","coordinates":[[[-5,40],[3,40],[3,48],[-5,48],[-5,40]]]}' GEOJSON
                      from dual union all
                    select 2, 'Central', 340,
                           '{"type":"Polygon","coordinates":[[[3,45],[12,45],[12,54],[3,54],[3,45]]]}'
                      from dual union all
                    select 3, 'South', 210,
                           '{"type":"Polygon","coordinates":[[[7,37],[18,37],[18,45],[7,45],[7,37]]]}'
                      from dual union all
                    select 4, 'East', 90,
                           '{"type":"Polygon","coordinates":[[[12,46],[24,46],[24,54],[12,54],[12,46]]]}'
                      from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: geojson
                geojsonColumn: GEOJSON
                primaryKeyColumn: ID
            }
            appearance {
                useColorScheme: true
                colorScheme: sequential
                schemeName: blueToYellow
                colorValueColumn: REVENUE
                fillOpacity: .6
                strokeColor: #ffffff
            }
            tooltip {
                column: TERRITORY
            }
            infoWindow {
                advancedFormatting: true
                htmlExpression:
                    ```html
                    <strong>&TERRITORY.</strong><br>Revenue: &REVENUE.k
                    ```
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
    "sourceSha256": "5dd309476e46143a547342baf546f2ed5439ed5b7d6c0fd2b896775d419d26b0",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
