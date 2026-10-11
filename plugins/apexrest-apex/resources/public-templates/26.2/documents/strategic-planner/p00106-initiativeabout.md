# Initiative — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00106-initiativeabout.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e914d9c3bfcabbc99f91def8a71cc83a94359c220d0c7073f5274aa80f40b8df.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 106 (
    name: Initiative
    alias: INITIATIVEABOUT
    title: &NOMENCLATURE_INITIATIVE.
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
                An &NOMENCLATURE_INITIATIVE. is a way to organize &NOMENCLATURE_PROJECTS..  
                &NOMENCLATURE_INITIATIVES. also subdivide &NOMENCLATURE_AREAS..
                </p>
                <p>
                The goal is to more easily locate a specific &NOMENCLATURE_PROJECT. within a large list of &NOMENCLATURE_PROJECTS..  
                </p>
                <p>
                     Click on a &NOMENCLATURE_INITIATIVE. to view the &NOMENCLATURE_PROJECTS. defined for the &NOMENCLATURE_INITIATIVE..
                </p>
                <p>
                    Content Organization:<br><br>
                     &NOMENCLATURE_AREAS. >  <strong>&NOMENCLATURE_INITIATIVES.</strong> >  &NOMENCLATURE_PROJECTS.
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
            sequence: 30
            slot: dialogFooter
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button what-is-a-project (
        buttonName: what_is_a_project
        label: About &NOMENCLATURE_PROJECTS.
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
                page: 107
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button what-is-a-release (
        buttonName: what_is_a_release
        label: About Releases
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
                page: 105
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
