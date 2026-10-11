# Territory Countries — Opportunities

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/opportunities/apexlang/opportunities/pages/p00123-territory-countries.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 27cdd823517cb1587e5d6b0e6ce0a27a4ecf2cd94d0acee122ee8cf01bcb17f0.

Application dependency inventory: oracle:26.2:public-template/opportunities/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 123 (
    name: Territory Countries
    alias: TERRITORY-COUNTRIES
    title: Countries
    pageGroup: @territories
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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
    help {
        helpText:
            ```html
            <p>
                To edit a country assignment, click the <strong>Edit</strong> icon (pencil) next to the country assignment. Click the <strong>Add Country</strong> button to assign a new country to the territory. Click the <strong>Reset</strong> button to reset the interactive report. Click the <strong>Actions</strong> button to define the number of rows displayed per page, filter, format, download, and/or save the interactive report.
            </p>
            ```
    }
    config {
        buildOption: @territories
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 30
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

    region countries (
        name: Countries
        type: interactiveReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select m.id,
                  m.country_id, 
                  c.country_name,
                  c.country_code,
                  m.created date_added, 
                  lower(m.created_by) added_by,
                  null remove_button
                from eba_sales_countries c
                join eba_sales_terr_map m
                  on c.id = m.country_id
                where m.territory_id = :P123_TERRITORY_ID
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/interactive-report
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            showNullValuesAs: -
        }
        pagination {
            type: rowRangesXToY
        }
        performance {
            maxRowsToProcess: 100000
        }
        messages {
            whenNoDataFound: No data found.
            whenMoreDataFound: This query returns more than #MAX_ROW_COUNT# rows, please filter your data to ensure complete results.
        }
        actionsMenu {
            savePublicReport: true
        }
        download {
            formats: [
                csv
                html
            ]
        }
        advanced {
            savedReportMappingIdentifier: 2538376324543414848
        }

        column ADDED_BY (
            type: plainText
            heading {
                heading: Added By
            }
            layout {
                sequence: 3
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: C
            }
        )

        column COUNTRY_CODE (
            type: plainText
            heading {
                heading: Code
            }
            layout {
                sequence: 45
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: I
            }
        )

        column COUNTRY_ID (
            type: hidden
            heading {
                heading: Country Id
            }
            layout {
                sequence: 5
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: E
            }
            security {
                escapeSpecialChars: false
            }
        )

        column COUNTRY_NAME (
            type: plainText
            heading {
                heading: Country
            }
            layout {
                sequence: 1
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: A
            }
        )

        column DATE_ADDED (
            type: plainText
            heading {
                heading: Added
            }
            layout {
                sequence: 2
            }
            appearance {
                formatMask: SINCE
            }
            source {
                dataType: date
                timezoneAware: Y
            }
            advanced {
                endUserAlias: B
            }
        )

        column ID (
            type: hidden
            heading {
                heading: Id
            }
            layout {
                sequence: 35
            }
            source {
                dataType: number
            }
            advanced {
                endUserAlias: G
            }
            security {
                escapeSpecialChars: false
            }
        )

        column REMOVE_BUTTON (
            type: link
            heading {
                heading: Remove
                alignment: center
            }
            layout {
                sequence: 25
                columnAlignment: center
            }
            link {
                target: {
                    type: url
                    url: javascript:void(0);
                }
                linkText: <span class="t-Icon fa fa-trash-o"></span>
                linkAttributes: class="t-Button t-Button--small t-Button--noUI t-Button--danger js-removeTerritoryCountry" data-territory-country-id="#ID#"
            }
            source {
                dataType: varchar2
            }
            advanced {
                endUserAlias: H
            }
            enableUsersTo {
                sort: false
                filter: false
                highlight: false
                controlBreak: false
                aggregate: false
                compute: false
                chart: false
                groupBy: false
                pivot: false
            }
        )

        savedReport 25383787 (
            visibility: primaryDefault
            view {
                rowsPerPage: 15
            }

            displayColumn ADDED_BY (
                sequence: 4
            )

            displayColumn COUNTRY_CODE (
                sequence: 2
            )

            displayColumn COUNTRY_NAME (
                sequence: 1
            )

            displayColumn DATE_ADDED (
                sequence: 3
            )

            displayColumn REMOVE_BUTTON (
                sequence: 5
            )

            sort (
                column: DATE_ADDED
                sort {
                    direction: desc
                    sequence: 1
                }
            )

        )

    )

    pageItem P123_TERRITORY_COUNTRY_ID (
        type: hidden
        layout {
            sequence: 20
            region: @countries
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P123_TERRITORY_ID (
        type: hidden
        layout {
            sequence: 30
            region: @countries
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button add-country (
        buttonName: ADD_COUNTRY
        label: Add Country
        layout {
            sequence: 10
            region: @breadcrumb
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 124
                items: {
                    P124_TERRITORY_ID: &P123_TERRITORY_ID.
                }
                clearCache: 124
            }
            warnOnUnsavedChanges: doNotCheck
        }
        security {
            authorizationScheme: @contribution-rights
        }
    )

    button reset-report (
        buttonName: RESET_REPORT
        label: Reset
        layout {
            sequence: 10
            region: @countries
            slot: rightOfInteractiveReportSearchBar
        }
        appearance {
            buttonTemplate: @/text-with-icon
            templateOptions: [
                #DEFAULT#
                t-Button--iconLeft
            ]
            icon: fa-undo-alt
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 123
                clearCache: RIR
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    dynamicAction add-country (
        name: Add Country
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: button
            button: @add-country
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode: apex.message.showPageSuccess('Country Added');
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @countries
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction remove-territory-country-button-clicked (
        name: Remove territory country button clicked
        execution {
            sequence: 20
            eventScope: dynamic
        }
        when {
            event: click
            selectionType: jQuerySelector
            jquerySelector: .js-removeTerritoryCountry
        }

        action native-confirm (
            action: confirm
            settings {
                message: Are you sure you want to remove this country from the territory?
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

        action native-execute-plsql-code (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    delete from eba_sales_terr_map
                    where id = :P123_TERRITORY_COUNTRY_ID;
                    ```
                itemsToSubmit: P123_TERRITORY_COUNTRY_ID
            }
            execution {
                sequence: 30
                fireOnInit: false
            }
        )

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    var id = $(this.triggeringElement).data('territory-country-id');
                    
                    $s('P123_TERRITORY_COUNTRY_ID', id);
                    ```
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

        action native-javascript-code-2 (
            action: executeJsCode
            settings {
                jsCode: apex.message.showPageSuccess('Country Removed');
            }
            execution {
                sequence: 50
                fireOnInit: false
            }
        )

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @countries
            }
            execution {
                sequence: 40
                fireOnInit: false
            }
        )

    )

)


````
