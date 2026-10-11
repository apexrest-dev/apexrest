# Basic Vector Search — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00015-basic-vector-search1.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b7c689a408afc8562635d638af546aa3d4b31a36c040b48b2d53c370f5c06592.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 15 (
    name: Basic Vector Search
    alias: BASIC-VECTOR-SEARCH1
    title: Basic Vector Search
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }

    region about-basic-vector-search (
        name: About Basic Vector Search
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This example performs a vector search on the <em>TITLE</em>, <em>MOVIEDESCRIPTION</em>, and <em>ACTORS</em> columns and returns movies that are similar to your search terms.</p>
                
                <p>Vector search leverages <strong>context aware embeddings</strong> to identify similar results beyond simple keyword matching. This results in more accurate and meaningful results.</p>
                
                <p>Note that performing a vector search will always yield results, regardless of the quality of the match. The best matches will be displayed at the top of the resultset.</p>
                
                <p>To search, start typing your query, and the results will be displayed immediately. Here are a few example search terms to get started:</p>
                
                <ul>
                    <li>Subconscious Mind</li>
                    <li>Darth Vader</li>
                    <li>Superheroes</li>
                </ul>
                ```
        }
        layout {
            sequence: 30
            slot: body
            startNewRow: false
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--textContent
                t-Region--scrollBody
            ]
        }
        accessibility {
            landmarkType: complementary
        }
        comments {
            comments:
                ```
                
                
                ```
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 40
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

    region content (
        name: Content
        type: staticContent
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region search (
        name: Search
        type: staticContent
        layout {
            sequence: 10
            parentRegion: @content
            slot: subRegions
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
        accessibility {
            landmarkType: search
            landmarkLabel: Basic Vector
        }
    )

    region search-results-oci (
        name: Search Results OCI
        type: search
        layout {
            sequence: 20
            parentRegion: @content
            slot: subRegions
        }
        appearance {
            template: @/search-results-container
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: item=value
            item: CURRENT_AI_PROVIDER
            value: OCI
        }
        settings {
            searchPageItem: P15_SEARCH
        }
        messages {
            noQueryEnteredMessage: Please enter a search term.
            noResultsFoundMessage: No results found.
        }

        searchSource basic-vector-search-oci (
            name: Basic Vector Search OCI
            searchConfig: @OCI_BASIC_VECTOR_SEARCH
            layout {
                sequence: 10
            }
        )

    )

    region search-results-openai (
        name: Search Results OPENAI
        type: search
        layout {
            sequence: 30
            parentRegion: @content
            slot: subRegions
        }
        appearance {
            template: @/search-results-container
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: item=value
            item: CURRENT_AI_PROVIDER
            value: OPENAI
        }
        settings {
            searchPageItem: P15_SEARCH
        }
        messages {
            noQueryEnteredMessage: Please enter a search term.
            noResultsFoundMessage: No results found.
        }

        searchSource basic-vector-search-openai (
            name: Basic Vector Search OPENAI
            searchConfig: @OPENAI_BASIC_VECTOR_SEARCH
            layout {
                sequence: 10
            }
        )

    )

    pageItem P15_SEARCH (
        type: textField
        label {
            label: Search
            alignment: left
        }
        layout {
            sequence: 10
            region: @search
            slot: regionBody
            alignment: left
            labelColumnSpan: 0
        }
        appearance {
            template: @/hidden
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--stretchInputs
                t-Form-fieldContainer--xlarge
            ]
            cssClasses: [
                mxw800
                t-Form-fieldContainer--noPadding
            ]
            icon: fa-search
            width: 30
            valuePlaceholder: Enter your search term, e.g. Subconscious Mind or Darth Vader
        }
    )

)


````
