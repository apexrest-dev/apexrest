# Faceted Search Dashboard

Faceted search filtering a Classic Report while metric cards and two donut charts reuse the facet items and refresh after each report refresh; synthetic data.

Status: ready.

Component: component:regions/faceted-search.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00017-fs-07-search-dashboard.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/faceted-search-pattern/apexlang/oracle-apex-faceted-search-patterns/pages/p00017-fs-07-search-dashboard.apx",
  "sourceSha256": "b2afef85e16d917909d2a98fe36c7ca121a682106646160e6ceaf470b0ea5354",
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
    "P1_SEARCH",
    "P1_COST_CENTER",
    "P1_JOB",
    "P1_STATUS",
    "P1_WORK_MODE"
  ]
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Employee and cost-center tables were replaced by an inline DUAL CTE; quoted-phrase search parsing was simplified to whitespace tokens.
- Preserve the target application authentication and authorization.
- Replace the synthetic CTE with authorized project SQL in all four sources and keep every submitted facet item.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Faceted Search Dashboard
    alias: HOME
    title: Faceted Search Dashboard
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
        name: Faceted Search Dashboard
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
            sequence: 5
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
    region cost-center-chart (
        name: Cost center distribution
        type: chart
        layout {
            sequence: 30
            slot: body
            columnSpan: 6
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
            icon: fa-badge-dollar
        }
        advanced {
            htmlDomId: cost-center-chart
        }
        chart {
            type: donut
        }
        value {
            format: decimal
            decimalPlaces: 0
            formatScaling: none
        }

        series employee-counts (
            name: Matching employees
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    with employee_data as (
                        select e.EMPLOYEE_ID ID,
                               trim(e.FIRST_NAME || ' ' || e.LAST_NAME) NAME,
                               e.EMAIL,
                               e.JOB_TITLE JOB,
                               e.COST_CENTER,
                               e.TIME_ZONE,
                               initcap(e.WORK_ARRANGEMENT) WORK_MODE,
                               initcap(e.EMPLOYMENT_STATUS) EMPLOYMENT_STATUS,
                               e.COUNTRY,
                               e.CAREER_LEVEL
                          from (
                                  select 101 EMPLOYEE_ID, 'Ava' FIRST_NAME, 'Moreno' LAST_NAME, 'ava.moreno@example.com' EMAIL, 'Data Engineer' JOB_TITLE, 'Engineering' BUSINESS_UNIT, 'Platform' COST_CENTER, 'ACTIVE' EMPLOYMENT_STATUS, 'HYBRID' WORK_ARRANGEMENT, 'FULL_TIME' EMPLOYMENT_TYPE, date '2021-03-15' HIRE_DATE, 'Spain' COUNTRY, 'es' COUNTRY_CODE, 'Madrid' CITY, 'EMEA' GEOGRAPHIC_REGION, 'L3' CAREER_LEVEL, 'Europe/Madrid' TIME_ZONE, '+34 600 101 101' PHONE_NUMBER, 2 DIRECT_REPORTS, 'Data:Cloud' TAGS from dual union all
                                  select 102, 'Liam', 'Okafor', 'liam.okafor@example.com', 'Product Manager', 'Product', 'Growth', 'ACTIVE', 'REMOTE', 'FULL_TIME', date '2019-07-01', 'Nigeria', 'ng', 'Lagos', 'EMEA', 'L4', 'Africa/Lagos', '+234 800 102 102', 4, 'Strategy:Mentor' from dual union all
                                  select 103, 'Mia', 'Tanaka', 'mia.tanaka@example.com', 'UX Designer', 'Product', 'Growth', 'LEAVE', 'ONSITE', 'PART_TIME', date '2022-01-10', 'Japan', 'jp', 'Tokyo', 'APAC', 'L2', 'Asia/Tokyo', '+81 90 103 103', 0, 'Design' from dual union all
                                  select 104, 'Noah', 'Schmidt', 'noah.schmidt@example.com', 'Data Engineer', 'Engineering', 'Platform', 'ACTIVE', 'ONSITE', 'FULL_TIME', date '2018-11-05', 'Germany', 'de', 'Berlin', 'EMEA', 'L4', 'Europe/Berlin', '+49 151 104 104', 3, 'Data:Mentor' from dual union all
                                  select 105, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Account Executive', 'Sales', 'Field Sales', 'INACTIVE', 'REMOTE', 'CONTRACTOR', date '2020-05-20', 'France', 'fr', 'Paris', 'EMEA', 'L2', 'Europe/Paris', '+33 6 105 105', 0, 'Sales' from dual union all
                                  select 106, 'Omar', 'Haddad', 'omar.haddad@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2023-02-27', 'Jordan', 'jo', 'Amman', 'EMEA', 'L1', 'Asia/Amman', '+962 7 106 106', 0, 'Support' from dual union all
                                  select 107, 'Iris', 'Novak', 'iris.novak@example.com', 'Account Executive', 'Sales', 'Field Sales', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2017-09-12', 'United States', 'us', 'New York', 'AMER', 'L3', 'America/New_York', '+1 212 107 107', 5, 'Sales:Mentor' from dual union all
                                  select 108, 'Hugo', 'Silva', 'hugo.silva@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'LEAVE', 'REMOTE', 'PART_TIME', date '2024-04-08', 'Brazil', 'br', 'Sao Paulo', 'AMER', 'L1', 'America/Sao_Paulo', '+55 11 108 108', 0, 'Support:Cloud' from dual
                               ) e
                    ), search_terms as (
                        select lower(token) TERM
                          from (
                            select regexp_substr(:P1_SEARCH, '[^[:space:]]+', 1, level) token
                              from dual
                           connect by level <= regexp_count(:P1_SEARCH, '[^[:space:]]+')
                          )
                    ), matches as (
                        select d.*
                          from employee_data d
                         where (:P1_COST_CENTER is null or d.COST_CENTER in (
                                    select column_value from table(apex_string.split(:P1_COST_CENTER, ':'))))
                           and (:P1_JOB is null or d.JOB in (
                                    select column_value from table(apex_string.split(:P1_JOB, ':'))))
                           and (:P1_STATUS is null or d.EMPLOYMENT_STATUS in (
                                    select column_value from table(apex_string.split(:P1_STATUS, ':'))))
                           and (:P1_WORK_MODE is null or d.WORK_MODE in (
                                    select column_value from table(apex_string.split(:P1_WORK_MODE, ':'))))
                           and not exists (
                                    select 1 from search_terms t
                                     where t.TERM is not null
                                       and instr(lower(d.NAME || ' ' || d.EMAIL || ' ' || d.JOB || ' ' || d.COST_CENTER || ' '
                                                       || d.WORK_MODE || ' ' || d.EMPLOYMENT_STATUS || ' ' || d.COUNTRY), t.TERM) = 0)
                    )
                    select nvl(COST_CENTER, 'Unspecified') LABEL, count(*) EMPLOYEE_COUNT
                      from matches
                     group by COST_CENTER
                     order by EMPLOYEE_COUNT desc, LABEL
                    ```
                pageItemsToSubmit: [
                    P1_SEARCH
                    P1_COST_CENTER
                    P1_JOB
                    P1_STATUS
                    P1_WORK_MODE
                ]
            }
            columnMapping {
                label: LABEL
                value: EMPLOYEE_COUNT
            }
        )
    )
    region dashboard-metrics (
        name: Matching employee metrics
        type: themeTemplateComponent/metricCard
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with employee_data as (
                    select e.EMPLOYEE_ID ID,
                           trim(e.FIRST_NAME || ' ' || e.LAST_NAME) NAME,
                           e.EMAIL,
                           e.JOB_TITLE JOB,
                           e.COST_CENTER,
                           e.TIME_ZONE,
                           initcap(e.WORK_ARRANGEMENT) WORK_MODE,
                           initcap(e.EMPLOYMENT_STATUS) EMPLOYMENT_STATUS,
                           e.COUNTRY,
                           e.CAREER_LEVEL
                      from (
                              select 101 EMPLOYEE_ID, 'Ava' FIRST_NAME, 'Moreno' LAST_NAME, 'ava.moreno@example.com' EMAIL, 'Data Engineer' JOB_TITLE, 'Engineering' BUSINESS_UNIT, 'Platform' COST_CENTER, 'ACTIVE' EMPLOYMENT_STATUS, 'HYBRID' WORK_ARRANGEMENT, 'FULL_TIME' EMPLOYMENT_TYPE, date '2021-03-15' HIRE_DATE, 'Spain' COUNTRY, 'es' COUNTRY_CODE, 'Madrid' CITY, 'EMEA' GEOGRAPHIC_REGION, 'L3' CAREER_LEVEL, 'Europe/Madrid' TIME_ZONE, '+34 600 101 101' PHONE_NUMBER, 2 DIRECT_REPORTS, 'Data:Cloud' TAGS from dual union all
                              select 102, 'Liam', 'Okafor', 'liam.okafor@example.com', 'Product Manager', 'Product', 'Growth', 'ACTIVE', 'REMOTE', 'FULL_TIME', date '2019-07-01', 'Nigeria', 'ng', 'Lagos', 'EMEA', 'L4', 'Africa/Lagos', '+234 800 102 102', 4, 'Strategy:Mentor' from dual union all
                              select 103, 'Mia', 'Tanaka', 'mia.tanaka@example.com', 'UX Designer', 'Product', 'Growth', 'LEAVE', 'ONSITE', 'PART_TIME', date '2022-01-10', 'Japan', 'jp', 'Tokyo', 'APAC', 'L2', 'Asia/Tokyo', '+81 90 103 103', 0, 'Design' from dual union all
                              select 104, 'Noah', 'Schmidt', 'noah.schmidt@example.com', 'Data Engineer', 'Engineering', 'Platform', 'ACTIVE', 'ONSITE', 'FULL_TIME', date '2018-11-05', 'Germany', 'de', 'Berlin', 'EMEA', 'L4', 'Europe/Berlin', '+49 151 104 104', 3, 'Data:Mentor' from dual union all
                              select 105, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Account Executive', 'Sales', 'Field Sales', 'INACTIVE', 'REMOTE', 'CONTRACTOR', date '2020-05-20', 'France', 'fr', 'Paris', 'EMEA', 'L2', 'Europe/Paris', '+33 6 105 105', 0, 'Sales' from dual union all
                              select 106, 'Omar', 'Haddad', 'omar.haddad@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2023-02-27', 'Jordan', 'jo', 'Amman', 'EMEA', 'L1', 'Asia/Amman', '+962 7 106 106', 0, 'Support' from dual union all
                              select 107, 'Iris', 'Novak', 'iris.novak@example.com', 'Account Executive', 'Sales', 'Field Sales', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2017-09-12', 'United States', 'us', 'New York', 'AMER', 'L3', 'America/New_York', '+1 212 107 107', 5, 'Sales:Mentor' from dual union all
                              select 108, 'Hugo', 'Silva', 'hugo.silva@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'LEAVE', 'REMOTE', 'PART_TIME', date '2024-04-08', 'Brazil', 'br', 'Sao Paulo', 'AMER', 'L1', 'America/Sao_Paulo', '+55 11 108 108', 0, 'Support:Cloud' from dual
                           ) e
                ), search_terms as (
                    select lower(token) TERM
                      from (
                        select regexp_substr(:P1_SEARCH, '[^[:space:]]+', 1, level) token
                          from dual
                       connect by level <= regexp_count(:P1_SEARCH, '[^[:space:]]+')
                      )
                ), matches as (
                    select d.*
                      from employee_data d
                     where (:P1_COST_CENTER is null or d.COST_CENTER in (
                                select column_value from table(apex_string.split(:P1_COST_CENTER, ':'))))
                       and (:P1_JOB is null or d.JOB in (
                                select column_value from table(apex_string.split(:P1_JOB, ':'))))
                       and (:P1_STATUS is null or d.EMPLOYMENT_STATUS in (
                                select column_value from table(apex_string.split(:P1_STATUS, ':'))))
                       and (:P1_WORK_MODE is null or d.WORK_MODE in (
                                select column_value from table(apex_string.split(:P1_WORK_MODE, ':'))))
                       and not exists (
                                select 1 from search_terms t
                                 where t.TERM is not null
                                   and instr(lower(d.NAME || ' ' || d.EMAIL || ' ' || d.JOB || ' ' || d.COST_CENTER || ' '
                                                   || d.WORK_MODE || ' ' || d.EMPLOYMENT_STATUS || ' ' || d.COUNTRY), t.TERM) = 0)
                ), stats as (
                    select count(*) EMPLOYEE_COUNT,
                           count(distinct JOB) JOB_COUNT,
                           count(distinct COST_CENTER) COST_CENTER_COUNT
                      from matches
                )
                select 1 SORT_ORDER, 'Employees count' LABEL,
                       to_char(EMPLOYEE_COUNT, 'FM999G999G990') METRIC_VALUE, 'fa-users' ICON from stats
                union all
                select 2, 'Job roles represented',
                       to_char(JOB_COUNT, 'FM999G999G990'), 'fa-briefcase' from stats
                union all
                select 3, 'Cost centers represented',
                       to_char(COST_CENTER_COUNT, 'FM999G999G990'), 'fa-building-o' from stats
                ```
            pageItemsToSubmit: [
                P1_SEARCH
                P1_COST_CENTER
                P1_JOB
                P1_STATUS
                P1_WORK_MODE
            ]
        }
        orderBy {
            type: staticValue
            orderByClause: SORT_ORDER
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: [
                #DEFAULT#
                margin-bottom-md
            ]
            icon: fa-id-card
        }
        advanced {
            htmlDomId: dashboard-metrics
        }
        componentAppearance {
            display: report
        }
        settings {
            metric: &METRIC_VALUE.
            metricCssClasses: u-text-subheading-md u-color-1-text
            meta: &LABEL.
            layout: 3Columns
        }
        plugin-avatar {
            displayAvatar: true
            icon: &ICON.
            style: subtle
            position: inline
        }

        column SORT_ORDER (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: SORT_ORDER
                dataType: number
                primaryKey: true
            }
        )
        column LABEL (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: LABEL
                dataType: varchar2
            }
        )
        column METRIC_VALUE (
            layout {
                sequence: 30
            }
            source {
                databaseColumn: METRIC_VALUE
                dataType: varchar2
            }
        )
        column ICON (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: ICON
                dataType: varchar2
            }
        )
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
        advanced {
            htmlDomId: employee-filters
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
                dbColumns: NAME,EMAIL,JOB,COST_CENTER,TIME_ZONE,WORK_MODE,EMPLOYMENT_STATUS,COUNTRY,CAREER_LEVEL
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
                databaseColumn: JOB
            }
        )
        facet P1_STATUS (
            type: checkboxGroup
            label {
                label: Employment Status
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 30
            }
            listEntries {
                maxDisplayedEntries: 10
                allowToExclude: false
            }
            source {
                databaseColumn: EMPLOYMENT_STATUS
            }
        )
        facet P1_COST_CENTER (
            type: checkboxGroup
            label {
                label: Cost Center
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
                databaseColumn: COST_CENTER
            }
        )
        facet P1_WORK_MODE (
            type: checkboxGroup
            label {
                label: Work Arrangement
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
                databaseColumn: WORK_MODE
            }
        )
    )
    region search-results (
        name: Matching employees
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select e.EMPLOYEE_ID ID,
                       trim(e.FIRST_NAME || ' ' || e.LAST_NAME) NAME,
                       upper(substr(e.FIRST_NAME, 1, 1) || substr(e.LAST_NAME, 1, 1)) INITIALS,
                       e.EMAIL,
                       e.JOB_TITLE JOB,
                       e.COST_CENTER,
                       e.TIME_ZONE,
                       initcap(e.WORK_ARRANGEMENT) WORK_MODE,
                       initcap(e.EMPLOYMENT_STATUS) EMPLOYMENT_STATUS,
                       e.COUNTRY,
                       e.CAREER_LEVEL,
                       case when e.JOB_TITLE in ('Data Engineer') then 'success'
                            when e.JOB_TITLE in ('Product Manager', 'Account Executive') then 'warning'
                            when e.JOB_TITLE in ('Support Analyst') then 'danger'
                            else 'info' end JOB_TITLE_STATE,
                       case lower(e.EMPLOYMENT_STATUS) when 'active' then 'fa fa-check-circle-o' when 'inactive' then 'fa fa-times-circle-o' else 'fa fa-minus-circle-o' end STATUS_ICON,
                       case lower(e.EMPLOYMENT_STATUS) when 'active' then 'u-success-text' when 'inactive' then 'u-danger-text' else 'u-warning-text' end STATUS_STATE
                  from (
                      select 101 EMPLOYEE_ID, 'Ava' FIRST_NAME, 'Moreno' LAST_NAME, 'ava.moreno@example.com' EMAIL, 'Data Engineer' JOB_TITLE, 'Engineering' BUSINESS_UNIT, 'Platform' COST_CENTER, 'ACTIVE' EMPLOYMENT_STATUS, 'HYBRID' WORK_ARRANGEMENT, 'FULL_TIME' EMPLOYMENT_TYPE, date '2021-03-15' HIRE_DATE, 'Spain' COUNTRY, 'es' COUNTRY_CODE, 'Madrid' CITY, 'EMEA' GEOGRAPHIC_REGION, 'L3' CAREER_LEVEL, 'Europe/Madrid' TIME_ZONE, '+34 600 101 101' PHONE_NUMBER, 2 DIRECT_REPORTS, 'Data:Cloud' TAGS from dual union all
                      select 102, 'Liam', 'Okafor', 'liam.okafor@example.com', 'Product Manager', 'Product', 'Growth', 'ACTIVE', 'REMOTE', 'FULL_TIME', date '2019-07-01', 'Nigeria', 'ng', 'Lagos', 'EMEA', 'L4', 'Africa/Lagos', '+234 800 102 102', 4, 'Strategy:Mentor' from dual union all
                      select 103, 'Mia', 'Tanaka', 'mia.tanaka@example.com', 'UX Designer', 'Product', 'Growth', 'LEAVE', 'ONSITE', 'PART_TIME', date '2022-01-10', 'Japan', 'jp', 'Tokyo', 'APAC', 'L2', 'Asia/Tokyo', '+81 90 103 103', 0, 'Design' from dual union all
                      select 104, 'Noah', 'Schmidt', 'noah.schmidt@example.com', 'Data Engineer', 'Engineering', 'Platform', 'ACTIVE', 'ONSITE', 'FULL_TIME', date '2018-11-05', 'Germany', 'de', 'Berlin', 'EMEA', 'L4', 'Europe/Berlin', '+49 151 104 104', 3, 'Data:Mentor' from dual union all
                      select 105, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Account Executive', 'Sales', 'Field Sales', 'INACTIVE', 'REMOTE', 'CONTRACTOR', date '2020-05-20', 'France', 'fr', 'Paris', 'EMEA', 'L2', 'Europe/Paris', '+33 6 105 105', 0, 'Sales' from dual union all
                      select 106, 'Omar', 'Haddad', 'omar.haddad@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2023-02-27', 'Jordan', 'jo', 'Amman', 'EMEA', 'L1', 'Asia/Amman', '+962 7 106 106', 0, 'Support' from dual union all
                      select 107, 'Iris', 'Novak', 'iris.novak@example.com', 'Account Executive', 'Sales', 'Field Sales', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2017-09-12', 'United States', 'us', 'New York', 'AMER', 'L3', 'America/New_York', '+1 212 107 107', 5, 'Sales:Mentor' from dual union all
                      select 108, 'Hugo', 'Silva', 'hugo.silva@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'LEAVE', 'REMOTE', 'PART_TIME', date '2024-04-08', 'Brazil', 'br', 'Sao Paulo', 'AMER', 'L1', 'America/Sao_Paulo', '+55 11 108 108', 0, 'Support:Cloud' from dual
                       ) e
                ```
        }
        layout {
            sequence: 60
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
            icon: fa-id-card
        }
        advanced {
            htmlDomId: search-results
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--horizontalBorders
            ]
        }
        messages {
            whenNoDataFound: No employees match these filters. Remove a filter or shorten your search.
        }

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )
        column NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Employee
            }
            layout {
                sequence: 20
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    <div style="display:flex; align-items:center; gap:8px;">
                      {with/}
                        TYPE:=INITIALS
                        INITIALS:=#INITIALS#
                        SIZE:=t-Avatar--xs
                        SHAPE:=t-Avatar--circle
                        CSS_CLASSES:=u-color-subtle u-text-secondary
                      {apply THEME$AVATAR/}
                      <span>#NAME#</span>
                    </div>
                    ```
            }
            sorting {
                defaultSequence: 1
            }
        )
        column INITIALS (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 30
            }
        )
        column EMAIL (
            reportColumnQueryId: 4
            derivedColumn: N
            type: hidden
            layout {
                sequence: 40
            }
        )
        column JOB (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Job
                alignment: center
            }
            layout {
                sequence: 50
                columnAlignment: center
            }
            columnFormatting {
                htmlExpression:
                    ```html
                    {with/}
                      LABEL:=Job
                      VALUE:=#JOB#
                      STATE:=#JOB_TITLE_STATE#
                      LABEL_DISPLAY:=N
                      STYLE:=t-Badge--subtle t-Badge--circle
                      SIZE:=t-Badge--md
                    {apply THEME$BADGE/}
                    ```
            }
            sorting {
                defaultSequence: 2
            }
        )
        column COST_CENTER (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Cost Center
            }
            layout {
                sequence: 60
            }
        )
        column TIME_ZONE (
            reportColumnQueryId: 7
            derivedColumn: N
            type: hidden
            layout {
                sequence: 70
            }
        )
        column WORK_MODE (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Work Arrangement
            }
            layout {
                sequence: 80
            }
        )
        column EMPLOYMENT_STATUS (
            reportColumnQueryId: 9
            derivedColumn: N
            heading {
                heading: Employment Status
            }
            layout {
                sequence: 90
            }
            columnFormatting {
                htmlExpression: <span class="#STATUS_ICON# #STATUS_STATE#" title="#EMPLOYMENT_STATUS#"></span>
            }
        )
        column COUNTRY (
            reportColumnQueryId: 10
            derivedColumn: N
            type: hidden
            layout {
                sequence: 100
            }
        )
        column CAREER_LEVEL (
            reportColumnQueryId: 11
            derivedColumn: N
            type: hidden
            layout {
                sequence: 110
            }
        )
        column JOB_TITLE_STATE (
            reportColumnQueryId: 12
            derivedColumn: N
            type: hidden
            layout {
                sequence: 120
            }
        )
        column STATUS_ICON (
            reportColumnQueryId: 13
            derivedColumn: N
            type: hidden
            layout {
                sequence: 130
            }
        )
        column STATUS_STATE (
            reportColumnQueryId: 14
            derivedColumn: N
            type: hidden
            layout {
                sequence: 140
            }
        )
    )
    region work-mode-chart (
        name: Work arrangement distribution
        type: chart
        layout {
            sequence: 40
            slot: body
            startNewRow: false
            columnSpan: 6
        }
        appearance {
            template: @/standard
            templateOptions: #DEFAULT#
            icon: fa-laptop
        }
        advanced {
            htmlDomId: work-mode-chart
        }
        chart {
            type: donut
        }
        value {
            format: decimal
            decimalPlaces: 0
            formatScaling: none
        }

        series employee-counts (
            name: Matching employees
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    with employee_data as (
                        select e.EMPLOYEE_ID ID,
                               trim(e.FIRST_NAME || ' ' || e.LAST_NAME) NAME,
                               e.EMAIL,
                               e.JOB_TITLE JOB,
                               e.COST_CENTER,
                               e.TIME_ZONE,
                               initcap(e.WORK_ARRANGEMENT) WORK_MODE,
                               initcap(e.EMPLOYMENT_STATUS) EMPLOYMENT_STATUS,
                               e.COUNTRY,
                               e.CAREER_LEVEL
                          from (
                                  select 101 EMPLOYEE_ID, 'Ava' FIRST_NAME, 'Moreno' LAST_NAME, 'ava.moreno@example.com' EMAIL, 'Data Engineer' JOB_TITLE, 'Engineering' BUSINESS_UNIT, 'Platform' COST_CENTER, 'ACTIVE' EMPLOYMENT_STATUS, 'HYBRID' WORK_ARRANGEMENT, 'FULL_TIME' EMPLOYMENT_TYPE, date '2021-03-15' HIRE_DATE, 'Spain' COUNTRY, 'es' COUNTRY_CODE, 'Madrid' CITY, 'EMEA' GEOGRAPHIC_REGION, 'L3' CAREER_LEVEL, 'Europe/Madrid' TIME_ZONE, '+34 600 101 101' PHONE_NUMBER, 2 DIRECT_REPORTS, 'Data:Cloud' TAGS from dual union all
                                  select 102, 'Liam', 'Okafor', 'liam.okafor@example.com', 'Product Manager', 'Product', 'Growth', 'ACTIVE', 'REMOTE', 'FULL_TIME', date '2019-07-01', 'Nigeria', 'ng', 'Lagos', 'EMEA', 'L4', 'Africa/Lagos', '+234 800 102 102', 4, 'Strategy:Mentor' from dual union all
                                  select 103, 'Mia', 'Tanaka', 'mia.tanaka@example.com', 'UX Designer', 'Product', 'Growth', 'LEAVE', 'ONSITE', 'PART_TIME', date '2022-01-10', 'Japan', 'jp', 'Tokyo', 'APAC', 'L2', 'Asia/Tokyo', '+81 90 103 103', 0, 'Design' from dual union all
                                  select 104, 'Noah', 'Schmidt', 'noah.schmidt@example.com', 'Data Engineer', 'Engineering', 'Platform', 'ACTIVE', 'ONSITE', 'FULL_TIME', date '2018-11-05', 'Germany', 'de', 'Berlin', 'EMEA', 'L4', 'Europe/Berlin', '+49 151 104 104', 3, 'Data:Mentor' from dual union all
                                  select 105, 'Zoe', 'Martin', 'zoe.martin@example.com', 'Account Executive', 'Sales', 'Field Sales', 'INACTIVE', 'REMOTE', 'CONTRACTOR', date '2020-05-20', 'France', 'fr', 'Paris', 'EMEA', 'L2', 'Europe/Paris', '+33 6 105 105', 0, 'Sales' from dual union all
                                  select 106, 'Omar', 'Haddad', 'omar.haddad@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2023-02-27', 'Jordan', 'jo', 'Amman', 'EMEA', 'L1', 'Asia/Amman', '+962 7 106 106', 0, 'Support' from dual union all
                                  select 107, 'Iris', 'Novak', 'iris.novak@example.com', 'Account Executive', 'Sales', 'Field Sales', 'ACTIVE', 'HYBRID', 'FULL_TIME', date '2017-09-12', 'United States', 'us', 'New York', 'AMER', 'L3', 'America/New_York', '+1 212 107 107', 5, 'Sales:Mentor' from dual union all
                                  select 108, 'Hugo', 'Silva', 'hugo.silva@example.com', 'Support Analyst', 'Operations', 'Service Desk', 'LEAVE', 'REMOTE', 'PART_TIME', date '2024-04-08', 'Brazil', 'br', 'Sao Paulo', 'AMER', 'L1', 'America/Sao_Paulo', '+55 11 108 108', 0, 'Support:Cloud' from dual
                               ) e
                    ), search_terms as (
                        select lower(token) TERM
                          from (
                            select regexp_substr(:P1_SEARCH, '[^[:space:]]+', 1, level) token
                              from dual
                           connect by level <= regexp_count(:P1_SEARCH, '[^[:space:]]+')
                          )
                    ), matches as (
                        select d.*
                          from employee_data d
                         where (:P1_COST_CENTER is null or d.COST_CENTER in (
                                    select column_value from table(apex_string.split(:P1_COST_CENTER, ':'))))
                           and (:P1_JOB is null or d.JOB in (
                                    select column_value from table(apex_string.split(:P1_JOB, ':'))))
                           and (:P1_STATUS is null or d.EMPLOYMENT_STATUS in (
                                    select column_value from table(apex_string.split(:P1_STATUS, ':'))))
                           and (:P1_WORK_MODE is null or d.WORK_MODE in (
                                    select column_value from table(apex_string.split(:P1_WORK_MODE, ':'))))
                           and not exists (
                                    select 1 from search_terms t
                                     where t.TERM is not null
                                       and instr(lower(d.NAME || ' ' || d.EMAIL || ' ' || d.JOB || ' ' || d.COST_CENTER || ' '
                                                       || d.WORK_MODE || ' ' || d.EMPLOYMENT_STATUS || ' ' || d.COUNTRY), t.TERM) = 0)
                    )
                    select nvl(WORK_MODE, 'Unspecified') LABEL, count(*) EMPLOYEE_COUNT
                      from matches
                     group by WORK_MODE
                     order by EMPLOYEE_COUNT desc, LABEL
                    ```
                pageItemsToSubmit: [
                    P1_SEARCH
                    P1_COST_CENTER
                    P1_JOB
                    P1_STATUS
                    P1_WORK_MODE
                ]
            }
            columnMapping {
                label: LABEL
                value: EMPLOYEE_COUNT
            }
            label {
                show: true
            }
        )
    )
    button reset (
        buttonName: RESET
        label: Reset
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
    dynamicAction refresh-dashboard-regions (
        name: Refresh Dashboard After Results Refresh
        execution {
            sequence: 20
            eventScope: dynamic
        }
        when {
            event: apexafterrefresh
            selectionType: region
            region: @search-results
        }

        action refresh-metrics (
            name: Refresh Matching Employee Metrics
            action: refresh
            affectedElements {
                selectionType: region
                region: @dashboard-metrics
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )
        action refresh-cost-center-chart (
            name: Refresh Cost Center Distribution
            action: refresh
            affectedElements {
                selectionType: region
                region: @cost-center-chart
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )
        action refresh-work-mode-chart (
            name: Refresh Work Arrangement Distribution
            action: refresh
            affectedElements {
                selectionType: region
                region: @work-mode-chart
            }
            execution {
                sequence: 30
                fireOnInit: false
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
    "sourceSha256": "88a9195997298f4b63fbfce4867b9fafe94aa6d4cf10bdb4d0ee248f992f9943",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
