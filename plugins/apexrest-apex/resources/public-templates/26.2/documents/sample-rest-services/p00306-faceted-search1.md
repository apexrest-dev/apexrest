# Faceted Search — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00306-faceted-search1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b290fe5892f660f52098af8fda6a700ca3eae64e3188ed7bad0a8afe0692c596.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 306 (
    name: Faceted Search
    alias: FACETED-SEARCH1
    title: Faceted Search
    appearance {
        pageTemplate: @/left-side-column
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 10
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
        }
    )

    region button-bar (
        name: Button Bar
        type: staticContent
        source {
            htmlCode: <div id="active_facets"></div>
        }
        layout {
            sequence: 20
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

        facet P306_COMM (
            type: range
            label {
                label: Commission
            }
            settings {
                selectMultiple: true
            }
            lov {
                type: staticValues
                staticValues: STATIC2:less than 500;|500,500 to 1#G#000;500|1000,more then 1#G#000;1000|
            }
            layout {
                sequence: 50
            }
            listEntries {
                maxDisplayedEntries: 7
                allowToExclude: false
            }
            actionsMenu {
                filter: false
                chart: false
            }
            source {
                databaseColumn: COMM
                dataType: number
            }
        )

        facet P306_JOB (
            type: checkboxGroup
            label {
                label: Job
            }
            lov {
                type: distinctValues
            }
            layout {
                sequence: 30
            }
            listEntries {
                maxDisplayedEntries: 7
                allowToExclude: false
            }
            source {
                databaseColumn: JOB
            }
        )

        facet P306_SAL (
            type: range
            label {
                label: Salary
            }
            settings {
                selectMultiple: true
            }
            lov {
                type: staticValues
                staticValues: STATIC2:less than  1#G#000;|1000,1#G#000 to  2#G#000;1000|2000,2#G#000  to 3#G#000;2000|3000,3#G#000  to 4#G#000;3000|4000,more than 4#G#000;4000|
            }
            layout {
                sequence: 40
            }
            listEntries {
                maxDisplayedEntries: 7
                allowToExclude: false
            }
            actionsMenu {
                filter: false
                chart: false
            }
            source {
                databaseColumn: SAL
                dataType: number
            }
        )

        facet P306_SEARCH (
            type: search
            label {
                label: Search
            }
            layout {
                sequence: 10
            }
            source {
                dbColumns: ENAME,JOB
            }
        )

    )

    region search-results (
        name: Search Results
        type: classicReport
        source {
            location: restSource
            restSource: @Employee_ords_rest_source
        }
        layout {
            sequence: 40
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
        messages {
            whenNoDataFound: no data found
        }

        column COMM (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Commission
                alignment: end
            }
            layout {
                sequence: 53
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
        )

        column DEPTNO (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Department
                alignment: end
            }
            layout {
                sequence: 63
                columnAlignment: end
            }
        )

        column EMPNO (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 1
            }
        )

        column ENAME (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Employee
            }
            layout {
                sequence: 2
            }
            accessibility {
                valueIdentifiesRow: true
            }
            sorting {
                defaultSequence: 1
            }
        )

        column HIREDATE (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Hiredate
            }
            layout {
                sequence: 23
            }
        )

        column JOB (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Job
            }
            layout {
                sequence: 3
            }
            sorting {
                defaultSequence: 1
            }
        )

        column MGR (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Manager
                alignment: end
            }
            layout {
                sequence: 33
                columnAlignment: end
            }
        )

        column SAL (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Salary
                alignment: end
            }
            layout {
                sequence: 13
                columnAlignment: end
            }
            appearance {
                formatMask: FML999G999G999G999G990D00
            }
        )

        parameter (
            name: @query
            value {
                type: null
            }
        )

    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 307
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: previous
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 305
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset (
        buttonName: RESET
        label: Reset
        layout {
            sequence: 10
            region: @button-bar
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
                page: 306
                action: resetRegions
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
