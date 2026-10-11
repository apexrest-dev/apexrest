# Add Initiative - Focus Areas — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00174-add-initiative-focus-areas.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ffd0c696732b5f0daec8ad7589a73173542e66eeb2efd5a1a4796d181460d932.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 174 (
    name: Add Initiative - Focus Areas
    alias: ADD-INITIATIVE-FOCUS-AREAS
    title: Add Initiative - Focus Areas
    pageGroup: @initiatives
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/wizard-modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
        ]
    }
    security {
        authorizationScheme: @contribution-rights
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
            slot: wizardButtons
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    region focus-area (
        name: Focus Area
        type: staticContent
        layout {
            sequence: 30
            slot: wizardBody
        }
        appearance {
            template: @/wizard-container
            templateOptions: [
                #DEFAULT#
                t-Wizard--hideStepsXSmall
            ]
        }
        headerAndFooter {
            headerText: &NOMENCLATURE_PROJECTS. within this new &NOMENCLATURE_INITIATIVE. can be organized by “Focus Area”.  Optionally add focus areas for this &NOMENCLATURE_INITIATIVE..
        }
    )

    region focus-areas (
        name: Focus Areas
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select c001, n001, c002
                  from apex_collections
                 where collection_name = 'INITIATIVE_FOCUS_AREAS'
                 order by seq_id
                ```
        }
        layout {
            sequence: 40
            slot: wizardBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--altRowsDefault
                t-Report--rowHighlight
            ]
        }

        column C001 (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Focus Area
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
        )

        column C002 (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Description
            }
            layout {
                sequence: 30
            }
            sorting {
                sortable: false
            }
        )

        column N001 (
            reportColumnQueryId: 2
            derivedColumn: N
            type: plainTextBasedOnLov
            heading {
                heading: Development Owner
            }
            lov {
                type: sharedComponent
                lov: @sp-team-members-current-only
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

    )

    pageItem P174_DESCRIPTION (
        type: textField
        label {
            label: Description
            alignment: left
        }
        layout {
            sequence: 60
            region: @focus-area
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 50
        }
        validation {
            maxLength: 4000
        }
    )

    pageItem P174_FOCUS_AREA (
        type: textField
        label {
            label: Focus Area
            alignment: left
        }
        layout {
            sequence: 20
            region: @focus-area
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required-floating
            templateOptions: #DEFAULT#
            width: 20
        }
        validation {
            maxLength: 60
        }
    )

    pageItem P174_OWNER_ID (
        type: selectOne
        label {
            label: Development Owner
            alignment: left
        }
        settings {
            infiniteScroll: false
        }
        lov {
            type: sharedComponent
            lov: @sp-team-members-current-only
        }
        layout {
            sequence: 40
            region: @focus-area
            slot: regionBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
    )

    button add (
        buttonName: ADD
        label: Add
        layout {
            sequence: 70
            region: @focus-area
            slot: regionBody
            startNewRow: false
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--gapTop
            ]
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
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

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 50
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconRight
            ]
            icon: fa-chevron-right
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button previous (
        buttonName: PREVIOUS
        label: Previous
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-chevron-left
        }
        behavior {
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction add-focus-area (
        name: add focus area
        execution {
            sequence: 20
        }
        when {
            event: click
            selectionType: button
            button: @add
        }

        action native-alert (
            action: alert
            settings {
                message: Must specify Focus Area to Add
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
            clientSideCondition {
                type: jsExpression
                javaScriptExpression: $v('P174_FOCUS_AREA') === ''
            }
        )

        action native-clear (
            action: clear
            affectedElements {
                selectionType: items
                items: [
                    P174_FOCUS_AREA
                    P174_OWNER_ID
                    P174_DESCRIPTION
                ]
            }
            execution {
                sequence: 30
                fireOnInit: false
            }
        )

        action native-execute-plsql-code (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    apex_collection.add_member (
                        p_collection_name => 'INITIATIVE_FOCUS_AREAS',
                        p_c001            => :P174_FOCUS_AREA,
                        p_n001            => :P174_OWNER_ID,
                        p_c002            => :P174_DESCRIPTION );
                    ```
                itemsToSubmit: [
                    P174_FOCUS_AREA
                    P174_OWNER_ID
                    P174_DESCRIPTION
                ]
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
            clientSideCondition {
                type: itemIsNotNull
                item: P174_FOCUS_AREA
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @focus-areas
            }
            execution {
                sequence: 50
                fireOnInit: false
            }
        )

        action native-show (
            action: show
            affectedElements {
                selectionType: region
                region: @focus-areas
            }
            execution {
                sequence: 40
                fireOnInit: false
            }
        )

    )

    dynamicAction cancel-dialog (
        name: Cancel Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction hide-report-if-none (
        name: hide report if none
        execution {
            sequence: 30
        }
        when {
            event: ready
        }
        serverSideCondition {
            type: noRowsReturned
            sqlQuery:
                ```sql
                select 1
                  from apex_collections
                 where collection_name = 'INITIATIVE_FOCUS_AREAS'
                ```
        }

        action native-hide (
            action: hide
            affectedElements {
                selectionType: region
                region: @focus-areas
            }
            execution {
                sequence: 10
            }
        )

    )

    branch (
        name: previous
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 172
            }
        }
        serverSideCondition {
            whenButtonPressed: @previous
        }
    )

    branch (
        name: next
        execution {
            sequence: 30
        }
        behavior {
            target: {
                page: 175
            }
        }
        serverSideCondition {
            whenButtonPressed: @next
        }
    )

)


````
