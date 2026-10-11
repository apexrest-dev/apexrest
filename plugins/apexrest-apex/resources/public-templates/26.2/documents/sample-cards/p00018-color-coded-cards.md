# Color Coded Cards — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00018-color-coded-cards.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 72aaf3448519acea60fbb8c38be2a3fec945b8ef16644382dbfbd21c57ebebd2.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 18 (
    name: Color Coded Cards
    alias: COLOR-CODED-CARDS
    title: &APP_NAME. - Color Coded Cards
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            :root {
                --a-cv-subtitle-text-color: inherit;
                --a-cv-subcontent-text-color: inherit;
            }
            
            ```
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>You can color code cards or icons based on a column value.</p>
                <p>This page color codes cards and icon background colors by departments. The region query uses <a href="https://oracleapex.com/ords/r/apex_pm/ut/color-and-status-modifiers" target="_blank" rel="noopener noreferrer external">Universal Theme Color Modifiers</a> and selects this as column:
                <pre>
                case when deptno = 10 then
                    'u-color-2'
                when deptno = 20 then
                    'u-color-3'
                when deptno = 30 then
                    'u-color-4'
                when deptno = 40 then
                    'u-color-5'
                end card_color
                </pre>
                Cards CSS Classes and Icon CSS Classes use this column substitution, <em>&CARD_COLOR !ATTR.</em>, to get the value.
                </p>
                ```
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
            icon: fa-paint-brush
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
        }
    )

    region cards (
        name: Cards
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select EMPNO,
                       ENAME,
                       JOB,
                       MGR,
                       HIREDATE,
                       SAL,
                       COMM,
                       DEPTNO,
                       case when deptno = 10 then
                           'u-color-2'
                       when deptno = 20 then
                           'u-color-3'
                       when deptno = 30 then
                           'u-color-4'
                       when deptno = 40 then
                           'u-color-5'
                       end card_color
                  from EBA_DEMO_CARD_EMP
                ```
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
        card {
            cssClasses: &CARD_COLOR!ATTR.
        }
        title {
            column: ENAME
        }
        subtitle {
            column: DEPTNO
        }
        body {
            column: JOB
        }
    )

    region icons (
        name: Icons
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select EMPNO,
                       ENAME,
                       JOB,
                       MGR,
                       HIREDATE,
                       SAL,
                       COMM,
                       DEPTNO,
                       case when deptno = 10 then
                           'u-color-2'
                       when deptno = 20 then
                           'u-color-3'
                       when deptno = 30 then
                           'u-color-4'
                       when deptno = 40 then
                           'u-color-5'
                       end card_color
                  from EBA_DEMO_CARD_EMP
                ```
        }
        layout {
            sequence: 40
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
            column: DEPTNO
        }
        body {
            column: JOB
        }
        iconAndBadge {
            iconSource: initials
            iconColumn: ENAME
            iconCssClasses: &CARD_COLOR!ATTR.
            iconPosition: top
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
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        settings {
            includeShowAll: false
            rememberSelection: false
        }
    )

)


````
