# Archive &NOMENCLATURE_PROJECT. — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00047-archive-nomenclature-project.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6fe1f02ccda11522253be668827989bafdfbf29cc4e6387946977360be5e3897.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 47 (
    name: Archive &NOMENCLATURE_PROJECT.
    alias: ARCHIVE-NOMENCLATURE-PROJECT
    title: Archive &NOMENCLATURE_PROJECT.
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

    pageItem P47_PROJECT (
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

    pageItem P47_PROJECT_ID (
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

    button archive-project (
        buttonName: Archive_Project
        label: Archive Project
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

    computation p47-project (
        itemName: P47_PROJECT
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select project
                from sp_projects p
                where id = :P47_PROJECT_ID
                ```
        }
    )

    process archive-project (
        name: Archive project
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_util.archive_project (
                    p_project_id => :P47_PROJECT_ID,
                    p_app_user => :APP_USER
                    );
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Project Archived
        }
        error {
            errorMessage: Unable to Archive Project
        }
        advanced {
            executionMappingIdentifier: 10828858259483922230
        }
        serverSideCondition {
            whenButtonPressed: @archive-project
        }
    )

    process log (
        name: log
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                sp_log.log_interaction(
                    p_project_id => :P47_PROJECT_ID);
                ```
        }
        execution {
            sequence: 10
            point: beforeRegions
        }
        advanced {
            executionMappingIdentifier: 1352979056540126403
        }
    )

    branch (
        name: branch to projects
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 3
                items: {
                    P3_PROJECT_ID: &P47_PROJECT_ID.
                }
                clearCache: 3
                action: resetPagination
            }
        }
    )

)


````
