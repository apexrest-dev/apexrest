# Project Dashboard — Sample Trees

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-trees/apexlang/sample-trees/pages/p00006-project-dashboard.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 9f2a0e336d3da8d7529a1836619d044c7c65a343f5db26b7bb60ac1548775a35.

Application dependency inventory: oracle:26.2:public-template/sample-trees/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 6 (
    name: Project Dashboard
    alias: PROJECT-DASHBOARD
    title: Project Dashboard
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 1
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

    region project-progress (
        name: Project Progress
        type: chart
        layout {
            sequence: 30
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
        advanced {
            regionDisplaySelector: true
        }
        chartAppearance {
            orientation: horizontal
        }
        performance {
            lazyLoading: true
        }
        dataCursor {
            dimOnHover: false
        }
        legend {
            show: false
        }

        series new (
            name: New
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select project_name, 
                           status, 
                           proj_id,
                           case when status=100 then '#E3170D'
                                when status >=30 and status < 100 then '#009900'
                                else '#FFE303'
                           end as color,
                        'f?p='||:APP_ID||':7:'||:APP_SESSION||'::NO:RP,7:P7_PROJ_ID:'||proj_id the_link
                    from eba_demo_tree_projects
                    order by project_name
                    ```
            }
            columnMapping {
                label: PROJECT_NAME
                value: STATUS
            }
            link {
                type: redirectThisApp
                target: {
                    page: 7
                    items: {
                        P7_PROJ_ID: &PROJ_ID.
                    }
                    clearCache: [
                        Y
                        7
                    ]
                }
            }
        )

        axis x (
            name: x
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            minorTicks {
                show: false
            }
        )

    )

    region task-tracking-tabs (
        name: Task_Tracking_Tabs
        type: list
        source {
            list: @task-tracking-tabs
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--scrollBody
                t-Region--removeHeader js-removeLandmark
            ]
        }
        advanced {
            excludeTitleFromTranslation: true
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                t-MediaList--cols t-MediaList--2cols
            ]
        }
    )

    button create (
        buttonName: CREATE
        label: Create
        layout {
            sequence: 10
            region: @project-progress
            slot: edit
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 7
                clearCache: 7
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
