# Faceted Search with Content Row Results

Faceted search in the left column filtering a Content Row employee list with avatar, badge, row actions and an Order By selector; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00004-fs-01-content-row.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00004-fs-01-content-row.apx",
  "sourceSha256": "df79e1a441af51c59c50de404bd3ec30b4663f76ec53bcf9deb2e1c84d8c52ff",
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
- Breadcrumb, image avatars and profile-page links were replaced by an inline title bar, initials avatars and mailto actions.
- Preserve the target application authentication and authorization.
- Replace the synthetic DUAL rows with authorized project SQL; keep facet source column names and the ORDER BY keys.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Faceted Search Content Row
    alias: HOME
    title: Faceted Search Content Row
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
        name: Filter employees
        type: facetedSearch
        source {
            filteredRegion: @search-results
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
            showCurrentFacets: selector
            currentFacetsSelector: #active_facets
        }

        facet P1_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: NAME,EMAIL,JOB_TITLE,BUSINESS_UNIT,WORK_ARRANGEMENT
            }
        )

        facet P1_JOB (
            type: checkboxGroup
            label {
                label: Job
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 20
            }
            listEntries {
                maxDisplayedEntries: 5
                allowToExclude: false
            }
            source {
                databaseColumn: JOB_TITLE
            }
        )

        facet P1_BUSINESS_UNIT (
            type: checkboxGroup
            label {
                label: Business Unit
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 90
            }
            listEntries {
                maxDisplayedEntries: 5
                allowToExclude: false
            }
            source {
                databaseColumn: BUSINESS_UNIT
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
                sequence: 100
            }
            listEntries {
                maxDisplayedEntries: 10
                allowToExclude: false
            }
            source {
                databaseColumn: EMPLOYMENT_STATUS
            }
        )

        facet P1_WORK_MODE (
            type: checkboxGroup
            label {
                label: Work Mode
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 110
            }
            listEntries {
                maxDisplayedEntries: 10
                allowToExclude: false
            }
            source {
                databaseColumn: WORK_ARRANGEMENT
            }
        )

        facet P1_CAREER_LEVEL (
            type: checkboxGroup
            label {
                label: Level
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 120
            }
            listEntries {
                maxDisplayedEntries: 5
                allowToExclude: false
            }
            source {
                databaseColumn: CAREER_LEVEL
            }
        )
    )

    region search-results (
        name: Employees
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select e.FIRST_NAME||' '||e.LAST_NAME NAME
                      ,e.JOB_TITLE
                      ,e.BUSINESS_UNIT
                      ,e.EMAIL
                      ,initcap(e.WORK_ARRANGEMENT) WORK_ARRANGEMENT
                      ,to_char(e.HIRE_DATE, 'DD Mon YYYY') HIRE_DATE_DISPLAY
                      ,e.HIRE_DATE
                      ,initcap(e.EMPLOYMENT_STATUS) EMPLOYMENT_STATUS
                      ,e.COUNTRY
                      ,e.CAREER_LEVEL
                      ,substr(e.FIRST_NAME, 1, 1)||substr(e.LAST_NAME, 1, 1) INITIALS
                      ,case e.EMPLOYMENT_STATUS when 'ACTIVE' then 'success'
                            when 'INACTIVE' then 'danger'
                            when 'LEAVE' then 'warning'
                       end BADGE_STATE
                      ,case e.EMPLOYMENT_STATUS when 'ACTIVE' then 'fa-check-circle-o'
                            when 'INACTIVE' then 'fa-times-circle-o'
                            when 'LEAVE' then 'fa-minus-circle-o'
                       end BADGE_ICON
                      ,e.EMPLOYEE_ID
                  from (
                    select 101 EMPLOYEE_ID, 'Ava' FIRST_NAME, 'Moreno' LAST_NAME, 'ava.moreno@example.com' EMAIL, 'Data Engineer' JOB_TITLE, 'Engineering' BUSINESS_UNIT, 'ACTIVE' EMPLOYMENT_STATUS, 'HYBRID' WORK_ARRANGEMENT, date '2021-03-15' HIRE_DATE, 'Spain' COUNTRY, 'L3' CAREER_LEVEL from dual union all
                    select 102, 'Liam', 'Okafor', 'liam.okafor@example.com', 'Product Manager', 'Product', 'ACTIVE', 'REMOTE', date '2019-07-01', 'Nigeria', 'L4' from dual union all
                    select 103, 'Mia', 'Tanaka', 'mia.tanaka@example.com', 'UX Designer', 'Product', 'LEAVE', 'ONSITE', date '2022-01-10', 'Japan', 'L2' from dual union all
                    select 104, 'Noah', 'Schmidt', 'noah.schmidt@example.com', 'Data Engineer', 'Engineering', 'ACTIVE', 'ONSITE', date '2018-11-05', 'Germany', 'L4' from dual union all
                    select 105, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Account Executive', 'Sales', 'INACTIVE', 'REMOTE', date '2020-05-20', 'France', 'L2' from dual union all
                    select 106, 'Omar', 'Haddad', 'omar.haddad@example.com', 'Support Analyst', 'Operations', 'ACTIVE', 'HYBRID', date '2023-02-27', 'Jordan', 'L1' from dual union all
                    select 107, 'Iris', 'Novak', 'iris.novak@example.com', 'Account Executive', 'Sales', 'ACTIVE', 'HYBRID', date '2017-09-12', 'Czechia', 'L3' from dual union all
                    select 108, 'Hugo', 'Silva', 'hugo.silva@example.com', 'Support Analyst', 'Operations', 'LEAVE', 'REMOTE', date '2024-04-08', 'Brazil', 'L1' from dual
                       ) e
                ```
        }
        orderBy {
            type: item
            item: {
                itemName: P1_ORDER_BY
                orderBys: {
                    REPORTS1: HIRE_DATE DESC
                    REPORTS2: HIRE_DATE ASC
                    JOB: JOB_TITLE ASC
                    ENAME: NAME ASC
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
            htmlDomId: search-results
        }
        componentAppearance {
            display: report
        }
        settings {
            overline: &WORK_ARRANGEMENT.
            title: &NAME.
            description:
                ```html
                <div class="u-display-flex u-flex-wrap u-align-items-center u-gap-3 u-text-muted u-text-sm">
                  {if BUSINESS_UNIT/}<span class="u-display-flex u-align-items-center u-gap-2"><span class="fa fa-building-o" aria-hidden="true"></span>&BUSINESS_UNIT.</span>{endif/}
                  {if COUNTRY/}<span class="u-display-flex u-align-items-center u-gap-2"><span class="fa fa-map-marker-o" aria-hidden="true"></span>&COUNTRY.</span>{endif/}
                  {if HIRE_DATE/}<span class="u-display-flex u-align-items-center u-gap-2"><span class="fa fa-calendar" aria-hidden="true"></span>&HIRE_DATE_DISPLAY.</span>{endif/}
                  {if CAREER_LEVEL/}<span class="u-display-flex u-align-items-center u-gap-2"><span class="fa fa-signal" aria-hidden="true"></span> &CAREER_LEVEL.</span>{endif/}
                </div>
                ```
            displayAvatar: true
            displayBadge: true
        }
        plugin-avatar {
            type: initials
            initials: INITIALS
        }
        plugin-badge {
            label: Status
            value: EMPLOYMENT_STATUS
            state: BADGE_STATE
            icon: &BADGE_ICON.
            style: subtle
            shape: circular
            columnWidth: large
        }
        plugin-appearance {
            applyThemeColors: false
        }

        column NAME (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: NAME
                dataType: varchar2
            }
        )

        column JOB_TITLE (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: JOB_TITLE
                dataType: varchar2
            }
        )

        column BUSINESS_UNIT (
            layout {
                sequence: 30
            }
            source {
                databaseColumn: BUSINESS_UNIT
                dataType: varchar2
            }
        )

        column EMAIL (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: EMAIL
                dataType: varchar2
            }
        )

        column WORK_ARRANGEMENT (
            layout {
                sequence: 50
            }
            source {
                databaseColumn: WORK_ARRANGEMENT
                dataType: varchar2
            }
        )

        column HIRE_DATE_DISPLAY (
            layout {
                sequence: 60
            }
            source {
                databaseColumn: HIRE_DATE_DISPLAY
                dataType: varchar2
            }
        )

        column HIRE_DATE (
            layout {
                sequence: 70
            }
            source {
                databaseColumn: HIRE_DATE
                dataType: date
            }
        )

        column EMPLOYMENT_STATUS (
            layout {
                sequence: 80
            }
            source {
                databaseColumn: EMPLOYMENT_STATUS
                dataType: varchar2
            }
        )

        column COUNTRY (
            layout {
                sequence: 90
            }
            source {
                databaseColumn: COUNTRY
                dataType: varchar2
            }
        )

        column CAREER_LEVEL (
            layout {
                sequence: 100
            }
            source {
                databaseColumn: CAREER_LEVEL
                dataType: varchar2
            }
        )

        column INITIALS (
            layout {
                sequence: 110
            }
            source {
                databaseColumn: INITIALS
                dataType: varchar2
            }
        )

        column BADGE_STATE (
            layout {
                sequence: 120
            }
            source {
                databaseColumn: BADGE_STATE
                dataType: varchar2
            }
        )

        column BADGE_ICON (
            layout {
                sequence: 130
            }
            source {
                databaseColumn: BADGE_ICON
                dataType: varchar2
            }
        )

        column EMPLOYEE_ID (
            layout {
                sequence: 140
            }
            source {
                databaseColumn: EMPLOYEE_ID
                dataType: number
            }
        )

        action email (
            position: primaryActions
            template: button
            label: Email
            layout {
                sequence: 20
            }
            behavior {
                type: redirectUrl
                targetUrl: mailto:&EMAIL.
            }
            appearance {
                displayType: textWithIcon
                icon: fa-envelope-o
                cssClasses: t-Button--simple
            }
        )

        action employee-actions (
            position: primaryActions
            template: menu
            label: Employee actions
            layout {
                sequence: 30
            }
            appearance {
                displayType: icon
                icon: fa-ellipsis-v
                cssClasses: [
                    t-Button--noUI
                    u-color-1
                ]
            }

            menu email-employee (
                label: Email employee
                layout {
                    sequence: 20
                }
                behavior {
                    type: redirectUrl
                    targetUrl: mailto:&EMAIL.
                }
                appearance {
                    icon: fa-envelope-o
                }
                serverSideCondition {
                    type: itemIsNotNull
                    item: EMAIL
                }
            )
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
            staticValues: STATIC2:Hire Date descending;REPORTS1,Hire Date ascending;REPORTS2,Job;JOB,Employee Name;ENAME
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 10
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
            staticValue: REPORTS1
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 20
            region: @button-bar
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
    "sourceSha256": "ac499b309a7441fc415d0f9c32416eb35f8f16a59cc3a4ba6ab92361f46fda2f",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
