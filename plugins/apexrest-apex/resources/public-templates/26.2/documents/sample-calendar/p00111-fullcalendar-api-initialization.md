# FullCalendar API initialization — Sample Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-calendar/apexlang/sample-calendar/pages/p00111-fullcalendar-api-initialization.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 958f87e60a20060f321b504d3515e58c191913e23379fdafbdd14ee7b63c5c17.

Application dependency inventory: oracle:26.2:public-template/sample-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 111 (
    name: FullCalendar API initialization
    alias: FULLCALENDAR-API-INITIALIZATION
    title: FullCalendar API initialization
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }
    advanced {
        reloadOnSubmit: always
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>This is a standard Oracle APEX calendar region component showing a <b>weekly</b> view on events with a time component. In this example the region attribute <b>Plugin Initialization Javascript</b> is being used to override the standard FullCalendar initialization attributes with custom values. The javascript function, provided by the developer, must accept an Object containing the calendar initialization attributes, as parameter. In the javascript code, modify that object as needed and return. The function will be called by the calendar component automatically.</p>
                <pre>
                function ( pOptions) {
                    pOptions.titleFormat            = function( pDate ) { return "Conference Schedule" };       // custom title
                    pOptions.slotMinTime            = "07:00:00";                                               // hide slots before minTime
                    pOptions.slotMaxTime            = "21:00:00";                                               // hide slots after maxTime
                    pOptions.dayHeaderFormat        = { weekday: 'short', month: 'numeric', day: 'numeric' };   // week view column headings
                    pOptions.slotDuration           = "00:15:00";                                               // custom slot duration
                    pOptions.weekNumbers            = true;                                                     // show week numbers
                    pOptions.weekText               = "CW";                                                     // heading for week numbers
                    pOptions.weekNumberCalculation  = "ISO";                                                    // use "ISO" week numbers
                    pOptions.displayEventTime       = true;                                                     // show event time ...
                    pOptions.displayEventEnd        = false;                                                    // ... but not the end time
                    pOptions.disableKeyboardSupport = true;                                                     // disable builtin keyboard navigation
                    pOptions.windowResize           = null;                                                     // suppress automatic switch to list view on small screens
                    return pOptions;
                }
                </pre>
                
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-bottom-md
            ]
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
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region sessions (
        name: Sessions
        type: calendar
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                   id,
                   case when speaker is not null then 
                       title || ' (' || speaker || ')' 
                       else title
                   end as title,
                   speaker,
                   start_date,
                   end_date,
                   case
                      when status       = 'INACTIVE' then  'apex-cal-gray'
                      when session_type = 'BREAK'    then  'apex-cal-silver'
                      when session_type = 'BUSINESS' then  'apex-cal-orange'
                      when session_type = 'GENERAL'  then  'apex-cal-blue'
                      when session_type = 'TECHNICAL' then 'apex-cal-green'
                      when session_type = 'HANDS_ON' then 'apex-cal-lime'
                   end as css_class
                from eba_demo_cal_sessions
                where status='ACTIVE'
                
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
                t-Region--hiddenOverflow
            ]
        }
        settings {
            displayColumn: TITLE
            startDateColumn: START_DATE
            endDateColumn: END_DATE
            showTime: true
            calendarViewsAndNavigation: [
                week
                list
            ]
            viewEditLink: {
                page: 301
                items: {
                    P301_ID: &ID.
                }
                action: resetPagination
            }
            cssClass: CSS_CLASS
        }
        performance {
            lazyLoading: true
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function ( pOptions) {
                    pOptions.titleFormat            = function( pDate ) { return "Conference Schedule" };
                    pOptions.slotMinTime            = "07:00:00";
                    pOptions.slotMaxTime            = "21:00:00";
                    pOptions.dayHeaderFormat        = { weekday: 'short', month: 'numeric', day: 'numeric' };
                    pOptions.slotDuration           = "00:15:00";
                    pOptions.weekNumbers            = true;
                    pOptions.weekText               = "CW";
                    pOptions.weekNumberCalculation  = "ISO";
                    pOptions.displayEventTime       = true;
                    pOptions.displayEventEnd        = false;
                    pOptions.disableKeyboardSupport = true;
                    pOptions.windowResize           = null;
                    return pOptions;
                }
                
                ```
        }
    )

    dynamicAction change-show-inactive-sessions (
        name: Change Show Inactive Sessions
        execution {
            sequence: 20
        }
        when {
            selectionType: items
            items: P111_SHOW_INACTIVE
        }
        serverSideCondition {
            type: never
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @sessions
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction dialog-closed-refresh-calendar (
        name: Dialog Closed: Refresh Calendar
        execution {
            sequence: 10
        }
        when {
            event: apexafterclosedialog
            selectionType: region
            region: @sessions
        }

        action native-refresh (
            action: refresh
            affectedElements {
                selectionType: region
                region: @sessions
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
