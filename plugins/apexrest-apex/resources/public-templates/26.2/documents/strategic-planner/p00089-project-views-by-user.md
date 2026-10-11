# Project Views by User — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00089-project-views-by-user.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 3639c6e48dfd0d52f8af1b574c6054e65668b48a3423ecf84b3374943c71a73c.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 89 (
    name: Project Views by User
    alias: PROJECT-VIEWS-BY-USER
    title: &NOMENCLATURE_PROJECT. Views by User
    appearance {
        pageTemplate: @/left-side-column
        templateOptions: #DEFAULT#
        cssClasses: rw-pillar--sienna
    }
    security {
        authorizationScheme: @administration-rights
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 30
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
            cssClasses: has-header-actions
        }
    )

    region items (
        name: Items
        type: staticContent
        source {
            htmlCode: <div id="active_facets"></div>
        }
        layout {
            sequence: 3
            slot: body
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
                margin-bottom-none
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region search (
        name: Search
        type: facetedSearch
        source {
            filteredRegion: @search-results
        }
        layout {
            sequence: 10
            slot: leftColumn
            columnSpan: 4
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        accessibility {
            landmarkLabel: Filters
        }
        settings {
            compactNosThreshold: 10000
            showCurrentFacets: selector
            currentFacetsSelector: #active_facets
            showTotalRowCount: true
            displayChartForTopNValues: 10
        }

        facet P89_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: APP_USER, NAME, COUNTRY
            }
        )

        facet P89_TAGS (
            type: checkboxGroup
            label {
                label: Tags
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
                databaseColumn: TAGS
            }
            multipleValues {
                type: delimitedList
                separator: ,
                trimWhitespace: true
            }
        )

    )

    region search-results (
        name: Search Results
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select l.APP_USER,
                       t.FIRST_NAME||' '||t.last_name name,
                       max(l.PAGE_RENDERED) most_recent,
                       count(*) view_count,
                       sum(case when trunc(l.page_rendered,'Month') >= add_months(trunc(sysdate,'Month'),-3) and
                                     trunc(l.page_rendered,'Month') < add_months(trunc(sysdate,'Month'),-2)
                                then 1
                                else 0
                                end) first_month,
                       sum(case when trunc(l.page_rendered,'Month') >= add_months(trunc(sysdate,'Month'),-2) and
                                     trunc(l.page_rendered,'Month') < add_months(trunc(sysdate,'Month'),-1)
                                then 1
                                else 0
                                end) second_month,
                       sum(case when trunc(l.page_rendered,'Month') >= add_months(trunc(sysdate,'Month'),-1) and
                                     trunc(l.page_rendered,'Month') < trunc(sysdate,'Month')
                                then 1
                                else 0
                                end) third_month,
                       sum(case when trunc(l.page_rendered,'Month') >= trunc(sysdate,'Month')
                                then 1
                                else 0
                                end) current_month,        
                       t.tags
                  from SP_PROJ_INTERACTIONS_LOG l,
                       sp_projects p,
                       SP_TEAM_MEMBERS t
                where l.project_id = p.id and
                      p.DUPLICATE_OF_PROJECT_ID is null and
                      p.archived_yn = 'N' and
                      trunc(l.page_rendered,'Month') >= add_months(trunc(sysdate,'Month'),-3) and
                      t.email = l.app_user
                group by 
                       l.APP_USER,
                       t.FIRST_NAME||' '||t.last_name,
                       t.tags
                ```
        }
        orderBy {
            type: item
            item: {
                itemName: P89_ORDER_BY
                orderBys: {
                    VIEW_COUNT: view_count desc
                    APP_USER: app_user
                    MOST_RECENT: most_recent desc
                }
            }
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        reportLayout {
            numberOfRows: 50
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--inline
                t-Report--hideNoPagination
            ]
        }
        performance {
            maxRowsToProcess: 100000
        }
        messages {
            whenNoDataFound: no data found
        }
        breakFormatting {
            reportSumLabel: &nbsp;
        }

        column APP_USER (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 94
            }
        )

        column CURRENT_MONTH (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: &P89_CURRENT_MONTH.
                alignment: end
            }
            layout {
                sequence: 54
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
        )

        column FIRST_MONTH (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: &P89_FIRST_MONTH.
                alignment: end
            }
            layout {
                sequence: 24
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
        )

        column MOST_RECENT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Last View
            }
            layout {
                sequence: 84
            }
            appearance {
                formatMask: SINCE
            }
            sorting {
                sortable: false
            }
        )

        column NAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Name
            }
            layout {
                sequence: 14
            }
            sorting {
                sortable: false
            }
        )

        column SECOND_MONTH (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: &P89_SECOND_MONTH.
                alignment: end
            }
            layout {
                sequence: 34
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
        )

        column TAGS (
            reportColumnQueryId: 9
            derivedColumn: N
            type: hidden
            layout {
                sequence: 74
            }
        )

        column THIRD_MONTH (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: &P89_THIRD_MONTH.
                alignment: end
            }
            layout {
                sequence: 44
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
        )

        column VIEW_COUNT (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Total Views
                alignment: end
            }
            layout {
                sequence: 64
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
            advanced {
                computeSum: true
            }
        )

    )

    pageItem P89_CURRENT_MONTH (
        type: hidden
        layout {
            sequence: 40
            region: @items
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P89_FIRST_MONTH (
        type: hidden
        layout {
            sequence: 10
            region: @items
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P89_ORDER_BY (
        type: selectList
        label {
            label: Order By
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Total View Count;VIEW_COUNT,User;APP_USER,Most Recent;MOST_RECENT
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 20
            region: @items
            slot: next
            alignment: left
        }
        appearance {
            template: @/hidden
            templateOptions: #DEFAULT#
            icon: fa-sort-amount-desc
            height: 1
        }
        validation {
            valueRequired: true
        }
        advanced {
            cssClasses: [
                w200
                no-item-ui
            ]
            warnOnUnsavedChanges: ignore
        }
        default {
            type: static
            staticValue: VIEW_COUNT
        }
    )

    pageItem P89_SECOND_MONTH (
        type: hidden
        layout {
            sequence: 20
            region: @items
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P89_THIRD_MONTH (
        type: hidden
        layout {
            sequence: 30
            region: @items
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @items
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
                t-Button--iconLeft
            ]
            icon: fa-undo
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 89
                clearCache: 89
                action: resetRegions
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button up (
        buttonName: UP
        label: Navigate Up
        layout {
            sequence: 20
            region: @breadcrumb
            slot: up
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-arrow-up
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 10000
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process set-headers (
        name: set headers
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                for c1 in (
                    select add_months(trunc(sysdate,'Month'),-3) first_month,
                           add_months(trunc(sysdate,'Month'),-2) second_month,
                           add_months(trunc(sysdate,'Month'),-1) third_month,
                           trunc(sysdate,'Month') current_month
                      from dual
                ) loop
                    :P89_FIRST_MONTH   := to_char(c1.first_month,'Mon YYYY');
                    :P89_SECOND_MONTH  := to_char(c1.second_month,'Mon YYYY');
                    :P89_THIRD_MONTH   := to_char(c1.third_month,'Mon YYYY');
                    :P89_CURRENT_MONTH := to_char(c1.current_month,'Mon YYYY');
                end loop;
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 18184323777173421633
        }
    )

)


````
