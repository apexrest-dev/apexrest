# Map Heat Map Layer

Map region with a heat-map layer weighted by a value column and a sequential color scheme, using synthetic data.

Status: ready.

Component: component:regions/map.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/skills/blob/014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1/apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.heat-map.md",
  "repository": "https://github.com/oracle/skills",
  "commit": "014cdb29f12dfa6a689bbe8a80ee1c5f0bf15be1",
  "path": "apex/apexlang/26.1/apexlang-generation/templates/region-components/map/map.layer.heat-map.md",
  "sourceSha256": "132b483794a75efbe34de900917bce6f29bd0fd15313752251891ac5e737068b",
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
    name: Map Heat Map Layer
    alias: HOME
    title: Map Heat Map Layer
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }
    region incident-density (
        name: Incident Density
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
                infiniteMap
                rectangleZoom
            ]
        }
        initialPositionAndZoom {
            type: staticValues
            longitude: 10
            latitude: 50
            zoomLevel: 4
        }
        attributes {
            messagesPosition: below
        }

        layer incidents (
            name: Incidents
            layerType: heatMap
            layout {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select level ID,
                           2 + mod(level * 37, 200) / 10 LONGITUDE,
                           44 + mod(level * 53, 110) / 10 LATITUDE,
                           mod(level * 7, 10) + 1 WEIGHT
                      from dual
                   connect by level <= 300
                    ```
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LONGITUDE
                latitudeColumn: LATITUDE
                primaryKeyColumn: ID
            }
            appearance {
                valueColumn: WEIGHT
                colorScheme: sequential
                schemeName: sunset
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
    "sourceSha256": "a2261f548a9e57a9b6fabbb3d9c7983defbc30db1d00cf7d9c3faf14e50c293c",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
