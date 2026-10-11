# Cards — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00041-cards.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6530133844cebf1253ee59741fcdb49fffc5dc5924371123ff80aa0cbff2fb1e.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 41 (
    name: Cards
    alias: CARDS
    title: Cards
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>This cards region is a standard report region created using the Create Page Wizard.  Cards are useful for presenting a variety of information in small blocks.  As Cards usually provide entry to more detailed information, you can include number of actions declaratively.  You can easily scan for relevant and actionable information using cards. </p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-bottom-md
            ]
        }
    )

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

    region cards (
        name: Cards
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ROWID,
                       ID,
                       ROW_VERSION_NUMBER,
                       PROJECT,
                       TASK_NAME,
                       START_DATE,
                       END_DATE,
                       STATUS,
                       ASSIGNED_TO,
                       to_char( COST, 'FML999G999G999G999G990D00' ) COST,
                       to_char( BUDGET, 'FML999G999G999G999G990D00' ) BUDGET
                  from EBA_DEMO_IR_PROJECTS
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
        }
        advanced {
            htmlDomId: cards_report
        }
        title {
            column: PROJECT
        }
        subtitle {
            column: TASK_NAME
        }
        body {
            advancedFormatting: true
            htmlExpression: Assigned: &ASSIGNED_TO.
        }
        secondaryBody {
            advancedFormatting: true
            htmlExpression:
                ```html
                Started: &START_DATE. Ended: &END_DATE.<br />
                Budget: &BUDGET. Cost:&COST.
                ```
        }
        iconAndBadge {
            iconSource: iconClass
            iconCssClasses: fa-calendar-user
            badgeColumn: STATUS
        }
        pagination {
            showTotalCount: true
        }

        action action (
            label: Maintain Project
            layout {
                position: secondary
                sequence: 10
            }
            behavior {
                target: {
                    page: 2
                    items: {
                        P2_ROWID: &ROWID.
                    }
                    clearCache: 2
                }
            }
            appearance {
                displayType: icon
                icon: fa-edit
                cssClasses: fa-lg
            }
        )

    )

    dynamicAction refresh-on-edit (
        name: Refresh on Edit
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @cards
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @cards
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
