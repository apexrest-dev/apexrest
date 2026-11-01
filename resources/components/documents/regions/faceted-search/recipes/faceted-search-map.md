# Faceted Search with Map Region

Faceted search with checkbox and numeric range facets filtering a Map region point layer with colored markers and an HTML tooltip; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00009-fs-04-map.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00009-fs-04-map.apx",
  "sourceSha256": "ca75440ddffae9da8dd6177f83ab435801f031444428b0e4efb9878418e49151",
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

- Choose a free page number and rename all P1_ items consistently.
- Location, country and employee tables were replaced by inline DUAL rows with longitude/latitude columns; breadcrumb replaced by an inline title bar.
- Preserve the target application authentication and authorization.
- Replace the synthetic rows with authorized project SQL; keep LONGITUDE, LATITUDE, LOCATION_ID and every facet column.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Faceted Search Map
    alias: HOME
    title: Faceted Search Map
    appearance {
        pageTemplate: @/left-side-column
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region title-bar (
        name: Faceted Search Map
        type: staticContent
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useRegionTitle
            ]
        }
    )
    region fs-filters (
        name: Filter Locations
        type: facetedSearch
        source {
            filteredRegion: @fs-map
        }
        layout {
            sequence: 20
            slot: leftColumn
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
            icon: fa-filter
        }
        accessibility {
            landmarkLabel: Location filters
        }
        settings {
            compactNosThreshold: 10000
            showCurrentFacets: true
        }

        facet P1_F_SEARCH (
            type: search
            label {
                label: Search Locations
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: LOCATION_NAME,CITY,COUNTRY_NAME
            }
        )
        facet P1_F_REGION (
            type: checkboxGroup
            label {
                label: Geographic Region
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 20
            }
            source {
                databaseColumn: GEOGRAPHIC_REGION
            }
            listEntries {
                showSelectedFirst: true
                maxDisplayedEntries: 10
            }
        )
        facet P1_F_COUNTRY (
            type: checkboxGroup
            label {
                label: Country
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 30
            }
            listEntries {
                maxDisplayedEntries: 7
            }
            source {
                databaseColumn: COUNTRY_NAME
            }
        )
        facet P1_F_OFFICE_TYPE (
            type: checkboxGroup
            label {
                label: Office Type
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 40
            }
            source {
                databaseColumn: OFFICE_TYPE
            }
            listEntries {
                zeroCountEntries: disable
                sortByTopCounts: false
                showSelectedFirst: true
                maxDisplayedEntries: 5
            }
        )
        facet P1_F_STATUS (
            type: checkboxGroup
            label {
                label: Location Status
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 50
            }
            source {
                databaseColumn: LOCATION_STATUS
            }
            listEntries {
                showSelectedFirst: true
                maxDisplayedEntries: 5
            }
        )
        facet P1_F_CAPACITY (
            type: range
            label {
                label: Capacity
            }
            lov {
                type: staticValues
                staticValues: STATIC2:<=100;|100,100-500;100|500,500-1#G#000;500|1000,1#G#000 - 2#G#000;1000|2000
            }
            layout {
                sequence: 70
            }
            listEntries {
                maxDisplayedEntries: 7
            }
            source {
                databaseColumn: CAPACITY
                dataType: number
            }
        )
    )
    region fs-map (
        name: Workforce Locations
        type: map
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select l.LOCATION_ID,
                       l.LOCATION_NAME,
                       l.OFFICE_TYPE,
                       initcap(replace(l.OFFICE_TYPE, '_', ' ')) as OFFICE_TYPE_LABEL,
                       l.CITY,
                       l.COUNTRY_NAME,
                       l.GEOGRAPHIC_REGION,
                       l.LOCATION_STATUS,
                       initcap(lower(l.LOCATION_STATUS)) as LOCATION_STATUS_LABEL,
                       l.OPENED_DATE,
                       l.TIMEZONE,
                       case l.OFFICE_TYPE
                         when 'HEADQUARTERS' then '#056AC8'
                         when 'REGIONAL' then '#117733'
                         when 'SATELLITE' then '#C66A00'
                         else '#6B7280'
                       end as MARKER_COLOR,
                       l.CAPACITY,
                       l.LATITUDE,
                       l.LONGITUDE,
                       l.EMPLOYEE_COUNT
                  from (
                      select 1 LOCATION_ID, 'Madrid Hub' LOCATION_NAME, 'HEADQUARTERS' OFFICE_TYPE, 'Madrid' CITY, 'Spain' COUNTRY_NAME, 'Europe' GEOGRAPHIC_REGION, 'OPEN' LOCATION_STATUS, date '2015-02-01' OPENED_DATE, 1800 CAPACITY, 40.4168 LATITUDE, -3.7038 LONGITUDE, 'Europe/Madrid' TIMEZONE, 7 EMPLOYEE_COUNT from dual union all
                      select 2, 'Berlin Studio', 'REGIONAL', 'Berlin', 'Germany', 'Europe', 'OPEN', date '2017-06-15', 650, 52.52, 13.405, 'Europe/Berlin', 14 from dual union all
                      select 3, 'Lagos Office', 'SATELLITE', 'Lagos', 'Nigeria', 'Africa', 'PLANNED', date '2026-09-01', 90, 6.5244, 3.3792, 'Africa/Lagos', 21 from dual union all
                      select 4, 'Tokyo Center', 'REGIONAL', 'Tokyo', 'Japan', 'Asia Pacific', 'OPEN', date '2019-04-01', 720, 35.6762, 139.6503, 'Asia/Tokyo', 28 from dual union all
                      select 5, 'New York Tower', 'HEADQUARTERS', 'New York', 'United States', 'Americas', 'OPEN', date '2012-09-10', 1500, 40.7128, -74.006, 'America/New_York', 35 from dual union all
                      select 6, 'Sao Paulo Desk', 'SATELLITE', 'Sao Paulo', 'Brazil', 'Americas', 'CLOSED', date '2018-03-20', 80, -23.5505, -46.6333, 'America/Sao_Paulo', 42 from dual union all
                      select 7, 'Remote Hub', 'REMOTE', 'Amman', 'Jordan', 'Asia Pacific', 'OPEN', date '2021-01-11', 150, 31.9539, 35.9106, 'Asia/Amman', 49 from dual
                       ) l
                 order by l.LOCATION_NAME
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                js-showMaximizeButton
            ]
            icon: fa-map-marker
        }
        accessibility {
            landmarkLabel: Workforce location map
        }
        map {
            background: builtIn
            height: 640
        }
        controls {
            options: [
                rectangleZoom
                scaleBar
                infiniteMap
                distanceTool
            ]
        }
        legend {
            title: Office Types
        }
        attributes {
            messagesPosition: below
        }

        layer locations-layer (
            name: Locations
            layout {
                sequence: 10
            }
            source {
                location: regionSource
                useSpatialIndex: true
            }
            columnMapping {
                geometryColumnDataType: longitudeLatitude
                longitudeColumn: LONGITUDE
                latitudeColumn: LATITUDE
                primaryKeyColumn: LOCATION_ID
            }
            pointObjects {
                shape: Street View
                shapeScale: 2
            }
            appearance {
                fillColor: &MARKER_COLOR.
            }
            tooltip {
                advancedFormatting: true
                htmlExpression:
                    ```html
                    <strong>&LOCATION_NAME!HTML.</strong><br>
                    &CITY!HTML., &COUNTRY_NAME!HTML.<br>
                    &OFFICE_TYPE_LABEL!HTML. · &LOCATION_STATUS_LABEL!HTML.<br>
                    Employees: &EMPLOYEE_COUNT!HTML.<br>
                    Capacity: &CAPACITY!HTML.
                    ```
            }
            messages {
                whenNoDataFound: No locations match the selected filters. Clear a filter to broaden the map.
                noDataFoundIcon: fa-map-marker
            }
        )
    )
    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 20
            region: @title-bar
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-undo
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
                clearCache: 1
                action: resetRegions
            }
            warnOnUnsavedChanges: doNotCheck
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
    "sourceSha256": "8c4e0f99343179f24aa2069a08f1405069c1b217a0a7c007f3d2a9c1290e035a",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
