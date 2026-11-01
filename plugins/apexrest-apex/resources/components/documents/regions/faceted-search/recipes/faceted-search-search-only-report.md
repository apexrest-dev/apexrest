# Search-Only Faceted Search Classic Report

A single Search facet bound to an external title-bar search item filters a Classic Report using THEME$CONTENT_ROW and THEME$BADGE template directives; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00007-fs-03-search-only-classic-report.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00007-fs-03-search-only-classic-report.apx",
  "sourceSha256": "3afe14bb77388928642c2b5d1eaea8e183801af57894e452fb3eaa4e6eca2c23",
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
- Breadcrumb replaced by an inline title bar that hosts P1_SEARCH; the new-employee button and PDF printing were omitted.
- Preserve the target application authentication and authorization.
- Replace the synthetic DUAL rows with authorized project SQL; keep report column order and the external search item name.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Search Only Classic Report
    alias: HOME
    title: Search Only Classic Report
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region title-bar (
        name: Search Only Classic Report
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
    region faceted-search (
        name: Faceted Search
        type: facetedSearch
        source {
            filteredRegion: @employees
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            compactNosThreshold: 10000
            displayChartForTopNValues: 10
        }

        facet P1_SEARCH_FS (
            type: search
            label {
                label: Search
            }
            settings {
                inputField: externalPageItem
                externalPageItem: P1_SEARCH
            }
            layout {
                sequence: 10
            }
        )
    )
    region employees (
        name: Employees
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select EMPLOYEE_ID,
                       FIRST_NAME,
                       LAST_NAME,
                       FIRST_NAME || ' ' || LAST_NAME as EMPLOYEE_NAME,
                       upper(substr(FIRST_NAME, 1, 1) || substr(LAST_NAME, 1, 1)) as INITIALS,
                       EMAIL,
                       COUNTRY,
                       CAREER_LEVEL,
                       JOB_TITLE,
                       EMPLOYMENT_STATUS,
                       initcap(replace(EMPLOYMENT_TYPE, '_', ' ')) as EMPLOYMENT_TYPE,
                       initcap(WORK_ARRANGEMENT) as WORK_ARRANGEMENT
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
                 order by LAST_NAME, FIRST_NAME
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--horizontalBorders
                t-Report--hideNoPagination
            ]
        }
        messages {
            whenNoDataFound: No data found.
        }

        column EMPLOYEE_ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )
        column FIRST_NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            type: hidden
            layout {
                sequence: 20
            }
        )
        column LAST_NAME (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 30
            }
        )
        column EMPLOYEE_NAME (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Name
            }
            layout {
                sequence: 40
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {with/}
                      TITLE:=#EMPLOYEE_NAME#
                      DESCRIPTION:=#EMAIL#
                      ITEM_CSS_CLASSES:=u-padding-xs
                      DISPLAY_AVATAR:=Y
                      AVATAR_TYPE:=initials
                      AVATAR_INITIALS:=#INITIALS#
                      AVATAR_SIZE:=t-Avatar--xs
                      AVATAR_SHAPE:=t-Avatar--circle
                      AVATAR_CSS_CLASSES:=u-color-subtle u-text-secondary
                    {apply THEME$CONTENT_ROW/}
                    ```
            }
            sorting {
                sortable: false
            }
        )
        column INITIALS (
            reportColumnQueryId: 5
            derivedColumn: N
            type: hidden
            layout {
                sequence: 50
            }
        )
        column EMAIL (
            reportColumnQueryId: 6
            derivedColumn: N
            type: hidden
            layout {
                sequence: 60
            }
        )
        column COUNTRY (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Country
            }
            layout {
                sequence: 70
            }
            sorting {
                sortable: false
            }
        )
        column CAREER_LEVEL (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Career Level
            }
            layout {
                sequence: 80
            }
        )
        column JOB_TITLE (
            reportColumnQueryId: 9
            derivedColumn: N
            heading {
                heading: Job Title
            }
            layout {
                sequence: 90
            }
            sorting {
                sortable: false
            }
        )
        column EMPLOYMENT_STATUS (
            reportColumnQueryId: 10
            derivedColumn: N
            type: hidden
            layout {
                sequence: 100
            }
        )
        column EMPLOYMENT_TYPE (
            reportColumnQueryId: 11
            derivedColumn: N
            heading {
                heading: Employment Type
            }
            layout {
                sequence: 110
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {with/}
                      LABEL:=Employment Type
                      VALUE:=#EMPLOYMENT_TYPE#
                      STATE:={case EMPLOYMENT_TYPE/}{when Full Time/}success{when Part Time/}info{when Contractor/}warning{otherwise/}neutral{endcase/}
                      LABEL_DISPLAY:=N
                      STYLE:=t-Badge--subtle
                      SHAPE:=t-Badge--circle
                    {apply THEME$BADGE/}
                    ```
            }
            sorting {
                sortable: false
            }
        )
        column WORK_ARRANGEMENT (
            reportColumnQueryId: 12
            derivedColumn: N
            heading {
                heading: Work Arrangement
            }
            layout {
                sequence: 120
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {with/}
                      LABEL:=Work Arrangement
                      VALUE:=#WORK_ARRANGEMENT#
                      STATE:={case WORK_ARRANGEMENT/}{when Remote/}info{when Hybrid/}warning{when Onsite/}success{otherwise/}info{endcase/}
                      LABEL_DISPLAY:=N
                      STYLE:=t-Badge--subtle
                      SHAPE:=t-Badge--circle
                      SIZE:=t-Badge--md
                    {apply THEME$BADGE/}
                    ```
            }
            sorting {
                sortable: false
            }
        )
    )
    pageItem P1_SEARCH (
        type: textField
        label {
            label: Search
            alignment: left
        }
        settings {
            subtype: search
        }
        layout {
            sequence: 10
            region: @title-bar
            slot: searchFieldAndSmartFilters
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--xlarge
            ]
            icon: fa-search
            width: 75
            valuePlaceholder: Search...
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
    "sourceSha256": "f852f3bceee4774794465abeaa13c41a37052fe7df4a343f6d553fa4c5f160b7",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
