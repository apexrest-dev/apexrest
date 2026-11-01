# Faceted Search with Timeline

Faceted search with a SQL-generated month range facet filtering a Timeline template component with badges, a user-name filter link and an Order By selector; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00012-fs-06-timeline.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00012-fs-06-timeline.apx",
  "sourceSha256": "227453e095d24b1abad44cbc0f339b8f9788dc9f26e74be28f65463bcf7fa4bf",
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
- The task table was replaced by DUAL rows relative to today; breadcrumb replaced by an inline title bar and the title link uses mailto.
- Preserve the target application authentication and authorization.
- Replace the synthetic rows with authorized project SQL; keep START_DATE (month facet), STATUS, ASSIGNED_TO_NAME and ORDER BY keys.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Faceted Search Timeline
    alias: HOME
    title: Faceted Search Timeline
    appearance {
        pageTemplate: @/left-side-column
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region title-bar (
        name: Faceted Search Timeline
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
    region activity-timeline (
        name: Activity Timeline
        type: themeTemplateComponent/timeline
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select t.ID,
                       t.TASK_NAME,
                       t.ASSIGNED_TO_EMPNO,
                       t.ASSIGNED_TO_NAME,
                       t.ASSIGNED_TO_EMAIL,
                       t.HOURS_ALLOCATED,
                       initcap(t.WORK_MODE) WORK_MODE,
                       t.START_DATE,
                       t.END_DATE,
                       t.STATUS,
                       case
                           when upper(trim(t.STATUS)) in ('OPEN', 'OVERDUE', 'BLOCKED') then 'danger'
                           when upper(trim(t.STATUS)) in ('ACTIVE', 'CLOSED', 'COMPLETED', 'IN-PROGRESS', 'IN PROGRESS') then 'success'
                           else 'warning'
                       end as BADGE_STATE
                  from (
                      select 1 ID, 'Plan migration' TASK_NAME, 101 ASSIGNED_TO_EMPNO, 'Ava Moreno' ASSIGNED_TO_NAME, 'ava.moreno@example.com' ASSIGNED_TO_EMAIL, 16 HOURS_ALLOCATED, 'HYBRID' WORK_MODE, trunc(sysdate) + -40 START_DATE, trunc(sysdate) + -30 END_DATE, 'COMPLETED' STATUS from dual union all
                      select 2, 'Design review', 102, 'Mia Tanaka', 'mia.tanaka@example.com', 8, 'ONSITE', trunc(sysdate) + -20, trunc(sysdate) + -17, 'IN PROGRESS' from dual union all
                      select 3, 'Customer workshop', 103, 'Iris Novak', 'iris.novak@example.com', 12, 'ONSITE', trunc(sysdate) + -5, trunc(sysdate) + -3, 'OPEN' from dual union all
                      select 4, 'Pipeline hardening', 104, 'Noah Schmidt', 'noah.schmidt@example.com', 24, 'REMOTE', trunc(sysdate) + 3, trunc(sysdate) + 17, 'BLOCKED' from dual union all
                      select 5, 'Knowledge base refresh', 105, 'Omar Haddad', 'omar.haddad@example.com', 10, 'HYBRID', trunc(sysdate) + 20, trunc(sysdate) + 27, 'OPEN' from dual union all
                      select 6, 'Quarterly planning', 106, 'Liam Okafor', 'liam.okafor@example.com', 6, 'REMOTE', trunc(sysdate) + 45, trunc(sysdate) + 46, 'ACTIVE' from dual
                       ) t
                ```
        }
        orderBy {
            type: item
            item: {
                itemName: P1_ORDER_BY
                orderBys: {
                    START_DATE: START_DATE ASC
                    START_DATE_DESC: START_DATE DESC
                    ID: ID ASC
                }
            }
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h1
                t-ContentBlock--lightBG
                t-Region--removeHeader js-removeLandmark
            ]
        }
        advanced {
            htmlDomId: activity-timeline
        }
        componentAppearance {
            display: report
        }
        settings {
            userName: ASSIGNED_TO_NAME
            date: START_DATE
            title: TASK_NAME
            description: WORK_MODE
            displayAvatar: true
            displayBadge: true
            style: compact
            applyThemeColors: false
        }
        plugin-avatar {
            icon: fa-calendar-month fa-2x
            shape: noShape
        }
        plugin-badge {
            label: Status
            value: STATUS
            state: BADGE_STATE
            style: subtle
            shape: rounded
        }

        column ID (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: ID
                dataType: number
                primaryKey: true
            }
        )
        column TASK_NAME (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: TASK_NAME
                dataType: varchar2
                availableOnClient: true
            }
        )
        column START_DATE (
            layout {
                sequence: 30
            }
            source {
                databaseColumn: START_DATE
                dataType: date
                availableOnClient: true
            }
            appearance {
                formatMask: DD-MON-YYYY
            }
        )
        column ASSIGNED_TO_NAME (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: ASSIGNED_TO_NAME
                dataType: varchar2
                availableOnClient: true
            }
        )
        column STATUS (
            layout {
                sequence: 50
            }
            source {
                databaseColumn: STATUS
                dataType: varchar2
                availableOnClient: true
            }
        )
        column ASSIGNED_TO_EMPNO (
            layout {
                sequence: 60
            }
            source {
                databaseColumn: ASSIGNED_TO_EMPNO
                dataType: number
            }
        )
        column ASSIGNED_TO_EMAIL (
            layout {
                sequence: 70
            }
            source {
                databaseColumn: ASSIGNED_TO_EMAIL
                dataType: varchar2
            }
        )
        column HOURS_ALLOCATED (
            layout {
                sequence: 80
            }
            source {
                databaseColumn: HOURS_ALLOCATED
                dataType: number
            }
        )
        column WORK_MODE (
            layout {
                sequence: 90
            }
            source {
                databaseColumn: WORK_MODE
                dataType: varchar2
            }
        )
        column END_DATE (
            layout {
                sequence: 100
            }
            source {
                databaseColumn: END_DATE
                dataType: date
            }
        )
        column BADGE_STATE (
            layout {
                sequence: 110
            }
            source {
                databaseColumn: BADGE_STATE
                dataType: varchar2
            }
        )

        action assignee-name (
            position: userNameLink
            layout {
                sequence: 20
            }
            behavior {
                target: {
                    page: 1
                    items: {
                        P1_ASSIGNEE: &ASSIGNED_TO_NAME.
                    }
                }
                linkAttributes: title="Filter by this assignee"
            }
            serverSideCondition {
                type: itemIsNotNull
                item: ASSIGNED_TO_NAME
            }
        )

        action task-title (
            position: titleLink
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: mailto:&ASSIGNED_TO_EMAIL.
            }
        )
    )
    region button-bar (
        name: Button Bar
        type: staticContent
        source {
            htmlCode: <div id="active_facets"></div>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noPadding
                t-ButtonRegion--noUI
            ]
        }
    )
    region search (
        name: Filter activities
        type: facetedSearch
        source {
            filteredRegion: @activity-timeline
        }
        layout {
            sequence: 10
            slot: leftColumn
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            compactNosThreshold: 10000
            showCurrentFacets: true
        }

        facet P1_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
            appearance {
                valuePlaceholder: Search...
            }
        )
        facet P1_TASK_MONTH (
            type: range
            label {
                label: Month
            }
            settings {
                selectMultiple: true
            }
            lov {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select to_char(month_start, 'FMMonth YYYY', 'NLS_DATE_LANGUAGE=English') as display_value,
                           to_char(month_start, 'YYYYMMDDHH24MISS') || '|' ||
                           to_char(add_months(month_start, 1), 'YYYYMMDDHH24MISS') as return_value
                      from (
                            select add_months(trunc(sysdate, 'MM'), level - 13) as month_start
                              from dual
                           connect by level <= 25
                           )
                     order by month_start
                    ```
            }
            layout {
                sequence: 20
            }
            listEntries {
                maxDisplayedEntries: 5
                allowToExclude: false
            }
            source {
                databaseColumn: START_DATE
                dataType: date
            }
        )
        facet P1_STATUS (
            type: checkboxGroup
            label {
                label: Status
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 30
            }
            listEntries {
                maxDisplayedEntries: 6
                allowToExclude: false
            }
            source {
                databaseColumn: STATUS
            }
        )
        facet P1_ASSIGNEE (
            type: checkboxGroup
            label {
                label: Assigned To
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 40
            }
            listEntries {
                maxDisplayedEntries: 5
                allowToExclude: false
            }
            source {
                databaseColumn: ASSIGNED_TO_NAME
            }
        )
    )
    pageItem P1_ORDER_BY (
        type: selectList
        label {
            label: Order By
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Start Date ascending;START_DATE,Start Date descending;START_DATE_DESC
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 20
            region: @button-bar
            slot: next
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            icon: fa-sort
            height: 1
        }
        validation {
            valueRequired: true
        }
        advanced {
            cssClasses: no-item-ui
            warnOnUnsavedChanges: ignore
        }
        default {
            type: static
            staticValue: START_DATE
        }
    )
    button timeline-reset (
        buttonName: TIMELINE_RESET
        label: Reset Timeline
        layout {
            sequence: 10
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
    "sourceSha256": "de145cf11764430b63b2ec4a07cdf6cffde5069d84df47022fa262ae95362924",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
