# Remove Collections — Sample Collections

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-collections/apexlang/sample-collections/pages/p00036-remove-collections.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a0670ae0b04719c558cd9147e47db1f38e4a6f7fac28037237157e4c62eb269a.

Application dependency inventory: oracle:26.2:public-template/sample-collections/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 36 (
    name: Remove Collections
    alias: REMOVE-COLLECTIONS
    title: Remove Collections
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region breacdcrumb (
        name: Breacdcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumbs
        }
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region collection-members-in-current-application (
        name: Collection Members In Current Application
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select collection_name, count(*) collection_count
                  from apex_collections
                 group by collection_name
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery: select null from apex_collections
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
        messages {
            whenNoDataFound: No collection members found
        }
        componentAdvanced {
            stripHtml: true
        }

        column COLLECTION_COUNT (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Number of Members
                alignment: end
            }
            layout {
                sequence: 2
                columnAlignment: end
            }
            sorting {
                sortable: false
            }
        )

        column COLLECTION_NAME (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Collection Name
            }
            layout {
                sequence: 1
            }
            sorting {
                defaultSequence: 1
                sortable: false
            }
        )

    )

    region remove-collections (
        name: Remove Collections
        type: staticContent
        source {
            htmlCode: <p>To remove all user-created collections and reset this application to the factory default, click on the Remove Collections button.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @breacdcrumb
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 35
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button remove-collections (
        buttonName: remove_collections
        label: Remove Collections
        layout {
            sequence: 10
            region: @breacdcrumb
            slot: delete
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

    process remove-collections (
        name: remove collections
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                -- This procedure will delete all collections that belong to the current user
                -- in the current APEX session and for the current application ID
                --
                apex_collection.delete_all_collections;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Collections removed.
        }
        advanced {
            executionMappingIdentifier: 1318663463857176553
        }
    )

    branch (
        name: go back to admin
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 35
            }
        }
    )

)


````
