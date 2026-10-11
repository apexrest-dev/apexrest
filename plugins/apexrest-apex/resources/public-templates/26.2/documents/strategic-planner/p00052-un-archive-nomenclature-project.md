# Un-Archive &NOMENCLATURE_PROJECT. — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00052-un-archive-nomenclature-project.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e5d6afa4da08188a4c7f8fab751682e41106193e05c95eedd2d26d3519854843.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 52 (
    name: Un-Archive &NOMENCLATURE_PROJECT.
    alias: UN-ARCHIVE-NOMENCLATURE-PROJECT
    title: Restore &NOMENCLATURE_PROJECT.
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

    pageItem P52_PROJECT (
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

    pageItem P52_PROJECT_ID (
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

    button restore-project (
        buttonName: restore_Project
        label: Restore &NOMENCLATURE_PROJECT.
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

    computation p52-project (
        itemName: P52_PROJECT
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select project
                from sp_projects p
                where id = :P52_PROJECT_ID
                ```
        }
    )

    process unarchive-project (
        name: unArchive project
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_util.un_archive_project (
                    p_project_id => :P52_PROJECT_ID
                    );
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: &NOMENCLATURE_PROJECT. Restored
        }
        error {
            errorMessage: Unable to Archive Project
        }
        advanced {
            executionMappingIdentifier: 11677543556811597523
        }
        serverSideCondition {
            whenButtonPressed: @restore-project
        }
    )

    branch (
        name: branch to projects page
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 3
                items: {
                    P3_PROJECT_ID: &P52_PROJECT_ID.
                }
                clearCache: 3
                action: resetPagination
            }
        }
    )

)


````
