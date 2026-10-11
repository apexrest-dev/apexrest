# Session Ended — Qask

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/qask/apexlang/qask/pages/p00012-session-ended.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 5f547590710d9133260aed634baa478730a766a23299444f06628505654b8a4e.

Application dependency inventory: oracle:26.2:public-template/qask/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 12 (
    name: Session Ended
    alias: SESSION-ENDED
    title: Session Ended
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
    }
    comments {
        comments: Page used to indicate a question and answer session is now closed
    }

    region thanks-for-participating (
        name: Thanks for participating!
        type: staticContent
        source {
            htmlCode: This qAsk session (<em>&SESSION_CODE.</em>) has ended. Thank you for your participation.
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--noIcon
                t-Alert--info
            ]
            cssClasses: u-tC
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    button ok (
        buttonName: OK
        label: OK
        layout {
            sequence: 20
            region: @thanks-for-participating
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
            cssClasses: mnw120
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    branch (
        name: home if no session or session is not closed
        execution {
            sequence: 10
            point: beforeHeader
        }
        behavior {
            target: {
                page: 1
            }
        }
        serverSideCondition {
            type: expression
            plsqlExpression:
                ```plsql
                :SESSION_ID is null or 
                qask_util.get_session_status (
                    p_session_id => :SESSION_ID) != 'CLOSED'
                ```
        }
    )

)


````
