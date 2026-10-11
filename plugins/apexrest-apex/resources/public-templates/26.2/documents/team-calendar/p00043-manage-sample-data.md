# Manage Sample Data — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00043-manage-sample-data.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b99cf06d7c0d30fa5ee2c33971d82ada1e3ead84db94968e4b6f901fca442848.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 43 (
    name: Manage Sample Data
    alias: MANAGE-SAMPLE-DATA
    title: Manage Sample Data
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
        authorizationScheme: @administration-rights
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText:
            ```html
            Click the <strong>Remove Sample Data</strong> button to remove the sample data the app ships with. Click the <strong>Load Sample Data</strong> button to load the sample data the app ships with. Click the <strong>Reset Data</strong> button to reload the sample data the app ships with.
            Click the <strong>Cancel</strong> button to return to the Administration page.
            ```
    }

    region button-region (
        name: Button Region
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noPadding
                t-ButtonRegion--noUI
            ]
        }
        advanced {
            excludeTitleFromTranslation: true
        }
    )

    region manage-sample-data (
        name: Manage Sample Data
        type: staticContent
        source {
            htmlCode: <p>This application ships with sample data.  You can remove and recreate sample data using this page.  If the sample data is old recreating the data makes the dates more current.  Removing or adding sample data will not affect any decisions you created.</p>
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--defaultIcons
                t-Alert--warning
            ]
            cssClasses: t-Alert--accessibleHeading
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @manage-sample-data
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button load-sample-data (
        buttonName: load_sample_data
        label: Load Sample Data
        layout {
            sequence: 40
            region: @manage-sample-data
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: functionBody
            plsqlFunctionBody: return not eba_ca_sample_data.is_loaded();
        }
    )

    button remove-sample-data (
        buttonName: remove_sample_data
        label: Remove Sample Data
        layout {
            sequence: 20
            region: @manage-sample-data
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--danger
                t-Button--simple
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
        serverSideCondition {
            type: functionBody
            plsqlFunctionBody: return eba_ca_sample_data.is_loaded();
        }
    )

    button reset-data (
        buttonName: reset_data
        label: Reset Data
        layout {
            sequence: 30
            region: @manage-sample-data
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction cnx (
        name: CNX
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

    process close (
        name: Close
        type: closeDialog
        settings {
            showSuccessMessages: false
        }
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 108592100007964978
        }
    )

    process load-sample-data (
        name: Load Sample Data
        type: executeCode
        source {
            plsqlCode: eba_ca_sample_data.load();
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Sample Data Loaded.
        }
        advanced {
            executionMappingIdentifier: 1962198521829674283
        }
        serverSideCondition {
            whenButtonPressed: @load-sample-data
        }
        security {
            authorizationScheme: @administration-rights
        }
    )

    process remove-sample-data (
        name: remove sample data
        type: executeCode
        source {
            plsqlCode: eba_ca_sample_data.remove();
        }
        execution {
            sequence: 20
        }
        successMessage {
            successMessage: Sample Data Removed
        }
        advanced {
            executionMappingIdentifier: 1962198139233674283
        }
        serverSideCondition {
            whenButtonPressed: @remove-sample-data
        }
        security {
            authorizationScheme: @administration-rights
        }
    )

    process reset-data (
        name: reset data
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                eba_ca_sample_data.remove();
                eba_ca_sample_data.load();
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Sample data reset.
        }
        advanced {
            executionMappingIdentifier: 1962197704346674280
        }
        serverSideCondition {
            whenButtonPressed: @reset-data
        }
        security {
            authorizationScheme: @administration-rights
        }
    )

)


````
