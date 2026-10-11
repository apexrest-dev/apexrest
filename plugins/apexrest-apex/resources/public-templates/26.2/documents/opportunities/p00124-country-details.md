# Country Details — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00124-country-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 03ccbee005a65faa12f1e568c290ba2cdd8640e9cac94018fba7c709cff04476.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 124 (
    name: Country Details
    alias: COUNTRY-DETAILS
    title: Country Details
    pageGroup: @territories
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    config {
        buildOption: @territories
    }

    region button-bar (
        name: Button Bar
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region country-details (
        name: Country Details
        type: staticContent
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P124_COUNTRY (
        type: selectList
        label {
            label: Country
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @p93-country-r-id
            nullDisplayValue: - Select Country -
        }
        layout {
            sequence: 20
            region: @country-details
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
    )

    pageItem P124_TERRITORY_ID (
        type: hidden
        layout {
            sequence: 30
            region: @country-details
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button add-country (
        buttonName: ADD_COUNTRY
        label: Add Country
        layout {
            sequence: 10
            region: @button-bar
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--gapLeft
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @button-bar
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    dynamicAction cancel-clicked (
        name: Cancel clicked
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    process add-country (
        name: add country
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                insert into eba_sales_terr_map
                (territory_id, country_id)
                values
                (:P124_TERRITORY_ID, :P124_COUNTRY);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Country added.
        }
        advanced {
            executionMappingIdentifier: 9048747539513022765
        }
        serverSideCondition {
            whenButtonPressed: @add-country
        }
    )

    process close-dialog (
        name: close dialog
        type: closeDialog
        settings {
            showSuccessMessages: false
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 6407135494744009650
        }
    )

)


````
