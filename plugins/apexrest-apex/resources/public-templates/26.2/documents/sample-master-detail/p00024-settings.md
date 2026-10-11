# Administration — Sample Master Detail

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-master-detail/apexlang/sample-master-detail/pages/p00024-settings.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c64b78a569285ed8c003d2a1cea2f23619cd5dd195c11f8d2b68b8ecf65a9a67.

Application dependency inventory: oracle:26.2:public-template/sample-master-detail/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 24 (
    name: Administration
    alias: SETTINGS
    title: Administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }

    region administration (
        name: Administration
        type: list
        source {
            list: @administration
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
                t-Region--scrollBody
            ]
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: #DEFAULT#
        }
    )

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

    region reports (
        name: Reports
        type: list
        source {
            list: @admin-reports
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
                t-Region--scrollBody
            ]
        }
        advanced {
            htmlDomId: adminReports
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: #DEFAULT#
        }
    )

    pageItem P24_FEEDBACK_STATUS (
        type: hidden
        layout {
            sequence: 20
            region: @administration
            slot: regionBody
        }
        source {
            type: expression
            plsqlExpression: case when :ENABLE_FEEDBACK = 'YES' then 'Enabled' else 'Disabled' end
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P24_PAGE_VIEWS (
        type: hidden
        layout {
            sequence: 40
            region: @reports
            slot: regionBody
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select count(*)
                from apex_activity_log l
                where flow_id = :app_id
                ```
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P24_USER_COUNT (
        type: hidden
        layout {
            sequence: 30
            region: @reports
            slot: regionBody
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery:
                ```sql
                select count(distinct userid)
                from apex_activity_log l
                where flow_id = :app_id
                ```
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
