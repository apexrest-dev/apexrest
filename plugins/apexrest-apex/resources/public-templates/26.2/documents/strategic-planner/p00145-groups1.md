# Groups — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00145-groups1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f3807122c8b4c2384a5d1a7a4531c3d455b7731a367e2d4b15c61d00bd991228.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 145 (
    name: Groups
    alias: GROUPS1
    title: Groups
    pageGroup: @projects
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
                A group is a collection of users who are working together.  
                Using groups allow filtering of &NOMENCLATURE_PROJECTS. for only those owned by a member of the group. Each group can also be associated with a tag.  This allows filtering of &NOMENCLATURE_PROJECTS. associated with the "Group Tag".
                </p>
                <p>
                A user can be part of more then one group.  You can also use the groups capability to identify a virtual team. 
                </p>
                
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
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button what-is-a-initiative (
        buttonName: what_is_a_initiative
        label: About &NOMENCLATURE_INITIATIVES.
        layout {
            sequence: 30
            region: @button-container
            slot: next
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
                page: 106
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button what-is-a-release (
        buttonName: what_is_a_release
        label: About Releases
        layout {
            sequence: 10
            region: @button-container
            slot: next
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
        config {
            buildOption: @releases
        }
    )

    button what-is-activity (
        buttonName: what_is_activity
        label: About Activities
        layout {
            sequence: 50
            region: @button-container
            slot: next
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
                page: 110
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button what-is-an-area (
        buttonName: what_is_an_area
        label: About &NOMENCLATURE_AREAS.
        layout {
            sequence: 20
            region: @button-container
            slot: next
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
                page: 105
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
