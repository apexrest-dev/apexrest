# Release — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00108-release-about.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: dad7b025c54ae3da0415de2c04300185b1a8c1b2054b7dc6a2b3ff81aea32f38.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 108 (
    name: Release
    alias: RELEASE-ABOUT
    title: Release
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
                A release is used to bucket &NOMENCLATURE_PROJECTS.. 
                Releases have milestones, comments, a open date and a release date.
                An active release is a release has an open date on or before today and a release date on or before today.
                </p>
                <p>
                     Click the dot-dot-dot actions menu control to perform other functions related to releases.
                </p>
                <p>
                    Release Attributes:
                    <ul>
                        <li><strong>Release Train</strong>: Defines the product family, for example APEX.  A release train can have many releases.</li>
                        <li><strong>Release</strong>: Defines the release within the release train, for example 7, thus APEX 7.</li>
                        <li><strong>Owner</strong>: &NOMENCLATURE_USER. who is most responsible for the release.</li>
                        <li><strong>Open Date</strong>: Date contributions are allowed to start</li>
                        <li><strong>Release Open Completed</strong>: Switch that defines that the release is or is not opened</li>
                        <li><strong>Release Target Date:</strong>: Defines the plan of record date the release is targeted to ship e.g. be formally completed.</li>
                        <li><strong>Release Completed:</strong>: Switch that defines that the release is or is not completed.</li>
                        <li><strong>Description:</strong>: Optional text that defines the release.</li>
                    </ul>
                </p>
                <p>
                    Organization:
                    <p>
                        Release Train > <strong>Release</strong> > &NOMENCLATURE_PROJECTS.
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
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button what-are-release-milestones (
        buttonName: what_are_release_milestones
        label: About Release Milestones
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
                page: 115
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button what-is-a-project (
        buttonName: what_is_a_project
        label: About &NOMENCLATURE_PROJECTS.
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

    button what-is-a-user (
        buttonName: what_is_a_user
        label: About &NOMENCLATURE_USERS.
        layout {
            sequence: 20
            region: @button-container
            slot: regionBody
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
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
