# Search Opportunities — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00149-search-opportunity-tracker.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 219551a00d67f3be92feaed8626f0cbbc73d075e67a017916b35128ecefa34cb.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 149 (
    name: Search Opportunities
    alias: SEARCH-OPPORTUNITY-TRACKER
    title: Search Opportunities
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        width: 480
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            .t-Button.search-button {padding: 12px 16px;}
            
            ```
    }
    help {
        helpText: No help is available for this page.
    }

    region search (
        name: Search
        type: staticContent
        layout {
            sequence: 10
            slot: wizardBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                t-Form--noPadding
                t-Form--xlarge
                t-Form--stretchInputs
            ]
            cssClasses: search-dialog
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P149_SEARCH (
        type: textField
        label {
            label: Search
            alignment: left
        }
        settings {
            submitWhenEnterPressed: true
        }
        layout {
            sequence: 10
            region: @search
            slot: regionBody
            alignment: left
            labelColumnSpan: 0
            columnCssClasses: col-xxs-9
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            icon: fa-search
            width: 30
            valuePlaceholder: Search Leads, Opportunities, and more...
        }
    )

    button search (
        buttonName: Search
        label: Search
        layout {
            sequence: 20
            region: @search
            slot: regionBody
            startNewRow: false
            columnSpan: 3
            columnCssClasses: col-xxs-3
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
                t-Button--stretch
            ]
            cssClasses: search-button
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    branch (
        name: Go to search
        execution {
            sequence: 10
            point: processing
        }
        behavior {
            target: {
                page: 116
                items: {
                    P116_SEARCH: &P149_SEARCH.
                }
                clearCache: 116
                action: resetPagination
            }
        }
    )

)


````
