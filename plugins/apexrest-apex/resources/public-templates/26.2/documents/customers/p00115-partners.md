# Partners — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00115-partners.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e673857e17d98b66c3f53f2078cc22b884e6d7775e8f3f1591c6ca18e84b664c.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 115 (
    name: Partners
    alias: PARTNERS
    title: Partners
    pageGroup: @products
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
    config {
        buildOption: @partners
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb-2
        }
        layout {
            sequence: 20
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

    region implementation-partners (
        name: Implementation Partners
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select p.id partner_id,
                    p.name partner_name,
                    p.website,
                    p.description,
                    (select count(*) from eba_cust_cust_partner_ref r where r.PARTNER_ID = p.id) customers,
                    (select listagg(customer_id,',') within group (order by customer_id desc) from EBA_CUST_CUST_PARTNER_REF r where r.partner_ID = p.id) as cust_ids
                from 
                     eba_cust_impl_partners p
                
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
        advanced {
            htmlDomId: PRODUCTS
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 10000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results.
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
            savedReportMappingIdentifier: 16720911765133612149
        }

        column CUSTOMERS (
            type: link
            heading {
                heading: Customers
                alignment: end
            }
            layout {
                sequence: 50
                columnAlignment: end
            }
            link {
                target: {
                    page: 59
                    items: {
                        P59_IMP_PARTNER: #PARTNER_ID#
                        IRIN_ID: \#CUST_IDS#\
                    }
                    clearCache: [
                        RIR
                        CIR
                    ]
                    action: resetPagination
                }
                linkText: #CUSTOMERS#
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: F
            }
        )

        column CUST_IDS (
            type: hidden
            heading {
                heading: Cust ids
            }
            layout {
                sequence: 60
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: G
            }
            security {
                escapeSpecialChars: false
            }
        )

        column DESCRIPTION (
            type: plainText
            heading {
                heading: Description
            }
            layout {
                sequence: 20
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: B
            }
        )

        column PARTNER_ID (
            type: link
            heading {
                heading: Edit
                alignment: center
            }
            layout {
                sequence: 10
                columnAlignment: center
            }
            link {
                target: {
                    page: 107
                    items: {
                        P107_ID: #PARTNER_ID#
                    }
                    clearCache: 107
                    action: resetPagination
                }
                linkText: <img src="#IMAGE_PREFIX#app_ui/img/icons/apex-edit-pencil.png" class="apex-edit-pencil" alt="Edit #PARTNER_NAME#">
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: C
            }
            enableUsersTo {
                hide: false
                sort: false
                filter: false
                highlight: false
                controlBreak: false
                aggregate: false
                compute: false
                chart: false
                groupBy: false
                pivot: false
            }
            security {
                authorizationScheme: @contribution-rights
            }
        )

        column PARTNER_NAME (
            type: plainText
            heading {
                heading: Partner Name
            }
            layout {
                sequence: 30
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: D
            }
        )

        column WEBSITE (
            type: plainText
            heading {
                heading: Website
            }
            layout {
                sequence: 40
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: E
            }
        )

        savedReport 167209222 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn CUSTOMERS (
                sequence: 4
            )

            displayColumn CUST_IDS (
                sequence: 5
            )

            displayColumn PARTNER_ID (
                sequence: 1
            )

            displayColumn PARTNER_NAME (
                sequence: 2
            )

            displayColumn WEBSITE (
                sequence: 3
            )

            sort (
                column: CUSTOMERS
                sort {
                    direction: desc
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

    button create-partner (
        buttonName: CREATE_PARTNER
        label: Create Partner
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
                page: 107
                clearCache: 107
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
        security {
            authorizationScheme: @contribution-rights
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @implementation-partners
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--noUI
                t-Button--iconLeft
            ]
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 115
                clearCache: RIR
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction refresh-ir-after-add (
        name: Refresh IR after add
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: button
            button: @create-partner
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @implementation-partners
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction refresh-ir-after-edit (
        name: Refresh IR after edit
        execution {
            sequence: 20
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @implementation-partners
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @implementation-partners
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    computation last-view (
        itemName: LAST_VIEW
        execution {
            sequence: 10
            point: beforeHeader
        }
        computation {
            type: staticValue
            staticValue: 44
        }
    )

)


````
