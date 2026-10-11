# Group Members — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00020-group-members2.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a72d7705be701de27f42ef05c68db8da0fd259b8254cbc0ab9d535092e4a2130.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 20 (
    name: Group Members
    alias: GROUP-MEMBERS2
    title: Group Members
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @contribution-rights
    }
    advanced {
        reloadOnSubmit: always
    }

    region button-bar (
        name: Button bar
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
    )

    region group-members (
        name: Group Members
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select email_address
                  from EBA_ca_email_group_mbrs
                 where group_id = :P20_GROUP_ID
                 order by 1
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
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
                t-Report--inline
            ]
            showNullValuesAs: " - "
        }
        performance {
            maxRowsToProcess: 500
        }
        breakFormatting {
            breakColumns: col1
        }
        componentAdvanced {
            stripHtml: true
        }

        column EMAIL_ADDRESS (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Members
            }
            layout {
                sequence: 1
            }
            sorting {
                sortable: false
            }
        )

    )

    pageItem P20_GROUP_ID (
        type: selectList
        label {
            label: Group
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @email-groups-with-cnt
        }
        layout {
            sequence: 10
            region: @group-members
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        default {
            type: static
            staticValue: &P15_GROUP_ID.
        }
        readOnly {
            type: always
        }
    )

    button close (
        buttonName: CLOSE
        label: Close
        layout {
            sequence: 10
            region: @button-bar
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
    )

    dynamicAction cancel-dialog (
        name: Cancel Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @close
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
