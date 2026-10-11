# for question image display — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00180-for-question-image-display.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f8d6fb0fd2b79b59fd015c7ac5f3761d286e50daa1b04e6582175c1f4cd5ea97.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 180 (
    name: for question image display
    alias: FOR-QUESTION-IMAGE-DISPLAY
    title: for question image display
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region region (
        name: region
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        serverSideCondition {
            type: expression
            plsqlExpression: 1 = 2
        }
    )

    pageItem P180_ID (
        type: hidden
        layout {
            sequence: 10
            region: @region
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: ID
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P180_IMAGE_BLOB (
        type: fileUpload
        label {
            label: Image
            alignment: right
        }
        display {
            displayDownloadLink: false
        }
        storage {
            mimeTypeColumn: IMAGE_MIMETYPE
            filenameColumn: IMAGE_FILENAME
            charSetColumn: IMAGE_CHARSET
            bobLastUpdatedColumn: IMAGE_LAST_UPDATED
        }
        layout {
            sequence: 20
            region: @region
            slot: regionBody
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 60
        }
        validation {
            maxLength: 4000
        }
        source {
            type: databaseColumn
            databaseColumn: IMAGE_BLOB
            used: always
        }
    )

    process fetch-row-from-eba-qpoll-questions (
        name: Fetch Row from EBA_QPOLL_QUESTIONS
        type: autoRowFetch
        source {
            tableName: EBA_QPOLL_QUESTIONS
            pkColumn: ID
            pkItem: P180_ID
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 13024700949299606967
        }
    )

    process raise-error (
        name: raise error
        type: executeCode
        source {
            plsqlCode: raise_application_error(-20001,'This page is not runnable by this application');
        }
        execution {
            sequence: 20
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 13024710695739754564
        }
    )

)


````
