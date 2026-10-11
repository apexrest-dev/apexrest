# Components — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p03000-components.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: df72e5b28fdf275e0ac34b983ab15ae27b2e1846768573bf0be61153aee81579.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3000 (
    name: Components
    alias: COMPONENTS
    title: Components - &APP_TITLE.
    pageGroup: @components
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
            /* Update icon background color to match page hero color */
            :root {
                --ut-medialist-icon-background-color: var(--u-color-15);
            }
            ```
    }
    security {
        authentication: public
    }
    help {
        helpText: No help is available for this page.
    }

    region components (
        name: Components
        type: staticContent
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-lg fa-shapes u-color-15
        }
    )

    region components-2 (
        name: Components
        type: list
        source {
            list: @templates-components
        }
        layout {
            sequence: 40
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--removeHeader js-removeLandmark
                t-Region--scrollBody
            ]
        }
        advanced {
            htmlDomId: region-types
            regionDisplaySelector: true
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                t-MediaList--showBadges
                t-MediaList--cols t-MediaList--2cols
                t-MediaList--iconsRounded
            ]
        }
    )

)


````
