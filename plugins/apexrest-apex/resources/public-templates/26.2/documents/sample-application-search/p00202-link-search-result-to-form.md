# Link Search Result to Form — Sample Application Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-application-search/apexlang/sample-application-search/pages/p00202-link-search-result-to-form.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fa544e4c191b537e2c2c11f9c24d501e8c7efc669417e439e549c65b90f8cf88.

Application dependency inventory: oracle:26.2:public-template/sample-application-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 202 (
    name: Link Search Result to Form
    alias: LINK-SEARCH-RESULT-TO-FORM
    title: Link Search Result to Form
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This page explains how to link a form to a search result row.This will allow users to click on a row in a search result and be redirected to a form page to edit the row's details.</p>
                <p>To set this up, go to the <strong>Shared Components</strong> section in <strong>Page Designer,</strong> select the relevant Search Configuration, and click "<strong>Edit Component</strong>" From there, select the form page to redirect to and specify the items to be passed using the attribute "<strong>Set these items</strong>" and set their values using the attribute "<strong>With these values</strong>".</p>
                <p>To test the functionality, search for the name "<strong>Gary</strong>" and click on the row for Gary Barton to edit his details.</p>
                ```
        }
        layout {
            sequence: 40
            slot: body
            startNewRow: false
            columnSpan: 4
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
    )

    region search (
        name: Search
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noUI
                js-headingLevel-2
                t-Region--scrollBody
            ]
        }
        accessibility {
            landmarkType: search
            landmarkLabel: Customers
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region search-results (
        name: Search Results
        type: search
        layout {
            sequence: 30
            slot: body
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/search-results-container
            templateOptions: t-ResultsRegion--iconMd
        }
        accessibility {
            useLandmark: false
        }
        settings {
            searchPageItem: P202_SEARCH
        }
        messages {
            noQueryEnteredMessage: Enter a query to search for customers.
            noResultsFoundMessage: No customers found.
        }

        searchSource customer-search-configuration-with-link (
            name: Customer Search Configuration With Link
            searchConfig: @customer
            layout {
                sequence: 10
            }
        )

    )

    pageItem P202_SEARCH (
        type: textField
        label {
            label: Search
            alignment: left
        }
        settings {
            subtype: search
        }
        layout {
            sequence: 10
            region: @search
            slot: regionBody
            alignment: left
            labelColumnSpan: 0
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--stretchInputs
                t-Form-fieldContainer--large
            ]
            icon: fa-search
            valuePlaceholder: Enter your search term, e.g. 'Gary'
        }
        advanced {
            warnOnUnsavedChanges: ignore
        }
    )

    button next (
        buttonName: NEXT
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
                page: 204
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button prev (
        buttonName: PREV
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 201
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction dialog-closed (
        name: Dialog Closed
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @search-results
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @search-results
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction enter-key (
        name: Enter key
        execution {
            sequence: 20
        }
        when {
            event: keypress
            selectionType: items
            items: P202_SEARCH
        }
        clientSideCondition {
            type: jsExpression
            javaScriptExpression:
                ```javascript-browser
                this.browserEvent.keyCode === 13
                
                ```
        }

        action native-cancel-event (
            action: cancelEvent
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
