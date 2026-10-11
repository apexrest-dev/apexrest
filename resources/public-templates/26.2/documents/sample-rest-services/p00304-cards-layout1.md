# Cards Layout — Sample Rest Services

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-rest-services/apexlang/sample-rest-services/pages/p00304-cards-layout1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 19070e8a804be68e21ca6b8c6182eb8785d19a4192a0b352535156b002abcfb2.

Application dependency inventory: oracle:26.2:public-template/sample-rest-services/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 304 (
    name: Cards Layout
    alias: CARDS-LAYOUT1
    title: Cards Layout
    appearance {
        pageTemplate: @/standard
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

    region movies (
        name: Movies
        type: cards
        source {
            location: restSource
            restSource: @eba_rest_movies
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression: apex_app_setting.get_value('TMDB_APIKEY') = 'YES'
        }
        componentAppearance {
            gridColumns: 5
        }
        card {
            primaryKeyColumn1: ID
        }
        title {
            column: TITLE
        }
        subtitle {
            advancedFormatting: true
            htmlExpression:
                ```html
                <div class="movie-rating">
                <span class="fa fa-star"> &VOTE_AVG_ROUNDED.</span></div>
                ```
        }
        media {
            source: imageUrl
            url: https://image.tmdb.org/t/p/w500&POSTER_PATH.
            position: first
            appearance: square
            sizing: cover
            imageDescription: Image Poster
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                This page demonstrates displaying data in a card-based layout. It demonstrates how visual card regions can be utilized to present REST data in a mobile-friendly, visually appealing manner, which presents an alternative presentation style to traditional reports. The cards region shows data from the <code>themoviedb.org</code> <strong>Popular Movies</strong> REST Endpoint.
                
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression: apex_app_setting.get_value('TMDB_APIKEY') = 'YES'
        }
    )

    region web-credentials-not-provided (
        name: Web Credentials not provided
        type: staticContent
        source {
            htmlCode:
                ```html
                This page relies on a REST Data Source, which requires a valid API key. 
                Please provide an API key to access <strong>themoviedb.org</strong>, by navigating 
                to <strong>Administration > Web Credentials</strong>.
                
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--defaultIcons
                t-Alert--warning
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression: apex_app_setting.get_value('TMDB_APIKEY') = 'NO'
        }
    )

    button next (
        buttonName: Next
        label: Next
        layout {
            sequence: 20
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
                page: 305
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: Previous
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
                page: 303
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button set-credentials (
        buttonName: Set_Credentials
        label: Set Credentials
        layout {
            sequence: 10
            region: @web-credentials-not-provided
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 503
                items: {
                    P304_SOURCE: 304
                }
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
