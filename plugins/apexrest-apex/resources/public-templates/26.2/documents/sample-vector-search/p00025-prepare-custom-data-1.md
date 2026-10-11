# Prepare Custom Data — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00025-prepare-custom-data-1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0880279a691f3609166e6d6269a2b5c6e1630bf4845eaf5626171eaff36fa74f.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 25 (
    name: Prepare Custom Data
    alias: PREPARE-CUSTOM-DATA-1
    title: Prepare Custom Data
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        width: 1024px
    }

    region about-this-page (
        name: About This Page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This wizard allows you to upload your own data so that you can try vector search.</p>
                <p>Your uploaded file must meet the following requirements. Download the <a href="#APP_IMAGES#SAMPLE.csv"><strong>SAMPLE.csv</strong></a> file as an example.</p>
                <ul>
                    <li>No header row is required.</p>
                    <li>The first three columns will serve as title, subtitle and description for displaying the search results.</li>
                    <li>Only the first 10 columns will be used for data loading and generating vector embeddings. Each column allows strings up to 255 bytes.</li>
                    <li>You may upload data in .csv, .xslx, or .txt format.</li>
                </ul>
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
    )

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
    )

    region loaded-file (
        name: Loaded File
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @upload-file
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P25_FILE
        }
        settings {
            outputAs: text
        }
    )

    region progress (
        name: Progress
        type: list
        source {
            list: @upload-data-progress
        }
        layout {
            sequence: 10
            slot: dialogHeader
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            listTemplate: @/wizard-progress
            templateOptions: [
                #DEFAULT#
                t-WizardSteps--displayCurrentLabelOnly
            ]
        }
    )

    region rds (
        name: RDS
        type: regionDisplaySelector
        layout {
            sequence: 40
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
    )

    region upload-a-file (
        name: Upload a File
        type: staticContent
        layout {
            sequence: 20
            parentRegion: @upload-file
            slot: subRegions
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    region upload-file (
        name: Upload File
        type: staticContent
        layout {
            sequence: 50
            slot: contentBody
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noUI
                t-Region--scrollBody
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P25_FILE (
        type: fileUpload
        label {
            label: Upload a File
            alignment: left
        }
        display {
            displayAs: blockDropzone
            dropzoneDesc: Supported formats CSV, TXT, XLSX
        }
        storage {
            type: appTempFiles
            fileTypes: .csv,.txt,.xlsx
            maxFileSize: 1000
        }
        layout {
            sequence: 10
            region: @upload-a-file
            slot: regionBody
            alignment: left
            labelColumnSpan: 0
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--stretchInputs
                margin-right-none
            ]
        }
        validation {
            valueRequired: true
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P25_FILE_ERROR_ROW_COUNT (
        type: hidden
        layout {
            sequence: 20
            region: @upload-a-file
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P25_FILE_NAME (
        type: hidden
        layout {
            sequence: 20
            region: @loaded-file
            slot: regionBody
        }
        default {
            type: static
            staticValue: 'EBA_VECTOR_DATATABLE'
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 10
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    computation p25-file-name (
        itemName: P25_FILE_NAME
        execution {
            sequence: 5
            point: beforeHeader
        }
        computation {
            sqlQuery:
                ```sql
                select filename
                  from apex_application_temp_files 
                 where name = :P25_FILE;
                ```
        }
        serverSideCondition {
            type: expression
            plsqlExpression: :P25_FILE is not null and :REQUEST = 'LOAD_FILE'
        }
    )

    branch (
        name: Go To Data Preview
        execution {
            sequence: 30
        }
        behavior {
            target: {
                page: 26
            }
        }
        serverSideCondition {
            whenButtonPressed: @next
        }
    )

)


````
