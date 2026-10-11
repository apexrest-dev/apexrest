# Calendars — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01800-calendars.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 0180c40f816deca980be44a8735fa04bf7187e9bf7343879d4e92ad33098f336.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1800 (
    name: Calendars
    alias: CALENDARS
    title: Calendars - &APP_TITLE.
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
    css {
        inline:
            ```css
            .ts-Placeholder {
            height: 240px;
            line-height: 240px;
            text-align: center;
            background-color: #D0D0D0;
            color: #404040;
            border-radius: 2px;
            margin-bottom: 48px;
            }
            .ts-Container {
            max-width: 1024px;
            min-height: 50vh;
            }
            ```
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

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
        }
        layout {
            sequence: 60
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--showBreadcrumb
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region demo (
        name: Demo
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 
                  task_name,
                  start_date,
                  end_date,
                  status,
                  assigned_to,
                  case status
                     when 'Open'    then 'apex-cal-green'
                     when 'Pending' then 'apex-cal-yellow'
                     when 'Closed'  then 'apex-cal-red'
                     when 'On-Hold' then 'apex-cal-black'
                  end as css_class
                from 
                  eba_ut_chart_tasks
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            htmlDomId: Demo1
        }
        settings {
            displayColumn: TASK_NAME
            startDateColumn: START_DATE
            showTime: true
            calendarViewsAndNavigation: [
                month
                week
                day
                list
                navigation
            ]
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
    )

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--shadowBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            staticId: Demo1
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>This calendar is based on the Full Calendar library and supports drag and drop, multiple views, and more.</p>
        }
        layout {
            sequence: 10
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-display-selector (
        name: Region Display Selector
        type: regionDisplaySelector
        layout {
            sequence: 70
            slot: breadcrumbBar
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
            excludeTitleFromTranslation: true
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    region sample-sql-query (
        name: Sample SQL Query
        type: plugin/regionSourceCode
        layout {
            sequence: 50
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                t-ContentBlock--lightBG
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            regionStaticId: Demo1
        }
    )

)


````
