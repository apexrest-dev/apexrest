# Faceted Search with Cards Results

Faceted search filtering a Cards region with initials icons, status badges, primary and secondary card actions and an Order By selector; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00005-fs-02-cards.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00005-fs-02-cards.apx",
  "sourceSha256": "e106b442b8dc104ce1b83bc44f8003843a306062641382f13bc79a6a47da7382",
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
- Image media and profile-page targets were replaced by initials icons and mailto actions; breadcrumb replaced by an inline title bar.
- Preserve the target application authentication and authorization.
- Replace the synthetic DUAL rows with authorized project SQL; keep facet source column names and the ORDER BY keys.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Faceted Search Cards
    alias: HOME
    title: Faceted Search Cards
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
        name: Faceted Search Cards
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
    region employees (
        name: Employees
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select EMPLOYEE_ID,
                       FIRST_NAME,
                       LAST_NAME,
                       EMAIL,
                       JOB_TITLE,
                       initcap(EMPLOYMENT_STATUS) as EMPLOYMENT_STATUS,
                       case EMPLOYMENT_STATUS when 'ACTIVE' then 'u-success'
                            when 'INACTIVE' then 'u-danger'
                            when 'LEAVE' then 'u-warning'
                       end BADGE_STATE,
                       CAREER_LEVEL,
                       COST_CENTER,
                       BUSINESS_UNIT,
                       TIME_ZONE,
                       WORK_ARRANGEMENT,
                       substr(FIRST_NAME, 1, 1)||substr(LAST_NAME, 1, 1) INITIALS
                  from (
                      select 101 EMPLOYEE_ID, 'Ava' FIRST_NAME, 'Moreno' LAST_NAME, 'ava.moreno@example.com' EMAIL, 'Data Engineer' JOB_TITLE, 'Engineering' BUSINESS_UNIT, 'Platform' COST_CENTER, 'ACTIVE' EMPLOYMENT_STATUS, 'HYBRID' WORK_ARRANGEMENT, 'FULL_TIME' EMPLOYMENT_TYPE, date '2021-03-15' HIRE_DATE, 'Spain' COUNTRY, 'es' COUNTRY_CODE, 'Madrid' CITY, 'EMEA' GEOGRAPHIC_REGION, 'L3' CAREER_LEVEL, 'Europe/Madrid' TIME_ZONE, '+34 600 101 101' PHONE_NUMBER, 2 DIRECT_REPORTS, 'Data:Cloud' TAGS from dual union all
                      select 102, 'Liam', 'Okafor', 'liam.okafor@example.com', 'Product Manager', 'Product', 'Growth', 'ACTIVE', 'REMOTE', 'FULL_TIME', date '2019-07-01', 'Nigeria', 'ng', 'Lagos', 'EMEA', 'L4', 'Africa/Lagos', '+234 800 102 102', 4, 'Strategy:Mentor' from dual union all
                      select 103, 'Mia', 'Tanaka', 'mia.tanaka@example.com', 'UX Designer', 'Product', 'Growth', 'LEAVE', 'ONSITE', 'PART_TIME', date '2022-01-10', 'Japan', 'jp', 'Tokyo', 'APAC', 'L2', 'Asia/Tokyo', '+81 90 103 103', 0, 'Design' from dual union all
                      select 104, 'Noah', 'Schmidt', 'noah.schmidt@example.com', 'Data Engineer', 'Engineering', 'Platform', 'ACTIVE', 'ONSITE', 'FULL_TIME', date '2018-11-05', 'Germany', 'de', 'Berlin', 'EMEA', 'L4', 'Europe/Berlin', '+49 151 104 104', 3, 'Data:Mentor' from dual union all
                      select 105, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Account Executive', 'Sales', 'Field Sales', 'INACTIVE', 'REMOTE', 'CONTRACTOR', date '2020-05-20', 'France', 'fr', 'Paris', 'EMEA', 'L2', 'Europe/Paris', '+33 6 105 105', 0, 'Sales' from dual union all
                      select 106, 'Omar', 'Haddad', 'omar.haddad@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2023-02-27', 'Jordan', 'jo', 'Amman', 'EMEA', 'L1', 'Asia/Amman', '+962 7 106 106', 0, 'Support' from dual union all
                      select 107, 'Iris', 'Novak', 'iris.novak@example.com', 'Account Executive', 'Sales', 'Field Sales', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2017-09-12', 'United States', 'us', 'New York', 'AMER', 'L3', 'America/New_York', '+1 212 107 107', 5, 'Sales:Mentor' from dual union all
                      select 108, 'Hugo', 'Silva', 'hugo.silva@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'LEAVE', 'REMOTE', 'PART_TIME', date '2024-04-08', 'Brazil', 'br', 'Sao Paulo', 'AMER', 'L1', 'America/Sao_Paulo', '+55 11 108 108', 0, 'Support:Cloud' from dual
                       )
                ```
        }
        orderBy {
            type: item
            item: {
                itemName: P1_ORDER_BY
                orderBys: {
                    REPORTS1: FIRST_NAME DESC
                    REPORTS2: LAST_NAME ASC
                    DEPTNO: JOB_TITLE ASC
                }
            }
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--hideHeader js-addHiddenHeadingRoleDesc
                t-CardsRegion--styleC
                t-Form--large
            ]
        }
        advanced {
            htmlDomId: employees
        }
        card {
            primaryKeyColumn1: EMPLOYEE_ID
        }
        title {
            advancedFormatting: true
            htmlExpression: &FIRST_NAME. &LAST_NAME. - &JOB_TITLE.
        }
        subtitle {
            column: EMAIL
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: INITIALS
            badgeColumn: EMPLOYMENT_STATUS
            badgeCssClasses: &BADGE_STATE.
        }

        action email-employee (
            label: Email employee
            layout {
                position: secondary
                sequence: 30
            }
            behavior {
                type: redirectUrl
                targetUrl: mailto:&EMAIL.
            }
            appearance {
                displayType: textWithIcon
                icon: fa-envelope-o
                cssClasses: [
                    t-Button--noUI
                    u-color-1
                ]
            }
            serverSideCondition {
                type: itemIsNotNull
                item: EMAIL
            }
        )

        action view-profile (
            label: View profile
            layout {
                sequence: 20
            }
            behavior {
                type: redirectUrl
                targetUrl: mailto:&EMAIL.
            }
            appearance {
                displayType: textWithIcon
                icon: fa-user
                hot: true
                cssClasses: t-Button--primary
            }
        )
    )
    region filter-employees (
        name: Filter employees
        type: facetedSearch
        source {
            filteredRegion: @employees
        }
        layout {
            sequence: 50
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
                dbColumns: FIRST_NAME,LAST_NAME,EMAIL,JOB_TITLE,BUSINESS_UNIT,WORK_ARRANGEMENT
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
    pageItem P1_ORDER_BY (
        type: selectList
        label {
            label: Order By
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:First Name;REPORTS1,Last Name;REPORTS2,Job Title;DEPTNO
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
    "sourceSha256": "878d3d05e1f6fa32e00d90ced5b4fab998d8d9bed73b4b0d8b6fc67e1baed02e",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
