# Headers and Footers — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p00422-headers-and-footers.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d550c6cc6b50ce94e6c8949d4fd52d9aa89cdfe5d8575ae595192fbc2a4be3a2.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 422 (
    name: Headers and Footers
    alias: HEADERS-AND-FOOTERS
    title: Headers and Footers
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
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region mobile-page-footer (
        name: Mobile Page Footer
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>You can configure a <b>Buttons Container</b> region so that it sticks to the bottom of the page for small screen devices.  This could be useful for when you want to have one set of buttons for a given page and position them to the bottom when a small screen device is used.</p>
                
                <p><b>Steps</b></p>
                <ol>
                  <li>Create a Region with the region template set to <b>Buttons Container</b></li>
                  <li>Modify the Template Options for this region and check the <b>Stick to Bottom on Mobile</b> option</li>
                </ol>
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
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region mobile-page-header (
        name: Mobile Page Header
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>The <strong>Breadcrumb Bar</strong> region position on any given Page Template within Universal Theme is designed to persist on large screens as the user scrolls.  This is the position where the Breadcrumbs component, or Hero region, is typically placed.</p>
                
                <p>By default, the contents of this region are not stuck to the top of the screen on small screen devices as it can take away valuable screen realestate. However, if you wish to persist this header to always be visible on a given page, you can add the following template option to make this happen.</p>
                
                <p><strong>Steps</strong></p>
                <ol>
                  <li>Select the Page in Page Designer</li>
                  <li>Modify the Template Options for the page and check the <strong>Sticky Header on Mobile</strong> option</li>
                </ol>
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

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>Many mobile apps share a common pattern for placement of buttons and other content. This content is typically positioned on the header or footer of the page which is easily accessible and on screen for quick actions. This page explains how you can apply this pattern for your own apps.</p>
        }
        layout {
            sequence: 20
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

    region page-footer-examples (
        name: Page Footer Examples
        type: staticContent
        source {
            htmlCode: <b>Page Footer Examples</b>
        }
        layout {
            sequence: 50
            parentRegion: @mobile-page-footer
            slot: subRegions
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--customIcons
                t-Alert--info
                t-Alert--removeHeading js-removeLandmark
                margin-top-md
            ]
            icon: fa-mouse-pointer
            renderComponents: belowContent
        }
    )

    region page-header-examples (
        name: Page Header Examples
        type: staticContent
        source {
            htmlCode: <b>Page Header Examples</b>
        }
        layout {
            sequence: 40
            parentRegion: @mobile-page-header
            slot: subRegions
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--customIcons
                t-Alert--info
                t-Alert--removeHeading js-removeLandmark
                margin-top-md
            ]
            icon: fa-mouse-pointer
            renderComponents: belowContent
        }
    )

    button footer (
        buttonName: FOOTER_1
        label: Footer Example 1
        layout {
            sequence: 20
            region: @page-footer-examples
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconRight
            ]
            icon: fa-external-link-square
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.theme42demo.openMobileSamplePage('f?p=&APP_ID.:1117:&APP_SESSION.:sample1','Sticky Page Header');
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button footer-2 (
        buttonName: FOOTER_2
        label: Footer Example 2
        layout {
            sequence: 40
            region: @page-footer-examples
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconRight
            ]
            icon: fa-external-link-square
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.theme42demo.openMobileSamplePage('f?p=&APP_ID.:1117:&APP_SESSION.:sample2','Sticky Page Header');
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button header (
        buttonName: HEADER_1
        label: Header Example 1
        layout {
            sequence: 10
            region: @page-header-examples
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconRight
            ]
            icon: fa-external-link-square
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.theme42demo.openMobileSamplePage('f?p=&APP_ID.:1116:&APP_SESSION.:sample1','Sticky Page Header');
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button header-2 (
        buttonName: HEADER_2
        label: Header Example 2
        layout {
            sequence: 30
            region: @page-header-examples
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconRight
            ]
            icon: fa-external-link-square
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.theme42demo.openMobileSamplePage('f?p=&APP_ID.:1116:&APP_SESSION.:sample2','Sticky Page Header');
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
