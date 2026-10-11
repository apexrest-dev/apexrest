# All Restaurants — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00006-all-restaurants.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a2315cd556554f3abb00f113eacf9ad51599d0cd137415e597126ab11182ee6e.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 6 (
    name: All Restaurants
    alias: ALL-RESTAURANTS
    title: All Restaurants
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
        formAutoComplete: true
    }

    region all-restaurants (
        name: All Restaurants
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select r.id,
                       r.logo_url as image,
                       r.name as name,
                       c.name as category,
                       r.rating,
                       r.delivery_time,
                       r.delivery_time + 10 delivery_time_estimated,
                       r.delivery_fee
                  from sample_restaurant r,
                       sample_restaurant_categories c
                 where c.id = r.category_id
                 order by id
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
            ]
        }
        accessibility {
            landmarkType: region
        }
        componentAppearance {
            display: report
        }
        settings {
            title: &NAME.
            description:
                ```html
                {if !=DELIVERY_FEE/}Free Delivery{else/}$&DELIVERY_FEE. Delivery Fee{endif/}<br />
                &DELIVERY_TIME.-&DELIVERY_TIME_ESTIMATED. min
                ```
            displayAvatar: true
            displayBadge: true
        }
        plugin-avatar {
            type: image
            image: {
                type: url
                url: #APP_FILES#&IMAGE.
            }
            size: medium
        }
        plugin-badge {
            label: &RATING.
            value: RATING
            style: subtle
            shape: circular
            columnWidth: small
            position: end
            alignment: end
        }

        column CATEGORY (
            layout {
                sequence: 150
            }
            source {
                databaseColumn: CATEGORY
                dataType: varchar2
            }
        )

        column DELIVERY_FEE (
            layout {
                sequence: 120
            }
            source {
                databaseColumn: DELIVERY_FEE
                dataType: number
            }
        )

        column DELIVERY_TIME (
            layout {
                sequence: 130
            }
            source {
                databaseColumn: DELIVERY_TIME
                dataType: number
            }
        )

        column DELIVERY_TIME_ESTIMATED (
            layout {
                sequence: 160
            }
            source {
                databaseColumn: DELIVERY_TIME_ESTIMATED
                dataType: number
            }
        )

        column ID (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: ID
                dataType: number
                primaryKey: true
            }
        )

        column IMAGE (
            layout {
                sequence: 140
            }
            source {
                databaseColumn: IMAGE
                dataType: varchar2
            }
        )

        column NAME (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: NAME
                dataType: varchar2
            }
        )

        column RATING (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: RATING
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
                    page: 5
                    items: {
                        P5_RESTAURANT_ID: &ID.
                    }
                }
            }
        )

    )

)


````
