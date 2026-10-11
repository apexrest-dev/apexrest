# Prepare Movie Data (Step 4: Overview) — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00014-prepare-movie-data-4.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0f60621db7cece7f4da948ca96479755cabfc123df9517c51cadea4d3e43265b.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 14 (
    name: Prepare Movie Data (Step 4: Overview)
    alias: PREPARE-MOVIE-DATA-4
    title: Prepare Movie Data
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }

    region movie-vector-search-navigation (
        name: Movie Vector Search Navigation
        type: list
        source {
            list: @vector-search-movie-data
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                t-MediaList--showBadges
            ]
        }
    )

    region progress (
        name: Progress
        type: list
        source {
            list: @ai-generated-data-progress
        }
        layout {
            sequence: 30
            slot: dialogHeader
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-bottom-md
            ]
        }
        componentAppearance {
            listTemplate: @/wizard-progress
            templateOptions: [
                #DEFAULT#
                t-WizardSteps--displayCurrentLabelOnly
            ]
        }
    )

    region ready-for-vector-search (
        name: Ready for Vector Search
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Vector embeddings for your data have been generated! You can now perform vector searches on your data.</p>
                <p>Select a vector search example below to get started.</p>
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--defaultIcons
                t-Alert--success
            ]
        }
        serverSideCondition {
            type: rowsReturned
            sqlQuery: select 1 from eba_vector_moviedata where embedding_vector is not null and rownum = 1
        }
    )

)


````
