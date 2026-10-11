# List View — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01700-list-view.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: ef975040c913c742ae5fa63ad9e239fe6c1c160dfca4f300d8f57b48dcf831bc.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1700 (
    name: List View
    alias: LIST-VIEW
    title: List View
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: [
            dm-Page
            dm-Page--center
        ]
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

    region 1-default (
        name: 1. Default
        type: staticContent
        layout {
            sequence: 20
            parentRegion: @examples
            slot: subRegions
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
            ]
        }
    )

    region 2-with-list-divider-and-badge (
        name: 2. With List Divider and Badge
        type: staticContent
        layout {
            sequence: 30
            parentRegion: @examples
            slot: subRegions
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
            ]
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
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
            sequence: 170
            parentRegion: @2-with-list-divider-and-badge
            slot: subRegions
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--scrollBody
            ]
        }
        settings {
            features: showListDivider
            textColumn: TASK_NAME
            counterColumn: STATUS
            listDividerColumn: PROJECT
        }
        reportLayout {
            numberOfRows: 10
        }
    )

    region examples (
        name: Examples
        type: staticContent
        layout {
            sequence: 40
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>The List View component provides a simple list-based user interface that has a wide range of features. This component has built in search, list dividers, counters, nested lists, and more.</p>
                <p class="dm-Hero-steps">Set <strong>List View</strong> as Region Type.</p>
                ```
        }
        layout {
            sequence: 20
            slot: body
            startNewRow: false
            newColumn: false
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
            ]
        }
        advanced {
            regionDisplaySelector: true
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
            sequence: 140
            parentRegion: @1-default
            slot: subRegions
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--scrollBody
            ]
        }
        settings {
            textColumn: TASK_NAME
            linkTarget: {
                type: url
                url: #
            }
        }
        reportLayout {
            numberOfRows: 5
        }
    )

    region region-display-selector (
        name: Region Display Selector
        type: regionDisplaySelector
        layout {
            sequence: 20
            slot: breadcrumbBar
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

)


````
