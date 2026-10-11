# Unmark as Duplicate — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00050-unmark-as-duplicate.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fde20d40fca6f5b48ffeff8580329de4d99b530992046d54c441cebf93ce5313.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 50 (
    name: Unmark as Duplicate
    alias: UNMARK-AS-DUPLICATE
    title: Not a Duplicate
    pageGroup: @projects
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    security {
        authorizationScheme: @contribution-rights
    }

    region archive (
        name: Archive
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region button-container (
        name: Button Container
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    pageItem P50_DUPLICATE_OF (
        type: displayOnly
        label {
            label: Marked as duplicate of
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @sp-projects-project
        }
        layout {
            sequence: 30
            region: @archive
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: webSafe
        }
    )

    pageItem P50_PROJECT (
        type: displayOnly
        label {
            label: &NOMENCLATURE_PROJECT.
            alignment: left
        }
        layout {
            sequence: 20
            region: @archive
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P50_PROJECT_ID (
        type: hidden
        layout {
            sequence: 10
            region: @archive
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    button cancel (
        buttonName: Cancel
        label: Cancel
        layout {
            sequence: 10
            region: @button-container
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

    button mark-as-duplicate (
        buttonName: mark_as_duplicate
        label: Not a Duplicate
        layout {
            sequence: 10
            region: @button-container
            slot: create
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

    dynamicAction close-dialog (
        name: close dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-close (
            action: closeDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    computation p50-duplicate-of (
        itemName: P50_DUPLICATE_OF
        execution {
            sequence: 20
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select project
                from sp_projects p
                where id = (
                    select DUPLICATE_OF_PROJECT_ID
                    from sp_projects p2 
                    where id = :P50_PROJECT_ID)
                ```
        }
    )

    computation p50-project (
        itemName: P50_PROJECT
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select project
                from sp_projects p
                where id = :P50_PROJECT_ID
                ```
        }
    )

    process unmark-as-dupicate (
        name: unmark as dupicate
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_util.unmark_proj_as_duplicate (
                    p_project_id       => :P50_PROJECT_ID);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Not a duplicate
        }
        advanced {
            executionMappingIdentifier: 11672103213563434030
        }
        serverSideCondition {
            whenButtonPressed: @mark-as-duplicate
        }
    )

    branch (
        name: back to project
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 3
                items: {
                    P3_PROJECT_ID: &P50_PROJECT_ID.
                }
                clearCache: 3
                action: resetPagination
            }
        }
    )

)


````
