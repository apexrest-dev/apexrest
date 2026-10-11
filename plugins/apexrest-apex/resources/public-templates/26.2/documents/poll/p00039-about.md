# About — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00039-about.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1dfa7fab6e26b2149628ed44f99a27e94c2ddac7117915c0b11dfedffa850df9.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 39 (
    name: About
    alias: ABOUT
    title: About
    pageGroup: @help
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            img.appIcon.live-poll {
                background-position: -448px -384px;
            }
            ```
    }
    htmlHeader {
        htmlHeader:
            ```html
            <style>
            div#uOneCol div.helpContainer div.helpSide h1.appNameHeader {margin-top: 8px; font-size: 16px; line-height: 24px;}
            div.helpContainer div.helpSide ul.vapList {
            padding-top: 8px;}
            </style>
            ```
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: Use this page to learn more about this application.
    }

    region about-this-application (
        name: About this Application
        type: plugin/translatedMessage
        layout {
            sequence: 10
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_ABOUT
            addParagraphTags: false
        }
    )

    region application-title (
        name: &APPLICATION_TITLE.
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select aa.version app_version,
                       to_char(aa.pages,'999G999G990') pages,
                       'Oracle' vendor
                from apex_applications aa
                where aa.application_id = :APP_ID
                ```
        }
        layout {
            sequence: 20
            slot: body
            startNewRow: false
            columnSpan: 4
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            cssClasses: t-HeroRegion--featured
        }
        image {
            fileUrl: #APP_FILES#icons/app-icon-512.png
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            template: @/value-attribute-pairs-column
            templateOptions: [
                #DEFAULT#
                t-AVPList--rightAligned
            ]
            showNullValuesAs: -
        }
        pagination {
            type: showAll
        }

        column APP_VERSION (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: App version
            }
            layout {
                sequence: 1
            }
        )

        column PAGES (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Pages
            }
            layout {
                sequence: 2
            }
        )

        column VENDOR (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Vendor
            }
            layout {
                sequence: 3
            }
        )

    )

    region features (
        name: Features
        type: plugin/translatedMessage
        layout {
            sequence: 100
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_FEATURES
            addParagraphTags: false
        }
    )

    region getting-started (
        name: Getting Started
        type: plugin/translatedMessage
        layout {
            sequence: 40
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED_1.5
            addParagraphTags: false
        }
    )

    region getting-started-2 (
        name: Getting Started2
        type: plugin/translatedMessage
        layout {
            sequence: 50
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED_2
            addParagraphTags: false
        }
    )

    region getting-started-3 (
        name: Getting Started3
        type: plugin/translatedMessage
        layout {
            sequence: 60
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED_3
            addParagraphTags: false
        }
    )

    region getting-started-4 (
        name: Getting Started
        type: plugin/translatedMessage
        layout {
            sequence: 30
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED
            addParagraphTags: false
        }
    )

    region getting-started-acl (
        name: Getting Started ACL
        type: plugin/translatedMessage
        layout {
            sequence: 80
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED_ACL
            addParagraphTags: false
        }
    )

    region getting-started-email (
        name: Getting Started EMAIL
        type: plugin/translatedMessage
        layout {
            sequence: 70
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED_EMAIL
            addParagraphTags: false
        }
    )

    region getting-started-toc (
        name: Getting Started TOC
        type: plugin/translatedMessage
        layout {
            sequence: 20
            parentRegion: @help-container
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            textMessage: HELP_GETTING_STARTED_TOC
            addParagraphTags: false
        }
    )

    region help-container (
        name: Help Container
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
        }
    )

)


````
