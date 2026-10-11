# Contributor_roles — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00067-contributor-roles.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c82785492c4e048d31225600f5c9a5c688f46ef8770adc33309d7311c08c51f6.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 67 (
    name: Contributor_roles
    alias: CONTRIBUTOR-ROLES
    title: Contributor Roles
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }

    region contributor-roles (
        name: Contributor Roles
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       RESOURCE_TYPE,
                       nvl(RESOURCE_DESCRIPTION,'No description available') RESOURCE_DESCRIPTION,
                       decode(IS_DEFAULT_YN,'Y','Yes','N','No',IS_DEFAULT_YN) as IS_DEFAULT_YN
                  from SP_RESOURCE_TYPES
                order by upper(RESOURCE_TYPE)
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
        reportLayout {
            numberOfRows: 10
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
                t-Report--staticRowColors
                t-Report--rowHighlight
                t-Report--noBorders
            ]
        }
        pagination {
            type: rowRangesXToYOfZWithPagination
        }

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            type: hidden
            layout {
                sequence: 10
            }
        )

        column IS_DEFAULT_YN (
            reportColumnQueryId: 4
            derivedColumn: N
            type: hidden
            layout {
                sequence: 40
            }
        )

        column RESOURCE_DESCRIPTION (
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

        column RESOURCE_TYPE (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Role
            }
            layout {
                sequence: 20
            }
            sorting {
                sortable: false
            }
        )

    )

)


````
