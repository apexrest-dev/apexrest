# Map Multiple Layers with Legend

Map region combining polygons, lines and points layers with a region legend and per-layer legend entries, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-maps/apexlang/sample-maps/pages/p00115-us-states-and-large-airports.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-maps/apexlang/sample-maps/pages/p00115-us-states-and-large-airports.apx",
  "sourceSha256": "27331a763ded026e924657bfc5025676239589a3b69f7c8401679b434e2bea77",
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
    name: Map Multiple Layers with Legend
    alias: HOME
    title: Map Multiple Layers with Legend
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region logistics-map (
        name: Logistics Network
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
            height: 520
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
        legend {
            show: true
            position: end
            title: Layers
        }

        layer regions (
            name: Service Regions
            layerType: polygons
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'West Region' REGION_NAME,
                           '{"type":"Polygon","coordinates":[[[-5,40],[5,40],[5,50],[-5,50],[-5,40]]]}' GEOJSON
                      from dual union all
                    select 2, 'East Region',
                           '{"type":"Polygon","coordinates":[[[5,44],[17,44],[17,54],[5,54],[5,44]]]}'
                      from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: geojson
                geojsonColumn: GEOJSON
                primaryKeyColumn: ID
            }
            appearance {
                fillColor: #808080
                fillOpacity: .3
                strokeColor: #101010
            }
            tooltip {
                column: REGION_NAME
            }
            legend {
                show: true
            }
        )

        layer routes (
            name: Trunk Routes
            layerType: lines
            layout {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'Paris - Berlin' ROUTE_NAME,
                           '{"type":"LineString","coordinates":[[2.35,48.86],[13.40,52.52]]}' GEOJSON
                      from dual union all
                    select 2, 'Berlin - Rome',
                           '{"type":"LineString","coordinates":[[13.40,52.52],[12.50,41.90]]}'
                      from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: geojson
                geojsonColumn: GEOJSON
                primaryKeyColumn: ID
            }
            appearance {
                strokeColor: #C66A00
                strokeWidth: 3
            }
            tooltip {
                column: ROUTE_NAME
            }
            legend {
                show: true
            }
        )

        layer hubs (
            name: Hubs
            layerType: points
            layout {
                sequence: 30
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'Paris Hub' HUB_NAME, 2.35 LONGITUDE, 48.86 LATITUDE from dual union all
                    select 2, 'Berlin Hub', 13.40, 52.52 from dual union all
                    select 3, 'Rome Hub', 12.50, 41.90 from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LONGITUDE
                latitudeColumn: LATITUDE
                primaryKeyColumn: ID
            }
            appearance {
                fillColor: #056AC8
                strokeColor: #ffffff
            }
            tooltip {
                column: HUB_NAME
            }
            legend {
                show: true
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
    "sourceSha256": "e7c192c2bdd954215346d0a479e79f4e4c2674fef19cdae174e20b8102046308",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
