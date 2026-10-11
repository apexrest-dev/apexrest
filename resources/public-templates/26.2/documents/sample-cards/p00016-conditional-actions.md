# Conditional Actions — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00016-conditional-actions.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 17d2ff88eef559dd9438895952733697f61da17e31d65130e865f19ce2f19643.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 16 (
    name: Conditional Actions
    alias: CONDITIONAL-ACTIONS
    title: &APP_NAME. - Conditional Actions
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
            htmlCode:
                ```html
                <p>You can add multiple actions per Card.  Also, an action can display conditionally based on column values for each row.</p>
                <p>This example displays 2 actions per card.  Title action displays without any condition.  Edit button action displays only if employee belongs to department 10.</p>
                ```
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

    region conditional-card-actions (
        name: Conditional Card Actions
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
        }
        orderBy {
            type: item
            item: {
                itemName: P16_ORDER_BY
                orderBys: {
                    ENAME: "ENAME" asc
                    JOB: "JOB" asc
                    DEPTNO: "DEPTNO" asc
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
            badgeColumn: DEPTNO
            badgeLabel: "Department: "
        }
        blobAttributes {
            mimeTypeColumn: MIMETYPE
            lastUpdatedColumn: IMAGE_LAST_UPDATE
        }

        action action (
            type: title
            layout {
                sequence: 20
            }
            behavior {
                target: {
                    page: 16
                }
            }
            security {
                authorizationScheme: @administration-rights
            }
        )

        action action-2 (
            label: Edit
            layout {
                sequence: 30
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
            appearance {
                displayType: textWithIcon
                icon: fa-file-o
                hot: true
            }
            serverSideCondition {
                type: expression
                plsqlExpression: :JOB = 'DEVEOPER' or :DEPTNO = 10
            }
        )

    )

    pageItem P16_ORDER_BY (
        type: selectList
        label {
            label: Order By
            alignment: left
        }
        lov {
            type: staticValues
            staticValues: STATIC2:Ename;ENAME,Job;JOB,Deptno;DEPTNO
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @conditional-card-actions
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
            staticValue: DEPTNO
        }
    )

)


````
