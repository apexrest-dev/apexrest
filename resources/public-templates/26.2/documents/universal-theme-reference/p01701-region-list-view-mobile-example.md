# Region - List View Mobile Example — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01701-region-list-view-mobile-example.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 2b48e940c47daf628c313b6704a1b2210d0be685967374442218c34c15f24439.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1701 (
    name: Region - List View Mobile Example
    alias: REGION-LIST-VIEW-MOBILE-EXAMPLE
    title: Region - List View Mobile Example
    pageGroup: @components
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: [
            dm-Page
            dm-Page--center
        ]
    }
    navigationMenu {
        overrideUserInterfaceLevel: true
        list: @ut-application-navigation
        listPosition: top
        listTemplate: @/top-navigation-tabs
        templateOptions: [
            #DEFAULT#
            t-NavTabs--inlineLabels-lg
            t-NavTabs--hiddenLabels-sm
        ]
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        pageAccessProtection: unrestricted
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region departments (
        name: Departments
        type: listView
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       (select project from EBA_UT_CHART_PROJECTS p where p.id = t.project) PROJECT,
                       TASK_NAME,
                       START_DATE,
                       END_DATE,
                       STATUS
                  from EBA_UT_CHART_TASKS t
                ```
        }
        layout {
            sequence: 60
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: request=Value
            value: sample2
        }
        settings {
            features: [
                showListDivider
                enableSearch
                insetList
            ]
            textColumn: TASK_NAME
            counterColumn: STATUS
            listDividerColumn: PROJECT
        }
        reportLayout {
            numberOfRows: 10
        }
    )

    region projects-list (
        name: Projects List
        type: listView
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select ID,
                       (select project from EBA_UT_CHART_PROJECTS p where p.id = t.project) PROJECT,
                       TASK_NAME,
                       START_DATE,
                       END_DATE,
                       STATUS
                  from EBA_UT_CHART_TASKS t
                ```
        }
        layout {
            sequence: 50
            slot: body
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: request=Value
            value: sample1
        }
        settings {
            features: insetList
            textColumn: TASK_NAME
            linkTarget: {
                type: url
                url: #
            }
        }
        reportLayout {
            numberOfRows: 10
        }
    )

)


````
