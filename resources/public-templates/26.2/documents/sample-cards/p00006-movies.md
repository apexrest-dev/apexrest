# Embedded Video — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00006-movies.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ae93dd4f1804fe6899b020ccc811e3b1379631fcbbeb3b84def18a791bb2f9d0.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 6 (
    name: Embedded Video
    alias: MOVIES
    title: &APP_NAME. - Embedded Video
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
                <p>Cards regions can be sourced by REST Data Sources.  This page uses a <a href="https://developers.google.com/youtube/v3/docs/playlists" title="Playlists Resource" target="_blank" rel="noopener noreferrer external">Playlists</a> REST resource in a <a href="https://developers.google.com/youtube/v3/getting-started" title="YouTube Data API" target="_blank" rel="noopener noreferrer external">YouTube Data API</a> to display the &PRODUCT_NAME. YouTube channel playlists.</p>
                
                <p>This page uses the <strong>Cards Media Advanced Formatting</strong> to add an HTML <code>&lt;iframe&gt;</code> tag which embeds a player inline. Embedding videos can add extra weight to your page.  Click <strong>View All Videos</strong> to see all of the videos in this playlist and view alternative ways of displaying Cards regions with video information.</p>
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
            icon: fa-video-camera
            renderComponents: belowContent
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region apex-youtube-channel (
        name: APEX YouTube Channel
        type: cards
        source {
            location: restSource
            restSource: @APEX_Youtube_Playlists
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleB
            ]
        }

        parameter (
            name: @channelid
            value {
                type: staticValue
                staticValue: UCEpIXFjcQIztReQNLymvYrQ
            }
        )

        parameter (
            name: @maxresults
            value {
                type: staticValue
                staticValue: 25
            }
        )

        parameter (
            name: @part
            value {
                type: staticValue
                staticValue: snippet,contentDetails,player
            }
        )

        componentAppearance {
            gridColumns: 3
        }
        title {
            column: TITLE
        }
        subtitle {
            advancedFormatting: true
            htmlExpression:
                ```html
                Total Videos: &ITEMCOUNT. <br />
                Published: &PUBLISHEDAT.
                ```
        }
        media {
            advancedFormatting: true
            htmlExpression: <iframe src="https://www.youtube.com/embed/playlist?list=&ID." title="&TITLE." allowfullscreen></iframe>
            position: first
            cssClasses: [
                a-CardView-media--cover
                a-CardView-media--widescreen
            ]
        }
        pagination {
            type: page
            cardsPerPage: 3
        }

        action action (
            label: View All Videos
            layout {
                sequence: 10
            }
            behavior {
                target: {
                    page: 10
                    items: {
                        P10_ID: &ID.
                    }
                    clearCache: 10
                }
            }
            appearance {
                displayType: textWithIcon
                icon: fa-file-video-o
                hot: true
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
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

)


````
