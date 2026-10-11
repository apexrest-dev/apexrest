# Project — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00107-project1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 5245b16003eea4084ffe8d693de291cf537cc9bd45a8c562cd25507446151403.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 107 (
    name: Project
    alias: PROJECT1
    title: &NOMENCLATURE_PROJECTS.
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
                This application primarily tracks &NOMENCLATURE_PROJECTS.. 
                A &NOMENCLATURE_PROJECT. typically has an owner, can optionally be assigned to a release, has a priority, and a size.
                People who work on a given &NOMENCLATURE_PROJECT. can record their work as an activity.
                </p>
                <p>
                    Click the dot-dot-dot actions menu control to perform other functions related to &NOMENCLATURE_PROJECTS..
                </p>
                <p>
                    &NOMENCLATURE_PROJECT. Organization:<br><br>
                    &NOMENCLATURE_AREAS. >  &NOMENCLATURE_INITIATIVES. >  <strong>&NOMENCLATURE_PROJECTS.</strong>
                </p>
                <p>
                    &NOMENCLATURE_PROJECT. Attributes:
                    <ul>
                        <li><strong>&NOMENCLATURE_INITIATIVE.</strong>: Defines how this &NOMENCLATURE_PROJECT. is organized.</li>
                        <li><strong>&NOMENCLATURE_PROJECT.</strong>: Name of &NOMENCLATURE_PROJECT..</li>
                        <li><strong>Owner</strong>: Person most responsible for this project</li>
                        <li><strong>Status</strong>: Defines progress on completing a &NOMENCLATURE_PROJECT. in 10% increments from 0% to 100%.  
                        Status values are also organized into 3 categories backlog (between 10% and 40% complete), 
                        actioning (between 50% and 90% complete) and delivered (100% complete).</li>
                        <li><strong>Priority</strong>: Defines how important this &NOMENCLATURE_PROJECT. is compared with other &NOMENCLATURE_PROJECTS.</li>
                        <li><strong>Size</strong>: T-shirt sized project size.  Sizes roughly correspond to hours of effort.</li>
                        <li><strong>Dates</strong>: A number of dates are provided to provide milestones within a &NOMENCLATURE_PROJECT. life cycle.</li>
                        <li><strong>Tags</strong>: Used to filter and categorize &NOMENCLATURE_PROJECTS..</li>
                        <li><strong>Release Dependent</strong>: Defines is the target complete date is set to a release or is set to a calendar date</li>
                        <li><strong>Release</strong>: Choose release if release dependent is set to true</li>
                        <li><strong>Target Date</strong>: Choose a calendar date if release dependent is set to false</li>
                        <li><strong>Target</strong>: Is a filter that combines both target dates and releases, e.g. a way to filter &NOMENCLATURE_PROJECTS.</li>
                    </ul>
                    <i>Note: depending on how your instance of this application is configured you may see a subset of these attributes.</i>
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
