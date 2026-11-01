# Map Points from Longitude and Latitude

Map region with a point layer mapped from separate longitude and latitude columns, colored pins, tooltip and info window, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.longitude-latitude.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.longitude-latitude.md",
  "sourceSha256": "69ff8415324296141448b38e128828ead3bcce3f90ccb0e57f22c2ce409ca3d8",
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
    name: Map Points from Longitude and Latitude
    alias: HOME
    title: Map Points from Longitude and Latitude
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region store-map (
        name: Store Locations
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
                rectangleZoom
                scaleBar
            ]
        }
        initialPositionAndZoom {
            type: staticValues
            longitude: 10
            latitude: 50
            zoomLevel: 3
        }
        attributes {
            messagesPosition: below
        }

        layer stores (
            name: Stores
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select 1 ID, 'Berlin Store' STORE_NAME, 'DE' COUNTRY_CODE, 13.40 LONGITUDE, 52.52 LATITUDE, '#056AC8' PIN_COLOR from dual union all
                    select 2, 'Paris Store', 'FR', 2.35, 48.86, '#117733' from dual union all
                    select 3, 'Madrid Store', 'ES', -3.70, 40.42, '#C66A00' from dual union all
                    select 4, 'Rome Store', 'IT', 12.50, 41.90, '#6B7280' from dual union all
                    select 5, 'Warsaw Store', 'PL', 21.01, 52.23, '#056AC8' from dual
                    ```
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LONGITUDE
                latitudeColumn: LATITUDE
                primaryKeyColumn: ID
            }
            appearance {
                fillColor: &PIN_COLOR.
            }
            tooltip {
                column: STORE_NAME
            }
            infoWindow {
                advancedFormatting: true
                htmlExpression:
                    ```html
                    <strong>&STORE_NAME.</strong><br>Country: &COUNTRY_CODE.
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
    "sourceSha256": "820f98d0e03530052b61bf68aa0e91a0de6d9e66dada315bcaa9705ba3fbfabc",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
