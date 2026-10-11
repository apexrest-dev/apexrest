# Favorite — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00128-favorite.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 05e78da4f038f093b82e59c0c577a25d1038e5139ff09a44a3278327b6157a2b.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 128 (
    name: Favorite
    alias: FAVORITE
    title: Favorite
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
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
    )

    region favorite (
        name: FavorIte
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P128_FAVORITE (
        type: switch
        label {
            label: Favorite
            alignment: left
        }
        layout {
            sequence: 40
            region: @favorite
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
    )

    pageItem P128_PROJECT (
        type: displayOnly
        label {
            label: Project
            alignment: left
        }
        layout {
            sequence: 10
            region: @favorite
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P128_PROJECT_ID (
        type: hidden
        layout {
            sequence: 20
            region: @favorite
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    button apply-changes (
        buttonName: apply_changes
        label: Apply Changes
        layout {
            sequence: 10
            region: @button-bar
            slot: edit
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
        buttonName: cancel
        label: Cancel
        layout {
            sequence: 20
            region: @button-bar
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

    computation p128-favorite (
        itemName: P128_FAVORITE
        execution {
            sequence: 30
            point: beforeHeader
        }
        computation {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                declare
                   l_favorite varchar(1) := 'N';
                begin
                   for c1 in (
                       select 1 
                       from sp_favorites f
                       where project_id = :P128_PROJECT_ID and
                             team_member_id = :APP_USER_ID) loop
                       -- if a row exists then project is user favorite
                       l_favorite := 'Y';
                   end loop;
                   return l_favorite;
                end;
                ```
        }
    )

    computation p128-project (
        itemName: P128_PROJECT
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            sqlQuery: select project from sp_projects where id = :P128_PROJECT_ID
        }
    )

    process close-dialog (
        name: Close Dialog
        type: closeDialog
        execution {
            sequence: 20
        }
        advanced {
            executionMappingIdentifier: 1904856749976748821
        }
    )

    process update-favorites (
        name: update favorites
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                   l_count   int := 0;
                   l_rows    int := 0;
                begin
                    if nvl(:P128_FAVORITE,'N') = 'N' then
                        delete from SP_FAVORITES f where team_member_id = :APP_USER_ID and project_id = :P128_PROJECT_ID;
                    end if;
                    if nvl(:P128_FAVORITE,'N') = 'Y' then
                       select count(*) into l_count from SP_FAVORITES f where team_member_id = :APP_USER_ID and project_id = :P128_PROJECT_ID;
                       if l_count = 0 then
                           insert into SP_FAVORITES (team_member_id, PROJECT_ID) values (:APP_USER_ID, :P128_PROJECT_ID);
                       end if;
                    end if;
                end;
                
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Preferences Set
        }
        advanced {
            executionMappingIdentifier: 1904855232677748806
        }
    )

)


````
