# Vector and Oracle Text — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00033-vector-and-oracle-text.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 35b289fa368cd920b829ecca6aba11c5e4b99445fdf200c4f744a72eeb693e9e.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 33 (
    name: Vector and Oracle Text
    alias: VECTOR-AND-ORACLE-TEXT
    title: Vector and Oracle Text
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }

    region about-vector-and-oracle-text-search (
        name: About Vector and Oracle Text Search
        type: staticContent
        source {
            htmlCode:
                ```html
                <p><strong>Combine</strong> vector and Oracle Text search for better and more accurate results.</p>
                
                <p>A text search is performed using Oracle Text, and the results returned by this search are ordered by descending vector similarity.</p>
                
                This approach can <strong>save computing time</strong> with large datasets by using text search as a pre-filter and then ordering results based on vector similarity.</p>
                
                <p>To search, start typing your query, and the results will be displayed immediately. Here are a few example search terms to get started:</p>
                
                <ul>
                    <li>Testing</li>
                    <li>Spreadsheet</li>
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
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 10
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

    region oracle-text-not-available (
        name: Oracle Text not available
        type: staticContent
        source {
            htmlCode: <p>This feature cannot be used because Oracle Text is not available in this instance.</p>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--defaultIcons
                t-Alert--danger
            ]
        }
        serverSideCondition {
            type: noRowsReturned
            sqlQuery:
                ```sql
                select 1 
                  from sys.all_objects
                 where owner       = 'CTXSYS' 
                   and object_name = 'CTX_DDL' 
                   and rownum      = 1;
                ```
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
            landmarkLabel: Vector and Oracle Text
        }
    )

    region search-results (
        name: Search Results
        type: search
        source {
            pageItemsToSubmit: P33_SEARCH
        }
        layout {
            sequence: 30
            parentRegion: @content
            slot: subRegions
        }
        appearance {
            template: @/search-results-container
            templateOptions: #DEFAULT#
        }
        settings {
            searchPageItem: P33_SEARCH
        }
        messages {
            noQueryEnteredMessage: Please enter your search term.
            noResultsFoundMessage: No results found.
        }

        searchSource oracle-text-and-vector-datatable (
            name: Oracle Text And Vector Datatable
            searchConfig: @oracle_text_search_and_vector_datatable
            layout {
                sequence: 10
            }
        )

    )

    pageItem P33_SEARCH (
        type: textField
        label {
            label: Search
            alignment: left
        }
        settings {
            subtype: search
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
            valuePlaceholder: Enter your search term, e.g. Testing
        }
        advanced {
            warnOnUnsavedChanges: ignore
        }
    )

)


````
