# Background Image — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00007-background-image.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6cb74b575e5d90c37f206ec5375494ad17b4b25d32ae7957d58bd934839d0815.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 7 (
    name: Background Image
    alias: BACKGROUND-IMAGE
    title: &APP_NAME. - Background Image
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
            htmlCode:
                ```html
                <p>Cards regions can be sourced by REST Data Sources.  This page uses <a href="&MOVIEDB_API." title="Movie Database API" target="_blank" rel="noopener noreferrer external">The Movie Database (TMDb) API</a> as a REST Data Source.</p>
                
                <p>This page displays movie posters as a Cards region's Media background.  It also displays the same movie poster image as each card's icon (for an overlay effect).</p>
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
            icon: fa-film
            renderComponents: belowContent
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region background-image (
        name: Background Image
        type: cards
        source {
            location: restSource
            restSource: @Movie_Database
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                u-colors
                t-CardsRegion--styleA
            ]
        }
        advanced {
            regionDisplaySelector: true
        }

        parameter (
            name: @language
            value {
                type: staticValue
                staticValue: en-US
            }
        )

        title {
            column: TITLE
        }
        subtitle {
            column: RELEASE_DATE
        }
        body {
            column: OVERVIEW
        }
        secondaryBody {
            column: MEDIA_TYPE
        }
        iconAndBadge {
            iconSource: imageUrl
            imageUrl: https://image.tmdb.org/t/p/w500&POSTER_PATH.
            iconPosition: top
            iconDescription: &TITLE!ATTR.
            badgeColumn: VOTE_AVERAGE
            badgeLabel: Rating:
        }
        media {
            source: imageUrl
            url: https://image.tmdb.org/t/p/w500&POSTER_PATH.
            position: background
            sizing: cover
            imageDescription: &TITLE!ATTR.
        }
        pagination {
            type: page
            cardsPerPage: 20
        }

        action action (
            label: Add to List
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: #
            }
            appearance {
                hot: true
            }
        )

        action action-2 (
            label: Add to Favorite
            layout {
                position: secondary
                sequence: 20
            }
            behavior {
                type: redirectUrl
                targetUrl: #
            }
            appearance {
                displayType: icon
                icon: fa-heart-o
            }
        )

        action action-3 (
            label: Share
            layout {
                position: secondary
                sequence: 30
            }
            behavior {
                type: redirectUrl
                targetUrl: #
            }
            appearance {
                displayType: icon
                icon: fa-share-alt
            }
        )

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

)


````
