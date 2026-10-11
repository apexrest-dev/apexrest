# Ticket Details — Json Sample Sources

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/json-sample-sources/apexlang/json-sample-sources/pages/p00411-ticket-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f54a7e22db4b326edee813b3cc96815682d982cd6a15837758405221766c8000.

Application dependency inventory: oracle:26.2:public-template/json-sample-sources/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 411 (
    name: Ticket Details
    alias: TICKET-DETAILS
    title: Ticket Details
    pageGroup: @data-presentation
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    pageItem P411_CREATION_DATE (
        type: displayOnly
        label {
            label: Creation Date
            alignment: left
        }
        layout {
            sequence: 60
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            formatMask: DD-MON-YYYY
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_CUSTOMER_NAME (
        type: displayOnly
        label {
            label: Customer Name
            alignment: left
        }
        layout {
            sequence: 20
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_ORDER_NUMBER (
        type: displayOnly
        label {
            label: Order Number
            alignment: left
        }
        layout {
            sequence: 70
            slot: contentBody
            alignment: left
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_PRIORITY (
        type: displayOnly
        label {
            label: Priority
            alignment: left
        }
        layout {
            sequence: 40
            slot: contentBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_PRODUCT_NAME (
        type: displayOnly
        label {
            label: Product Name
            alignment: left
        }
        layout {
            sequence: 90
            slot: contentBody
            alignment: left
            startNewRow: false
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_STATUS (
        type: displayOnly
        label {
            label: Status
            alignment: left
        }
        layout {
            sequence: 30
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_STORE_NAME (
        type: displayOnly
        label {
            label: Store Name
            alignment: left
        }
        layout {
            sequence: 80
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        security {
            sessionStateProtection: restricted
        }
    )

    pageItem P411_TICKET_ID (
        type: hidden
        layout {
            sequence: 10
            slot: contentBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    process show-ticket-details (
        name: Show Ticket Details
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    select c.full_name,
                           json_value(t.data, '$.status'),
                           json_value(t.data, '$.priority'),
                           to_char(
                               to_date(json_value(t.data, '$.created_at'), 'YYYY-MM-DD'),
                               'DD-MON-YYYY',
                               'NLS_DATE_LANGUAGE=English' ),
                           p.product_name,
                           s.store_name,
                           json_value(t.data, '$.concern.order_id')
                      into :P411_CUSTOMER_NAME,
                           :P411_STATUS,
                           :P411_PRIORITY,
                           :P411_CREATION_DATE,
                           :P411_PRODUCT_NAME,
                           :P411_STORE_NAME,
                           :P411_ORDER_NUMBER
                      from eba_demo_json_support_ticket t,
                           eba_demo_json_customers      c,
                           eba_demo_json_products       p,
                           eba_demo_json_stores         s
                     where c.customer_id(+) = json_value(t.data, '$.customer_id' returning number)
                       and p.product_id(+)  = json_value(t.data, '$.concern.product_id' returning number)
                       and s.store_id(+)    = json_value(t.data, '$.concern.store_id' returning number)
                       and json_value(t.data, '$._id') = :P411_TICKET_ID;
                end;
                
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 11883857790269307
        }
    )

)


````
