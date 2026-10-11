# Competencies — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00154-competencies.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ccbdfc3f92fc4ca9cd63397e5a98d46dd202691598ddeb436ff1a5a5c5590e4a.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 154 (
    name: Competencies
    alias: COMPETENCIES
    title: Competencies
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: rw-pillar--sienna
    }
    security {
        authorizationScheme: @administration-rights
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
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
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region competencies (
        name: Competencies
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select c.ID,
                       c.COMPETENCY,
                       c.DESCRIPTION,
                       c.CREATED,
                       c.CREATED_BY,
                       c.UPDATED,
                       c.UPDATED_BY,
                       --
                       (select count(*) 
                        from  sp_team_members tm 
                        where instr(
                              upper(','||tm.competencies||','),
                              upper(','||c.competency||',')) > 0 and 
                              tm.competencies is not null) competency_count
                  from SP_COMPETENCIES c
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
        link {
            linkColumn: customTarget
            target: {
                page: 155
                items: {
                    P155_ID: \#ID#\
                }
                action: resetPagination
            }
            linkIcon: <span role="img" aria-label="Edit" class="fa fa-edit" title="Edit"></span>
        }
        pagination {
            type: rowRangesXToY
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: The maximum row count for this report is #MAX_ROW_COUNT# rows.  Please apply a filter to reduce the number of records in your query.
        }
        advanced {
            savedReportMappingIdentifier: 11035762898284417850
        }

        column COMPETENCY (
            type: plainText
            heading {
                heading: Competency
            }
            layout {
                sequence: 2
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column COMPETENCY_COUNT (
            type: plainText
            heading {
                heading: Competency Count
                alignment: end
            }
            layout {
                sequence: 17
                columnAlignment: end
            }
            appearance {
                formatMask: 999G999G999G999G999G999G990
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: H
            }
        )

        column CREATED (
            type: plainText
            heading {
                heading: Created
            }
            layout {
                sequence: 4
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: D
            }
        )

        column CREATED_BY (
            type: plainText
            heading {
                heading: Created By
            }
            layout {
                sequence: 5
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: E
            }
        )

        column DESCRIPTION (
            type: plainText
            heading {
                heading: Description
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

        column ID (
            type: hidden
            heading {
                heading: ID
            }
            layout {
                sequence: 0
            }
            source {
                primaryKey: true
                dataType: number
            }
            advanced {
                endUserAlias: A
            }
        )

        column UPDATED (
            type: plainText
            heading {
                heading: Updated
            }
            layout {
                sequence: 6
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
            }
            advanced {
                endUserAlias: F
            }
        )

        column UPDATED_BY (
            type: plainText
            heading {
                heading: Updated By
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

        page {
            borderWidth: 0.5
            borderColor: #666666
        }
        pageHeader {
            pageHeaderText: Default Competencies
        }

        savedReport 110357754 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn COMPETENCY (
                sequence: 1
            )

            displayColumn COMPETENCY_COUNT (
                sequence: 2
            )

            displayColumn DESCRIPTION (
                sequence: 3
            )

            displayColumn UPDATED (
                sequence: 4
            )

            sort (
                column: COMPETENCY
                sort {
                    sequence: 1
                }
            )

            sort (
                column: UPDATED
                sort {
                    direction: desc
                    sequence: 2
                }
            )

        )

    )

    region sql (
        name: SQL
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 'insert into SP_COMPETENCIES (ID, COMPETENCY, DESCRIPTION) values ('||
                      rownum||', '''||
                      COMPETENCY||''', '''||
                      DESCRIPTION||''');' SQL
                  from SP_COMPETENCIES
                order by COMPETENCY
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        reportLayout {
            numberOfRows: 1500
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

        column SQL (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: SQL
            }
            layout {
                sequence: 10
            }
            sorting {
                sortable: false
            }
        )

    )

    button create (
        buttonName: CREATE
        label: Add Competency
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/text-with-icon
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-plus
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 155
                clearCache: 155
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button up (
        buttonName: Up
        label: Up
        layout {
            sequence: 20
            region: @breadcrumb
            slot: up
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
            ]
            icon: fa-arrow-up
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 10000
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction edit-report-dialog-closed (
        name: Edit Report - Dialog Closed
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @competencies
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @competencies
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction refresh-report-on-dialog-close (
        name: refresh report on dialog close
        execution {
            sequence: 20
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @breadcrumb
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @competencies
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
