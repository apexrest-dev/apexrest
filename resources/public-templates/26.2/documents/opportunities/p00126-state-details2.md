# State Details — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00126-state-details2.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a078dca029ee28f78a57ad82d2eb5a487ca8dfd31c20fdc629c41885ab20673b.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 126 (
    name: State Details
    alias: STATE-DETAILS2
    title: State Details
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
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region state-details (
        name: State Details
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

    pageItem P126_STATE (
        type: selectList
        label {
            label: State
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @p93-state-r-id
            nullDisplayValue: - Select State -
        }
        layout {
            sequence: 10
            region: @state-details
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

    pageItem P126_TERRITORY_ID (
        type: hidden
        layout {
            sequence: 20
            region: @state-details
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button add-state (
        buttonName: ADD_STATE
        label: Add State
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

    process add-state (
        name: Add state
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                insert into eba_sales_terr_map
                (territory_id, state_id)
                values
                (:P126_TERRITORY_ID, :P126_STATE);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: State added.
        }
        advanced {
            executionMappingIdentifier: 9048757364576080791
        }
        serverSideCondition {
            whenButtonPressed: @add-state
        }
    )

    process close-dialog (
        name: Close dialog
        type: closeDialog
        settings {
            showSuccessMessages: false
        }
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 6407136351980009659
        }
    )

)


````
