# Previous Validations — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00147-previous-validations.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a0695a413e6229b4a7d5bdfeff6f1b86e6d138b902cd7d79d360befe78c3eda7.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 147 (
    name: Previous Validations
    alias: PREVIOUS-VALIDATIONS
    title: Previous Validations
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: [
            #DEFAULT#
            ui-dialog--stretch
        ]
    }
    dialog {
        resizable: false
    }
    css {
        inline: ".t-Dialog-body {padding: 0; overflow: hidden;}"
    }
    help {
        helpText: No help is available for this page.
    }

    region previous-validations (
        name: Previous Validations
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select lower(v.created_by) as validated_by,
                  v.created validated,
                  v.verification_comment 
                from eba_sales_verifications v
                where (
                  (:P147_ENTITY_TYPE = 'OPPORTUNITY' and v.opp_id = :P147_ENTITY_ID)
                    or (:P147_ENTITY_TYPE = 'TERRITORY' and v.territory_id = :P147_ENTITY_ID)
                    or (:P147_ENTITY_TYPE = 'LEAD' and v.lead_id = :P147_ENTITY_ID)
                    or (:P147_ENTITY_TYPE = 'ACCOUNT' and v.cust_id = :P147_ENTITY_ID)
                    or (:P147_ENTITY_TYPE = 'CONTACT' and v.contact_id = :P147_ENTITY_ID)
                    or (:P147_ENTITY_TYPE = 'PRODUCT' and v.product_id = :P147_ENTITY_ID)
                )
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
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
        advanced {
            savedReportMappingIdentifier: 766147731623253939
        }

        column VALIDATED (
            type: plainText
            heading {
                heading: Validated
            }
            layout {
                sequence: 20
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: B
            }
        )

        column VALIDATED_BY (
            type: plainText
            heading {
                heading: Validated By
            }
            layout {
                sequence: 10
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: A
            }
        )

        column VERIFICATION_COMMENT (
            type: plainText
            heading {
                heading: Comment
            }
            layout {
                sequence: 30
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: C
            }
        )

        page {
            width: 8.5
            height: 11
            borderWidth: 0.5
            borderColor: #666666
        }
        columnHeadings {
            fontWeight: normal
            backgroundColor: #9bafde
        }
        columns {
            backgroundColor: #efefef
        }

        savedReport 7836650 (
            visibility: primaryDefault
            view {
                rowsPerPage: 50
            }

            displayColumn VALIDATED (
                sequence: 1
            )

            displayColumn VALIDATED_BY (
                sequence: 2
            )

            displayColumn VERIFICATION_COMMENT (
                sequence: 3
            )

            sort (
                column: VALIDATED
                sort {
                    direction: desc
                    sequence: 1
                }
            )

        )

    )

    pageItem P147_ENTITY_ID (
        type: hidden
        layout {
            sequence: 20
            region: @previous-validations
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P147_ENTITY_TYPE (
        type: hidden
        layout {
            sequence: 10
            region: @previous-validations
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
