# Reports - Search Region — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01413-reports-search-region.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 4572d129375b41a8205927aac91eb6c914f83857f888d70a0e3160cf20fa64ae.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1413 (
    name: Reports - Search Region
    alias: REPORTS-SEARCH-REGION
    title: Search Region - &APP_TITLE.
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
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

    region demo (
        name: Demo
        type: staticContent
        layout {
            sequence: 30
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            staticId: Demo1
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>A search region allows you to combine data from different search sources. This region allows you to find unrelated information in one place.</p>
                
                ```
        }
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-display-selector (
        name: Region Display Selector
        type: regionDisplaySelector
        layout {
            sequence: 20
            slot: breadcrumbBar
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    region search-region (
        name: Search Region
        type: search
        layout {
            sequence: 20
            parentRegion: @demo
            slot: subRegions
        }
        appearance {
            template: @/search-results-container
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: Demo1
        }
        settings {
            searchPageItem: P1413_SEARCH_FIELD
        }

        searchSource search (
            name: Search1
            searchConfig: @search1
            layout {
                sequence: 10
            }
        )

        searchSource search-2 (
            name: Search2
            searchConfig: @search2
            layout {
                sequence: 20
            }
        )

    )

    region template-options (
        name: Template Options
        type: plugin/previewTemplateOptions
        layout {
            sequence: 40
            slot: body
            startNewRow: false
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        settings {
            staticId: Demo1
        }
    )

    pageItem P1413_SEARCH_FIELD (
        type: textField
        label {
            label: Search
            alignment: left
        }
        layout {
            sequence: 10
            region: @search-region
            slot: searchField
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            icon: fa-search
            width: 30
        }
    )

)


````
