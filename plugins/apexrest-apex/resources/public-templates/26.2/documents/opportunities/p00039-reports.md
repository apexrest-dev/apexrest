# Reports — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00039-reports.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6fdd316db545423e30983f6a3d23fab84b260762736185e6e796af1d8691cfb0.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 39 (
    name: Reports
    alias: REPORTS
    title: Reports
    pageGroup: @reports
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: The reports accessible from this page mostly display information pertaining to opportunity data but the reports in the "Activity Reports" region display user activity information.
    }

    region activity-reports (
        name: Activity Reports
        type: list
        source {
            list: @activity-reports
        }
        layout {
            sequence: 30
            slot: body
            startNewRow: false
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hiddenOverflow
            ]
        }
        security {
            authorizationScheme: @contribution-rights
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
        }
    )

    region additional-reports (
        name: Additional Reports
        type: list
        source {
            list: @report-directory
        }
        layout {
            sequence: 20
            slot: body
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hiddenOverflow
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 70
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--showBreadcrumb
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        advanced {
            excludeTitleFromTranslation: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region exception-reports (
        name: Exception Reports
        type: list
        source {
            list: @exception-reports
        }
        layout {
            sequence: 40
            slot: body
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hiddenOverflow
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
        }
    )

    region primary-reports (
        name: Primary Reports
        type: list
        source {
            list: @primary-reports
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hiddenOverflow
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
        }
    )

)


````
