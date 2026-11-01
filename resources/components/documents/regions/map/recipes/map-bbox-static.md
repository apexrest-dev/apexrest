# Map Static Bounding Box

Map region restricted by a static bounding box that writes the current bounds into a hidden page item, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.region.bbox-static.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.region.bbox-static.md",
  "sourceSha256": "267d3aa1e36d460a5882fd7330439d3ca352e9dd70a584de607b0a5a4d3dd77b",
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
  "submittedItems": [
    "P1_MAP_BOUNDS"
  ]
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
    name: Map Static Bounding Box
    alias: HOME
    title: Map Static Bounding Box
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region bounded-map (
        name: Bounded Map
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
            type: basedOnSpatialResults
        }
        boundingBox {
            type: staticValues
            minLongitude: -10
            minLatitude: 35
            maxLongitude: 30
            maxLatitude: 60
            currentBoundsItem: P1_MAP_BOUNDS
        }
        attributes {
            messagesPosition: below
        }

        layer cities (
            name: Cities
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'Berlin' CITY, 13.40 LONGITUDE, 52.52 LATITUDE from dual union all
                    select 2, 'Paris', 2.35, 48.86 from dual union all
                    select 3, 'Rome', 12.50, 41.90 from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LONGITUDE
                latitudeColumn: LATITUDE
                primaryKeyColumn: ID
            }
            tooltip {
                column: CITY
            }
        )
    )

    pageItem P1_MAP_BOUNDS (
        type: hidden
        layout {
            sequence: 10
            region: @bounded-map
            slot: regionBody
        }
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "3e220357d751c92c8e72973335a4882ac7fe14ec041dfe4fea63c0f268fc47d4",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
