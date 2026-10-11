# for section image dislay — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00380-for-section-image-dislay.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 798900def70f6167edde9c153acae95bc32ac2fe833fc679ce97baadd407d0fc.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 380 (
    name: for section image dislay
    alias: FOR-SECTION-IMAGE-DISLAY
    title: for section image dislay
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
        name: REGION
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

    pageItem P380_ID (
        type: hidden
        layout {
            sequence: 5
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

    pageItem P380_IMAGE_BLOB (
        type: fileUpload
        label {
            label: Image
            alignment: left
        }
        storage {
            mimeTypeColumn: IMAGE_MIMETYPE
            filenameColumn: IMAGE_FILENAME
            charSetColumn: IMAGE_CHARSET
            bobLastUpdatedColumn: IMAGE_LAST_UPDATED
        }
        layout {
            sequence: 10
            region: @region
            slot: regionBody
            alignment: left
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
        default {
            type: static
            staticValue: Download
        }
    )

    process fetch-row-from-eba-qpoll-sections (
        name: Fetch Row from EBA_QPOLL_SECTIONS
        type: autoRowFetch
        source {
            tableName: EBA_QPOLL_SECTIONS
            pkColumn: ID
            pkItem: P380_ID
        }
        execution {
            sequence: 20
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 13024819548951116038
        }
    )

    process raise-error (
        name: raise error
        type: executeCode
        source {
            plsqlCode: raise_application_error(-20001,'This page is not runnable by this application');
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 13024818644547105671
        }
    )

)


````
