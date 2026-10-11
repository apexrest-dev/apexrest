# Basic Cards — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00003-basic-cards.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b1eb544df149872e1a1bbd4f7f26c43cc36dbe093ab3f2fd390fc2a92e624623.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3 (
    name: Basic Cards
    alias: BASIC-CARDS
    title: &APP_NAME. - Styles
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
            htmlCode: <p>You can display Cards in 3 different styles.</p>
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
            icon: fa-cards
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
            sequence: 70
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
        settings {
            includeShowAll: false
            rememberSelection: false
        }
    )

    region style-a (
        name: Style A
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
        }
        layout {
            sequence: 40
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleA
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        title {
            column: ENAME
        }
        subtitle {
            column: JOB
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: ENAME
            iconPosition: top
        }
        pagination {
            showTotalCount: true
        }
    )

    region style-b (
        name: Style B
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
        }
        layout {
            sequence: 50
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleB
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        title {
            column: ENAME
        }
        subtitle {
            column: JOB
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: ENAME
            iconPosition: top
        }
        pagination {
            showTotalCount: true
        }
    )

    region style-c (
        name: Style C
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
        }
        layout {
            sequence: 60
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleC
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        title {
            column: ENAME
        }
        subtitle {
            column: JOB
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: ENAME
            iconPosition: top
        }
        pagination {
            showTotalCount: true
        }
    )

)


````
