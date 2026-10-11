# No Data Found Message — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00017-no-data-found-message.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 8ede0c47338863f90fb94265c21a3019684d430141f9b48effb65684f6ad7567.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 17 (
    name: No Data Found Message
    alias: NO-DATA-FOUND-MESSAGE
    title: &APP_NAME. - No Data Found
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>As Cards do not have headers, you can define a No Data Found Message with your own icon to make Cards without no results more visible.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--scrollBody
            ]
            icon: fa-filter
            renderComponents: belowContent
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 50
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

    region default-no-data-found (
        name: Default No Data Found
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
            whereClause: 1=0
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        headerAndFooter {
            headerText: <h2>Default No Data Found</h2>
        }
        title {
            column: ENAME
        }
        body {
            column: JOB
        }
    )

    region no-data-found-with-icon (
        name: No Data Found with Icon
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
            whereClause: 1=0
        }
        layout {
            sequence: 40
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        headerAndFooter {
            headerText: <h2>No Data Found with Icon</h2>
        }
        title {
            column: ENAME
        }
        body {
            column: JOB
        }
        messages {
            whenNoDataFound: No Employees Found
            noDataFoundIcon: fa-warning fa-lg
        }
    )

    region rds (
        name: RDS
        type: regionDisplaySelector
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            includeShowAll: false
            rememberSelection: false
        }
    )

)


````
