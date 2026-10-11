# Full Card Action — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00015-full-card-aciton.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c9e288aa585416091f36ea5d6eb4667daf503f923d9a300204d95d370256f8df.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 15 (
    name: Full Card Action
    alias: FULL-CARD-ACITON
    title: &APP_NAME. - Full Card Action
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>Actions can be defined for the full card.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--scrollBody
            ]
            icon: fa-link
            renderComponents: belowContent
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 30
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

    region card-actions (
        name: Card Actions
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
        }
        orderBy {
            type: item
            item: {
                itemName: P15_ORDER_BY
                orderBys: {
                    ENAME: "ENAME" asc
                    JOB: "JOB" asc
                }
            }
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleB
            ]
        }
        card {
            primaryKeyColumn1: EMPNO
        }
        title {
            column: ENAME
        }
        subtitle {
            column: JOB
        }
        iconAndBadge {
            iconSource: imageBlobColumn
            imageColumn: PROFILE_IMAGE
            iconDescription: &ENAME. - &JOB.
        }
        blobAttributes {
            mimeTypeColumn: MIMETYPE
            lastUpdatedColumn: IMAGE_LAST_UPDATE
        }

        action action (
            type: fullCard
            layout {
                sequence: 10
            }
            behavior {
                target: {
                    page: 14
                    items: {
                        P14_EMPNO: &EMPNO.
                    }
                    clearCache: 14
                }
            }
        )

    )

    pageItem P15_ORDER_BY (
        type: selectList
        label {
            label: Order By
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Ename;ENAME,Job;JOB
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @card-actions
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        default {
            type: static
            staticValue: ENAME
        }
    )

)


````
