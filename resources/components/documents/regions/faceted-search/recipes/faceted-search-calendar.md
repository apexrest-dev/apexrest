# Faceted Search with Calendar Region

Faceted search with checkbox and radio-group facets filtering a read-only month Calendar with CSS-class colored events and iCal export; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00010-fs-05-calendar.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00010-fs-05-calendar.apx",
  "sourceSha256": "0badd30023bebef587f83a241e9a81f62541fdcf06001edbae78491d750258ee",
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
- The event view was replaced by DUAL rows relative to the current month; the event detail link to another page was removed.
- Preserve the target application authentication and authorization.
- Replace the synthetic rows with authorized project SQL; keep EVENT_ID, EVENT_START, EVENT_END, EVENT_CLASS and facet columns.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Faceted Search Calendar
    alias: HOME
    title: Faceted Search Calendar
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
        name: Faceted Search Calendar
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
    region fs-calendar (
        name: Workforce Events Calendar
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select e.EVENT_ID,
                       e.EVENT_TITLE,
                       e.EVENT_TITLE || ' (' || initcap(replace(e.EVENT_STATUS, '_', ' ')) || ')' as EVENT_DISPLAY,
                       e.EVENT_START,
                       e.EVENT_END,
                       e.EVENT_TYPE,
                       e.EVENT_STATUS,
                       e.EVENT_SCOPE,
                       e.DELIVERY_MODE,
                       e.DURATION_HOURS,
                       e.EVENT_TITLE || ' for ' || e.EMPLOYEE_NAME as DESCRIPTION,
                       e.EMPLOYEE_NAME,
                       e.GEOGRAPHIC_REGION,
                       e.COST_CENTER,
                       case e.EVENT_TYPE
                       when 'PERFORMANCE_REVIEW' then 'u-color-20-bg u-color-35-text u-color-20-border'
                       when 'TRAINING' then 'u-color-24-bg u-color-39-text u-color-24-border'
                       when 'CERTIFICATION' then 'u-color-23-bg u-color-38-text u-color-23-border'
                       else 'u-color-18-bg u-color-33-text u-color-18-border'
                       end as EVENT_CLASS
                  from (
                      select 1 EVENT_ID, 'Annual review: Ava Moreno' EVENT_TITLE, trunc(sysdate, 'MM') + 0 + 9/24 EVENT_START, trunc(sysdate, 'MM') + 0 + 9/24 + 2/24 EVENT_END, 'PERFORMANCE_REVIEW' EVENT_TYPE, 'SCHEDULED' EVENT_STATUS, 'TEAM' EVENT_SCOPE, 'IN_PERSON' DELIVERY_MODE, 2 DURATION_HOURS, 'Ava Moreno' EMPLOYEE_NAME, 'Europe' GEOGRAPHIC_REGION, 'Platform' COST_CENTER from dual union all
                      select 2, 'Cloud fundamentals training', trunc(sysdate, 'MM') + 2 + 13/24, trunc(sysdate, 'MM') + 2 + 13/24 + 4/24, 'TRAINING', 'SCHEDULED', 'DEPARTMENT', 'VIRTUAL', 4, 'Noah Schmidt', 'Europe', 'Platform' from dual union all
                      select 3, 'Security certification exam', trunc(sysdate, 'MM') + 5 + 10/24, trunc(sysdate, 'MM') + 5 + 10/24 + 3/24, 'CERTIFICATION', 'CONFIRMED', 'INDIVIDUAL', 'IN_PERSON', 3, 'Iris Novak', 'Americas', 'Field Sales' from dual union all
                      select 4, 'Quarterly all hands', trunc(sysdate, 'MM') + 8 + 16/24, trunc(sysdate, 'MM') + 8 + 16/24 + 1/24, 'TOWN_HALL', 'CONFIRMED', 'COMPANY', 'HYBRID', 1, 'Liam Okafor', 'Africa', 'Growth' from dual union all
                      select 5, 'Support onboarding', trunc(sysdate, 'MM') + 12 + 9/24, trunc(sysdate, 'MM') + 12 + 9/24 + 6/24, 'TRAINING', 'CANCELLED', 'TEAM', 'VIRTUAL', 6, 'Omar Haddad', 'Asia Pacific', 'Service Desk' from dual union all
                      select 6, 'Mid-year review: Mia Tanaka', trunc(sysdate, 'MM') + 15 + 11/24, trunc(sysdate, 'MM') + 15 + 11/24 + 1/24, 'PERFORMANCE_REVIEW', 'SCHEDULED', 'INDIVIDUAL', 'HYBRID', 1, 'Mia Tanaka', 'Asia Pacific', 'Growth' from dual
                       ) e
                 order by e.EVENT_START, e.EVENT_ID
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: fs-calendar
        }
        readOnly {
            type: always
        }
        settings {
            displayColumn: EVENT_DISPLAY
            startDateColumn: EVENT_START
            endDateColumn: EVENT_END
            pkColumn: EVENT_ID
            showTime: true
            showTooltip: false
            calendarViewsAndNavigation: [
                month
                navigation
            ]
            maxEventsDay: 3
            cssClass: EVENT_CLASS
            export: ical
        }
        performance {
            lazyLoading: true
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function (pOptions) {
                    pOptions.contentHeight = "auto";
                    return pOptions;
                }
                ```
        }
    )
    region fs-filters (
        name: Filter Workforce Events
        type: facetedSearch
        source {
            filteredRegion: @fs-calendar
        }
        layout {
            sequence: 20
            slot: leftColumn
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
            icon: fa-filter
        }
        settings {
            compactNosThreshold: 10000
            showCurrentFacets: true
        }

        facet P1_F_SEARCH (
            type: search
            label {
                label: Search Workforce Events
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: EVENT_TITLE,EMPLOYEE_NAME,DESCRIPTION
            }
        )
        facet P1_F_TYPE (
            type: checkboxGroup
            label {
                label: Event Type
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 20
            }
            source {
                databaseColumn: EVENT_TYPE
            }
            listEntries {
                showSelectedFirst: true
                maxDisplayedEntries: 5
            }
        )
        facet P1_F_COST_CENTER (
            type: checkboxGroup
            label {
                label: Cost Center
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
                databaseColumn: COST_CENTER
            }
        )
        facet P1_F_STATUS (
            type: radioGroup
            label {
                label: Event Status
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 40
            }
            source {
                databaseColumn: EVENT_STATUS
            }
            listEntries {
                showSelectedFirst: true
                maxDisplayedEntries: 5
            }
        )
        facet P1_F_SCOPE (
            type: checkboxGroup
            label {
                label: Event Scope
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 50
            }
            listEntries {
                maxDisplayedEntries: 7
            }
            source {
                databaseColumn: EVENT_SCOPE
            }
        )
        facet P1_F_DELIVERY_MODE (
            type: radioGroup
            label {
                label: Delivery Mode
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 60
            }
            source {
                databaseColumn: DELIVERY_MODE
            }
            listEntries {
                showSelectedFirst: true
                maxDisplayedEntries: 5
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
                sequence: 90
            }
            source {
                databaseColumn: GEOGRAPHIC_REGION
            }
            listEntries {
                showSelectedFirst: true
                maxDisplayedEntries: 10
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
    "sourceSha256": "38fa97d7de1bceba75ae7d8365047792c55a54cda062230bf9694c91b390634d",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
