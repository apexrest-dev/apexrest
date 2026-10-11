# Help Text — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01903-help-text.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: cee39841945aa8ff94018d9c4747887e03791f8f677046ea2000ca4826b34334.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1903 (
    name: Help Text
    alias: HELP-TEXT
    title: Help Text - &APP_TITLE.
    pageGroup: @design
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: [
            dm-Page
            dm-Page--center
        ]
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText:
            ```html
            <p>Help created in Application Builder displays on a dedicated Help page. To access Help, users click a link that takes them to a dedicated Help page. This Help page displays page and item Help topics specific to the page they are viewing.</p>
            <p>To define item Help text for a page:</p>
            <ol>
            <li>Navigate to the Page Definition for the page for which you want to add page Help.</li>
            <li>Under Page, click the Edit page attributes icon to view the existing page attributes.</li>
            <li>Scroll down to Help Text</li>
            <li>Enter your Help text in the field provided.</li>
            <li>Click Apply Change.</li>
            </ol>
            ```
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

    region help-example (
        name: Help Example
        type: helpText
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
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p><strong>Help Text</strong> regions enable you to provide page-level help.</p>
                <p class="dm-Hero-steps">Set <strong>Help Text</strong> as the Region type.</p>
                ```
        }
        layout {
            sequence: 30
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
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

)


````
