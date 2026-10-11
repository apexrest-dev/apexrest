# Images in Comments — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00157-images-in-comments.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 13c15519118d9a2d165a81140fb2910e2eac38b0333ab7ebf4001cb4c3cd46b0.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 157 (
    name: Images in Comments
    alias: IMAGES-IN-COMMENTS
    title: Images in Comments
    pageGroup: @users
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            .no-item-ui {
              --a-field-input-border-width: 0px;
              --a-field-input-background-color: transparent;
            }
            
            .overline {
              color: var(--ut-region-text-color, var(--ut-component-text-default-color));
            }
            ```
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

    region images-in-comments (
        name: Images in Comments
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        chartLayout {
            height: 400
        }
        performance {
            lazyLoading: true
        }
        multiSeriesChartData {
            fillGapsInChartData: false
        }
        settings {
            timeAxisType: enabled
        }
        legend {
            position: bottom
        }

        series comments-with-images (
            name: Comments with Images
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select count(unique image_ref_id) cnt, display_month
                      from (
                    select image_ref_id,
                           trunc(created,'MM') display_month
                      from sp_comment_images
                    )
                     group by display_month
                     order by display_month
                    ```
            }
            columnMapping {
                label: DISPLAY_MONTH
                value: CNT
            }
        )

        series total-images-in-comments (
            name: Total Images in Comments
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select count(*) cnt, trunc(created,'MM') display_month
                      from sp_comment_images
                     group by trunc(created,'MM')
                     order by trunc(created,'MM')
                    ```
            }
            columnMapping {
                label: DISPLAY_MONTH
                value: CNT
            }
        )

        axis x (
            name: x
            value {
                format: dateMedium
                pattern: MMM yyyy
            }
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            value {
                format: decimal
                decimalPlaces: 0
                formatScaling: none
            }
            minorTicks {
                show: false
            }
        )

    )

    button up (
        buttonName: UP
        label: Navigate Up
        layout {
            sequence: 10
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
                page: 41
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
