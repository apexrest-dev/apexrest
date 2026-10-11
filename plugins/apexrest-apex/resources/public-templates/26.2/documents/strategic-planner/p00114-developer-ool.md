# Developer_Pool — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00114-developer-ool.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: eb167539e15c4ead4cf27858532b85ee19a611ee674404d483cb6d3ea39a12c4.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 114 (
    name: Developer_Pool
    alias: DEVELOPER_OOL
    title: Developer Pool
    pageGroup: @releases
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }

    region about (
        name: About
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                A developer pool is a list of &NOMENCLATURE_USERS. that can be assigned to a release.
                This applicaiton may have many &NOMENCLATURE_USERS..  
                Only a subset of the &NOMENCLATURE_USERS. would contribute to a spcific release.
                By defining a &NOMENCLATURE_USERS. pool you can more easily report on &NOMENCLATURE_USERS. contribution.
                </p>
                
                <br />
                <br />
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
    )

    region button-container (
        name: button container
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button what-is-a-project (
        buttonName: what_is_a_project
        label: What is a &NOMENCLATURE_PROJECT.?
        layout {
            sequence: 10
            region: @button-container
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconLeft
            ]
            icon: fa=info
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 107
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button what-is-a-release (
        buttonName: what_is_a_release
        label: What is a Release?
        layout {
            sequence: 30
            region: @button-container
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconLeft
            ]
            icon: fa=info
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 108
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button what-is-a-user (
        buttonName: what_is_a_user
        label: What is a &NOMENCLATURE_USER.?
        layout {
            sequence: 20
            region: @button-container
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--link
                t-Button--iconLeft
            ]
            icon: fa=info
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 109
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
