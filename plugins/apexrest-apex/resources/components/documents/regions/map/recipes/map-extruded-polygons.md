# Map Extruded Polygons

Map region with a 3D extruded-polygons layer whose height and color come from value columns, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.extruded-polygons.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.extruded-polygons.md",
  "sourceSha256": "99771c65a83398534f5e69a10c554d0a7d34197e05364894334ae72f093d40a2",
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
    name: Map Extruded Polygons
    alias: HOME
    title: Map Extruded Polygons
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region warehouse-capacity (
        name: Warehouse Capacity
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

        layer capacity-zones (
            name: Capacity Zones
            layerType: extrudedPolygons
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select ID, ZONE_NAME, CAPACITY, CAPACITY * 2 POLYGON_HEIGHT, GEOJSON
                      from (
                        select 1 ID, 'Zone A' ZONE_NAME, 40 CAPACITY,
                               '{"type":"Polygon","coordinates":[[[0,44],[6,44],[6,50],[0,50],[0,44]]]}' GEOJSON
                          from dual union all
                        select 2, 'Zone B', 90,
                               '{"type":"Polygon","coordinates":[[[7,46],[13,46],[13,52],[7,52],[7,46]]]}'
                          from dual union all
                        select 3, 'Zone C', 65,
                               '{"type":"Polygon","coordinates":[[[14,44],[20,44],[20,50],[14,50],[14,44]]]}'
                          from dual
                      )
                    ```
            }
            columnMapping {
                geometryColumnDataType: geojson
                geojsonColumn: GEOJSON
                primaryKeyColumn: ID
            }
            appearance {
                useColorScheme: true
                colorScheme: diverging
                schemeName: temps
                colorValueColumn: CAPACITY
                extrusionValueColumn: POLYGON_HEIGHT
                unit: kilometer
                fillOpacity: .7
            }
            tooltip {
                advancedFormatting: true
                htmlExpression: &ZONE_NAME.: &CAPACITY. units
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
    "sourceSha256": "d9265b64d7f0b34e71a85946a3c79e6a60088a476b72536d4b79759867bf5680",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
