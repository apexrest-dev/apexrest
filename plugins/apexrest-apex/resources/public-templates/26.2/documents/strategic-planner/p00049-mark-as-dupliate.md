# Mark as Dupliate — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00049-mark-as-dupliate.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a90ea992224644b32f9fc642737fbec50b8cc2f0b4c85f1ca1ce5c9b1223fac7.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 49 (
    name: Mark as Dupliate
    alias: MARK-AS-DUPLIATE
    title: Mark as Dupliate
    pageGroup: @projects
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
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

    pageItem P49_DUPLICATE_OF (
        type: popupLov
        label {
            label: Duplicate of Primary &NOMENCLATURE_PROJECT.
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select project d, id r
                  from sp_projects
                 where id != :P49_PROJECT_ID
                 order by 1
                ```
        }
        layout {
            sequence: 30
            region: @archive
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            valueRequired: true
        }
        security {
            restrictedChars: webSafe
        }
    )

    pageItem P49_PROJECT (
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

    pageItem P49_PROJECT_ID (
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
        label: Mark as Duplicate
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

    computation p49-project (
        itemName: P49_PROJECT
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select project
                from sp_projects p
                where id = :P49_PROJECT_ID
                ```
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction(
                    p_project_id => :P49_PROJECT_ID);
                ```
        }
        execution {
            sequence: 10
            point: beforeRegions
        }
        advanced {
            executionMappingIdentifier: 1352978903793126402
        }
    )

    process mark-as-dupicate (
        name: mark as dupicate
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_util.mark_proj_as_duplidate (
                    p_project_id       => :P49_PROJECT_ID,
                    p_dup_of_project   => :P49_DUPLICATE_OF);
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Marked as Duplidate
        }
        advanced {
            executionMappingIdentifier: 11626723969574497970
        }
        serverSideCondition {
            whenButtonPressed: @mark-as-duplicate
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 3
                items: {
                    P3_PROJECT_ID: &P49_PROJECT_ID.
                }
            }
        }
    )

)


````
