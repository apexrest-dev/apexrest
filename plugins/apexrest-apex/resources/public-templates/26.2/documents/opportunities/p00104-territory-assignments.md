# Territory Assignments — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00104-territory-assignments.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2cd5ddd4a19ce5b388f23e28ad6aa45c2170ea795ef0e77cca5592fcf75e2e57.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 104 (
    name: Territory Assignments
    alias: TERRITORY-ASSIGNMENTS
    title: Territory Assignments
    pageGroup: @administration
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @administration-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText:
            ```html
            <p>
                To edit a territory assignment, click the <strong>Edit</strong> icon (pencil) next to the territory assignment. Click the <strong>Add Territory Assignment</strong> button to add a new territory assignment. Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.
            </p>
            ```
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 20
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--showBreadcrumb
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        advanced {
            excludeTitleFromTranslation: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region territory-acl (
        name: Territory ACL
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select id,
                    territory_id,
                    (   select territory_name
                        from eba_sales_territories t
                        where t.id = a.territory_id ) territory,
                    userid,
                    acl_comments,
                    created,
                    created_by,
                    updated,
                    updated_by
                from eba_sales_territory_acl a
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 1000000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: The maximum row count for this report is #MAX_ROW_COUNT# rows.  Please apply a filter to reduce the number of records in your query.
        }
        actionsMenu {
            savePublicReport: true
        }
        download {
            formats: [
                csv
                html
            ]
        }
        advanced {
            savedReportMappingIdentifier: 709169304948852643
        }

        column ACL_COMMENTS (
            type: plainText
            heading {
                heading: Comments
            }
            layout {
                sequence: 4
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: D
            }
        )

        column CREATED (
            type: plainText
            heading {
                heading: Created
            }
            layout {
                sequence: 6
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: F
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
            }
            layout {
                sequence: 7
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: G
            }
        )

        column ID (
            type: hidden
            heading {
                heading: Selected Territory
            }
            layout {
                sequence: 1
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
            security {
                escapeSpecialChars: false
            }
        )

        column TERRITORY (
            type: link
            heading {
                heading: Territory
            }
            layout {
                sequence: 5
            }
            link {
                target: {
                    page: 109
                    items: {
                        P109_ID: #ID#
                    }
                    clearCache: 109
                }
                linkText: #TERRITORY#
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: E
            }
        )

        column TERRITORY_ID (
            type: hidden
            heading {
                heading: Territory ID
            }
            layout {
                sequence: 2
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: B
            }
            security {
                escapeSpecialChars: false
            }
        )

        column UPDATED (
            type: plainText
            heading {
                heading: Updated
            }
            layout {
                sequence: 8
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: H
            }
        )

        column UPDATED_BY (
            type: plainText
            heading {
                heading: Updated By
            }
            layout {
                sequence: 9
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: I
            }
        )

        column USERID (
            type: plainText
            heading {
                heading: Username
            }
            layout {
                sequence: 3
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: C
            }
        )

        savedReport 7091709 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn ACL_COMMENTS (
                sequence: 3
            )

            displayColumn CREATED (
                sequence: 4
            )

            displayColumn CREATED_BY (
                sequence: 5
            )

            displayColumn TERRITORY (
                sequence: 2
            )

            displayColumn UPDATED (
                sequence: 6
            )

            displayColumn UPDATED_BY (
                sequence: 7
            )

            displayColumn USERID (
                sequence: 1
            )

        )

    )

    button create (
        buttonName: CREATE
        label: Add Territory Assignment
        layout {
            sequence: 10
            region: @breadcrumb
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 109
                clearCache: 109
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @territory-acl
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 104
                clearCache: 104
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction dialog-closed (
        name: Dialog Closed
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: jsExpression
            javaScriptExpression: window
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode: apex.message.showPageSuccess('Action Processed.');
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @territory-acl
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
