# Map Icon Points from GeoJSON

Map region with a points layer read from a GeoJSON column and Font APEX icon markers taken from a column, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.geojson.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.geojson.md",
  "sourceSha256": "a6a062a57dbf35e83ea7c5ed0ff7130098607659eee011f26f5d9cb6b8df5847",
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
    name: Map Icon Points from GeoJSON
    alias: HOME
    title: Map Icon Points from GeoJSON
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region office-map (
        name: Offices
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

        layer offices (
            name: Offices
            layerType: points
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'Headquarters' OFFICE_NAME, 'fa-building' MARKER_ICON,
                           '{"type":"Point","coordinates":[13.40,52.52]}' GEOJSON
                      from dual union all
                    select 2, 'Regional Office', 'fa-building-o',
                           '{"type":"Point","coordinates":[2.35,48.86]}'
                      from dual union all
                    select 3, 'Satellite Office', 'fa-map-marker',
                           '{"type":"Point","coordinates":[12.50,41.90]}'
                      from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: geojson
                geojsonColumn: GEOJSON
                primaryKeyColumn: ID
            }
            pointObjects {
                style: icon
                iconSource: iconClassColumn
                iconColumn: MARKER_ICON
            }
            appearance {
                fillColor: #056AC8
            }
            tooltip {
                column: OFFICE_NAME
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
    "sourceSha256": "d4ade01710c51b44d7cee0d79747a9912947a7626670018bcc69ac7009205cfd",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
