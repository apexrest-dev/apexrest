# Orders — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00009-orders.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 20913e0ae57e3b166ddc6c491420def1fad947cb98c6bafab4660a99d933a735.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9 (
    name: Orders
    alias: ORDERS
    title: Orders
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            /* APEX RDS */
            .apex-rds {
              --ut-tabs-item-padding-x: 0rem; /* Remove Tab Padding */
            
              gap: 1rem; /* Add Gap Between Tabs */
            }
            ```
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region in-progress (
        name: In Progress
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select o.order_id,
                       o.order_datetime,
                       initcap( o.order_status ) as order_status
                  from sample_restaurant_orders o
                 where order_status = 'IN PROGRESS'
                   and ( session_id is null or session_id = :APP_SESSION )
                 order by order_datetime desc
                ```
        }
        layout {
            sequence: 10
            parentRegion: @orders
            slot: subRegions
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-Region--removeHeader js-removeLandmark
                margin-top-md
            ]
        }
        accessibility {
            landmarkType: region
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            display: report
        }
        settings {
            title: Order #&ORDER_ID.
            description: &ORDER_STATUS. • &ORDER_DATETIME.
            displayAvatar: true
        }
        plugin-avatar {
            type: image
            image: {
                type: url
                url: #APP_FILES#orders/order-progress.png
            }
        }
        messages {
            whenNoDataFound: No Orders Found!
        }

        column ORDER_DATETIME (
            layout {
                sequence: 30
            }
            source {
                databaseColumn: ORDER_DATETIME
                dataType: timestamp
            }
            appearance {
                formatMask: FMMonth DD, YYYY
            }
        )

        column ORDER_ID (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: ORDER_ID
                dataType: number
            }
        )

        column ORDER_STATUS (
            layout {
                sequence: 60
            }
            source {
                databaseColumn: ORDER_STATUS
                dataType: varchar2
            }
        )

        action action (
            position: fullRowLink
            layout {
                sequence: 10
            }
            behavior {
                target: {
                    page: 10
                    items: {
                        P10_ORDER_ID: &ORDER_ID.
                    }
                }
            }
        )

    )

    region orders (
        name: Orders
        type: regionDisplaySelector
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h1
            ]
        }
        settings {
            includeShowAll: false
        }
    )

    region past-orders (
        name: Past Orders
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select o.order_id,
                       o.order_datetime,
                       initcap( o.order_status ) as order_status
                  from sample_restaurant_orders o
                 where order_status = 'PAST ORDERS'
                   and ( session_id is null or session_id = :APP_SESSION )
                 order by order_status desc, order_datetime desc
                ```
        }
        layout {
            sequence: 20
            parentRegion: @orders
            slot: subRegions
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-Region--removeHeader js-removeLandmark
                margin-top-md
            ]
        }
        accessibility {
            landmarkType: region
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            display: report
        }
        settings {
            title: Order #&ORDER_ID.
            description: &ORDER_STATUS. • &ORDER_DATETIME.
            displayAvatar: true
        }
        plugin-avatar {
            type: image
            image: {
                type: url
                url: #APP_FILES#orders/past-order.png
            }
        }
        messages {
            whenNoDataFound: No Orders Found!
        }

        column ORDER_DATETIME (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: ORDER_DATETIME
                dataType: timestamp
            }
            appearance {
                formatMask: FMMonth DD, YYYY
            }
        )

        column ORDER_ID (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: ORDER_ID
                dataType: number
            }
        )

        column ORDER_STATUS (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: ORDER_STATUS
                dataType: varchar2
            }
        )

        action action (
            position: fullRowLink
            layout {
                sequence: 10
            }
            behavior {
                target: {
                    page: 10
                    items: {
                        P10_ORDER_ID: &ORDER_ID.
                    }
                }
            }
        )

    )

    dynamicAction send-push-notification (
        name: Send Push Notification
        execution {
            sequence: 10
        }
        when {
            event: ready
        }
        serverSideCondition {
            type: expression
            plsqlExpression: apex_pwa.has_push_subscription
        }

        action native-execute-plsql-code (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    apex_pwa.send_push_notification (
                        p_user_name      => :APP_USER,
                        p_title          => 'Message from delivery driver',
                        p_body           => 'Sorry, I ate your food :(',
                        p_icon_url       => apex_mail.get_instance_url || '#APP_FILES#icons/app-icon-512.png' );
                    apex_pwa.push_queue;
                    ```
            }
            execution {
                sequence: 10
            }
        )

    )

)


````
