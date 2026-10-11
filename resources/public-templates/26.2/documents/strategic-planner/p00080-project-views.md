# Project Views — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00080-project-views.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 503b256bcedb6563f498e763b3d431d747f1c6a1e7d7c72be4d17f5aa3bb5fc1.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 80 (
    name: Project Views
    alias: PROJECT-VIEWS
    title: &NOMENCLATURE_PROJECT. Views
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

        facet P80_APP_USER (
            type: checkboxGroup
            label {
                label: User
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 40
            }
            listEntries {
                maxDisplayedEntries: 5
            }
            source {
                databaseColumn: APP_USER
            }
        )

        facet P80_INITIATIVE (
            type: checkboxGroup
            label {
                label: &NOMENCLATURE_INITIATIVE.
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 20
            }
            listEntries {
                maxDisplayedEntries: 5
            }
            source {
                databaseColumn: INITIATIVE
            }
        )

        facet P80_PROJECT (
            type: checkboxGroup
            label {
                label: Project
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 30
            }
            listEntries {
                maxDisplayedEntries: 5
            }
            source {
                databaseColumn: PROJECT
            }
        )

        facet P80_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: PROJECT_ID,APP_USER,ACTION
            }
        )

        facet P80_TAGS (
            type: checkboxGroup
            label {
                label: Tags
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 60
            }
            listEntries {
                maxDisplayedEntries: 5
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
                select 
                       l.APP_USER,
                       replace(p.project,':',' ') project,
                       p.friendly_identifier,
                       replace(i.initiative,':',' ') initiative,
                       lower(p.TAGS) tags,
                       max(l.PAGE_RENDERED) most_recent,
                       count(*) view_count
                  from SP_PROJ_INTERACTIONS_LOG l,
                       sp_projects p,
                       sp_initiatives i
                where l.project_id = p.id and
                      p.initiative_id = i.id and
                      p.DUPLICATE_OF_PROJECT_ID is null and
                      p.archived_yn = 'N' and
                      l.page_rendered >= sysdate-90
                group by i.initiative,
                         p.project,
                         p.friendly_identifier,
                         lower(p.TAGS),
                         l.APP_USER
                ```
        }
        orderBy {
            type: item
            item: {
                itemName: P80_ORDER_BY
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

        column APP_USER (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: User
            }
            layout {
                sequence: 23
            }
            sorting {
                sortable: false
            }
        )

        column FRIENDLY_IDENTIFIER (
            reportColumnQueryId: 3
            derivedColumn: N
            type: hidden
            layout {
                sequence: 43
            }
        )

        column INITIATIVE (
            reportColumnQueryId: 4
            derivedColumn: N
            type: hidden
            layout {
                sequence: 53
            }
        )

        column MOST_RECENT (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Last View
            }
            layout {
                sequence: 63
            }
            appearance {
                formatMask: SINCE
            }
            sorting {
                sortable: false
            }
        )

        column PROJECT (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Project
            }
            layout {
                sequence: 13
            }
            sorting {
                sortable: false
            }
        )

        column TAGS (
            reportColumnQueryId: 5
            derivedColumn: N
            type: hidden
            layout {
                sequence: 83
            }
        )

        column VIEW_COUNT (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: View Count
                alignment: end
            }
            layout {
                sequence: 73
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            sorting {
                sortable: false
            }
        )

    )

    pageItem P80_ORDER_BY (
        type: selectList
        label {
            label: Order By
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:View Count;VIEW_COUNT,User;APP_USER,Most Recent;MOST_RECENT
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
                page: 80
                clearCache: 80
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

)


````
