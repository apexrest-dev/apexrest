# Movie Details — Sample Vector Search

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-vector-search/apexlang/sample-vector-search/pages/p00049-movie-details.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7ec862d574a4f8748dd563eda4f9b3a54e88aaced1194669eb1cfb21d8735519.

Application dependency inventory: oracle:26.2:public-template/sample-vector-search/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 49 (
    name: Movie Details
    alias: MOVIE-DETAILS
    title: Movie Details
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        width: 600
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region movie-details-report (
        name: Movie Details Report
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select title, moviedescription, actors, genre, release_date, rating
                  from eba_vector_moviedata
                 where id = :P49_SEARCH_ID
                ```
            pageItemsToSubmit: P49_SEARCH_ID
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        title {
            column: TITLE
        }
        subtitle {
            column: GENRE
        }
        body {
            column: MOVIEDESCRIPTION
        }
        secondaryBody {
            advancedFormatting: true
            htmlExpression:
                ```html
                &ACTORS. <br /><br />
                Release Date: &RELEASE_DATE.
                ```
        }
        iconAndBadge {
            badgeColumn: RATING
            badgeLabel: Rating
        }
    )

    pageItem P49_SEARCH_ID (
        type: hidden
        settings {
            valueProtected: false
        }
        layout {
            sequence: 10
            region: @movie-details-report
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button find-similar-movies (
        buttonName: FIND_SIMILAR_MOVIES
        label: Find Similar Movies
        layout {
            sequence: 30
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
            databaseAction: update
        }
    )

    process find-similar-movies (
        name: Find Similar Movies
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                begin
                    select moviedescription
                      into :P41_SEARCH
                      from eba_vector_moviedata
                     where id = :P49_SEARCH_ID;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        advanced {
            executionMappingIdentifier: 11527042583693116
        }
        serverSideCondition {
            whenButtonPressed: @find-similar-movies
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 41
            }
        }
    )

)


````
