# REST Data Source — Sample Application Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-application-search/apexlang/sample-application-search/pages/p00103-rest-data-source.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 53da64a8fc6d163439c4c16cd7c40fc280d88ae3536a01e823b856530e4e3b09.

Application dependency inventory: oracle:26.2:public-template/sample-application-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 103 (
    name: REST Data Source
    alias: REST-DATA-SOURCE
    title: REST Data Source
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    errorHandling {
        errorHandlingFunctionName: eba_demo_search_error_handling
    }

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

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This page demonstrates how to use a <strong>REST Data Source</strong> as the data source for a Search Configuration. The Search Region is configured with two Search Configurations: <strong>Company Search Configuration</strong> (which uses the Companies REST Data Source) and <strong>Movie Search Configuration</strong> (which uses the Movies REST Data Source).</p>
                <p>To perform a search, simply enter your search term into the search box (e.g., "<strong>Netflix</strong>") and press <em>&crarr;Enter</em>. The search configurations will execute, and all relevant results for companies and movies will be displayed.</p>
                ```
        }
        layout {
            sequence: 40
            slot: body
            startNewRow: false
            columnSpan: 4
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        security {
            authorizationScheme: !@web-credentials-not-provided
        }
    )

    region search (
        name: Search
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--noUI
                js-headingLevel-2
                t-Region--scrollBody
            ]
        }
        accessibility {
            landmarkType: search
            landmarkLabel: Movies and Companies
        }
        advanced {
            regionDisplaySelector: true
        }
        security {
            authorizationScheme: !@web-credentials-not-provided
        }
    )

    region search-results (
        name: Search Results
        type: search
        layout {
            sequence: 30
            slot: body
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/search-results-container
            templateOptions: #DEFAULT#
        }
        accessibility {
            useLandmark: false
        }
        security {
            authorizationScheme: !@web-credentials-not-provided
        }
        settings {
            searchPageItem: P103_SEARCH
            searchAsYouType: false
        }
        appearance {
            customLayout: true
            appearanceResultRowTemplate:
                ```html
                <div class="a-ResultsItem&RESULT_CSS_CLASSES!ATTR.">
                  {if ?ICON_VALUE/}
                    {case ICON_TYPE/}
                      {when INITIALS/}
                        <div class="a-ResultsItem-initials u-color-var">&ICON_VALUE.</div>
                      {when URL/}
                        <div class="a-ResultsItem-image"><img src="https://image.tmdb.org/t/p/w500&ICON_VALUE!ATTR." style="max-width:70px"  alt="&TITLE!ATTR." role="presentation" loading="lazy" /></div>
                      {when CLASS/}
                        <div class="a-ResultsItem-icon u-color-var"><span class="fa &ICON_VALUE!ATTR." aria-hidden="true"></span></div>
                    {endcase/}
                    {else/}
                        <div class="a-ResultsItem-image"><img src="#APP_FILES#image_not_found.png" style="max-width:70px"  alt="&TITLE!ATTR." role="presentation" loading="lazy" /></div>
                  {endif/}
                  <div class="a-ResultsItem-content">
                    <div class="a-ResultsItem-header">
                      {if ?LINK/}
                        <span class="a-ResultsItem-title"><a href="&LINK!ATTR.">&TITLE.</a></span>
                      {else/}
                        <span class="a-ResultsItem-title">&TITLE.</span>
                      {endif/}
                      {if ?BADGE/}<span class="a-ResultsItem-badge" >&BADGE.</span>{endif/}
                    </div>
                    {if ?SUBTITLE/}<div class="a-ResultsItem-subTitle">&SUBTITLE.</div>{endif/}
                    {if ?DESCRIPTION/}<div class="a-ResultsItem-description">&DESCRIPTION.</div>{endif/}
                    {if ?RELEASEDATE/}<div class="a-ResultsItem-misc">Release Date: &RELEASEDATE.</div>{endif/}
                
                ```
        }
        sort {
            overallSort: title
            sortSortDirection: descending
        }
        messages {
            noQueryEnteredMessage: Enter a query to search for movies or companies.
            noResultsFoundMessage: No movies or companies found.
        }

        searchSource company-search-configuration (
            name: Company Search Configuration
            searchConfig: @company
            layout {
                sequence: 10
            }
            appearance {
                maxResults: 5
            }
        )

        searchSource movie-search-configuration (
            name: Movie Search Configuration
            searchConfig: @movie
            layout {
                sequence: 20
            }
            appearance {
                maxResults: 5
            }
        )

    )

    region web-credentials-not-provided (
        name: Web Credentials not provided
        type: staticContent
        source {
            htmlCode: This page relies on a REST Data Source. You need to provide your own API key for <strong>themoviedb.org</strong>.
        }
        layout {
            sequence: 50
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--horizontal
                t-Alert--defaultIcons
                t-Alert--warning
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        security {
            authorizationScheme: @web-credentials-not-provided
        }
    )

    pageItem P103_SEARCH (
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
                t-Form-fieldContainer--large
            ]
            icon: fa-search
            valuePlaceholder: Enter your search term, e.g. 'Netflix'
        }
        advanced {
            warnOnUnsavedChanges: ignore
        }
    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 20
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-right
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 200
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button prev (
        buttonName: PREV
        label: Previous
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
        }
        appearance {
            buttonTemplate: @/icon
            templateOptions: #DEFAULT#
            icon: fa-angle-left
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 102
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button provide-credentials (
        buttonName: PROVIDE_CREDENTIALS
        label: Provide Credentials
        layout {
            sequence: 10
            region: @web-credentials-not-provided
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 503
                clearCache: 503
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
