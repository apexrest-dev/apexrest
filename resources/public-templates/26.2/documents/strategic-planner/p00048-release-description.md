# Release Description — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00048-release-description.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 907ccc65aa42560765db39abd3c92e5a827eea7f39240afc9a96e4e151fa3b50.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 48 (
    name: Release Description
    alias: RELEASE-DESCRIPTION
    title: Release Description
    pageGroup: @releases
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
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
        advanced {
            regionDisplaySelector: true
        }
    )

    region release-description (
        name: Release Description
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                declare
                    x clob;
                begin
                x := 'No description provided.';
                for c1 in (select description from SP_RELEASE_TRAINS r where r.id = :P48_ID) loop
                    x := apex_markdown.to_html(c1.description);
                end loop;
                return x;
                end;
                ```
        }
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

    pageItem P48_ID (
        type: hidden
        layout {
            sequence: 20
            slot: contentBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
            restrictedChars: alphanumWithSpace
        }
    )

    button close (
        buttonName: Close
        label: Close
        layout {
            sequence: 10
            region: @button-bar
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    dynamicAction close (
        name: close
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @close
        }

        action native-dialog-close (
            action: closeDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
