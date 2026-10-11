# Region Display Selector — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01923-region-display-selector.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 866cf1cac0d65c06f70a7e13c7419e9ab99b09fbe193a7b56052b3e4a07b8eaf.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1923 (
    name: Region Display Selector
    alias: REGION-DISPLAY-SELECTOR
    title: Region Display Selector
    pageGroup: @design
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    javaScript {
        executeWhenPageLoads: apex.theme42demo.jump('&REQUEST.');
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
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

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 50
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
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
            additionalText:
                ```
                <p>Then in <strong>Page Designer</strong>, select the regions that should appear on the <strong>Region Display Selector</strong> and set the <em>Region Display Selector</em> property to <strong>Yes</strong>.</p>
                
                <p>It is recommended to place a <strong>Region Display Selector</strong> region in the <strong>Breadcrumb</strong> position on your page.</p>
                ```
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>The <strong>Region Display Selector</strong> is a Region component that provides a page level navigation control for other regions on the page with the <em>Region Display Selector</em> property set to <strong>Yes</strong>.  It can be configured to work in two modes:</p>
                <ul>
                  <li><strong>View Single Region</strong> Show regions as tabs. Selecting a tab will make the corresponding region visible and hide the other selections.</li>
                  <li><strong>Scroll Window</strong> Always display all the regions on the page. Selecting a tab will scroll your window to the corresponding region.</li>
                </ul>
                <p>
                   The <em>Remember Selection</em> attribute of a Region Display Selector can be set to control which tab is selected on page load:
                </p>
                <ul>
                    <li><strong>By User</strong> Tab selection will always be remembered across all sessions unless intentionally reset.</li>
                    <li><strong>By Session</strong> Tab selection will be remembered for the duration of a single session. Once a session ends, tab selection will be reset.</li>
                    <li><strong>No</strong> Tab selection will be set to the first tab in the Region Display Selector every time the page loads.</li>
                </ul>
                <p>
                    Region Display Selector also supports displaying icons in each tab with the <strong>Display Icon</strong> attribute. Any region that is included in the Region Display Selector and has the <em>Icon</em> property set will have that icon displayed.
                </p>
                ```
        }
        layout {
            sequence: 40
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
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

    region region (
        name: Region 1
        type: staticContent
        source {
            htmlCode: Region 1 content
        }
        layout {
            sequence: 60
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h480
                t-Region--noBorder
                js-headingLevel-2
                t-Region--scrollBody
            ]
            icon: fa-apex
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-2 (
        name: Region 2
        type: staticContent
        source {
            htmlCode: Region 2 content
        }
        layout {
            sequence: 70
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h480
                t-Region--noBorder
                js-headingLevel-2
                t-Region--scrollBody
            ]
            icon: fa-apex
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-3 (
        name: Region 3
        type: staticContent
        source {
            htmlCode: Region 3 content
        }
        layout {
            sequence: 80
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h480
                t-Region--noBorder
                js-headingLevel-2
                t-Region--scrollBody
            ]
            icon: fa-apex
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-4 (
        name: Region 4
        type: staticContent
        source {
            htmlCode: Region 4 content
        }
        layout {
            sequence: 90
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h480
                t-Region--noBorder
                js-headingLevel-2
                t-Region--scrollBody
            ]
            icon: fa-apex
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-5 (
        name: Region 5
        type: staticContent
        source {
            htmlCode: Region 5 content
        }
        layout {
            sequence: 100
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                i-h480
                t-Region--noBorder
                js-headingLevel-2
                t-Region--scrollBody
            ]
            icon: fa-apex
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
        advanced {
            htmlDomId: Demo1
        }
        settings {
            mode: scrollWindow
            displayRegionIcons: true
            rememberSelection: false
        }
    )

)


````
