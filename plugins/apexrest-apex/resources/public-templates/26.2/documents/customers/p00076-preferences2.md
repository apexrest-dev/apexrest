# Preferences — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p00076-preferences2.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 3644488744ad5a415af2e07e7551814fdb4bf33ba18efe8db1195a0d9f2a7303.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 76 (
    name: Preferences
    alias: PREFERENCES2
    title: Preferences
    pageGroup: @home
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }

    region preference (
        name: Preference
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    region preferences (
        name: Preferences
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb-2
        }
        layout {
            sequence: 1
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

    pageItem P76_TIMEZONE (
        type: selectList
        label {
            label: Time Zone
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select distinct tzname d, tzname r
                  from V$TIMEZONE_NAMES
                 order by 1
                ```
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @preference
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        source {
            type: sqlQuerySingleValue
            sqlQuery: select timezone_preference from eba_cust_tz_pref where userid = :APP_USER
            used: always
        }
        default {
            type: functionBody
            plsqlFunctionBody: return apex_util.get_session_time_zone;
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button apply-changes (
        buttonName: APPLY_CHANGES
        label: Apply Changes
        layout {
            sequence: 20
            region: @preferences
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @preferences
            slot: create
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: &LAST_VIEW.
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process set-time-zone (
        name: set time zone
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                   c integer := 0;
                begin
                   for c1 in (select id, timezone_preference 
                              from eba_cust_tz_pref 
                              where userid = :APP_USER) loop
                      update eba_cust_tz_pref
                      set timezone_preference = nvl(:P76_TIMEZONE,'UTC')
                      where id = c1.id;
                      c := c + 1;
                   end loop;
                   if c = 0 then
                      insert into eba_cust_tz_pref (userid, timezone_preference)
                      values (:APP_USER,:P76_TIMEZONE);
                   end if;
                   APEX_UTIL.SET_SESSION_TIME_ZONE (  
                          P_TIME_ZONE => :P76_TIMEZONE); 
                   commit;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Time Zone Set
        }
        advanced {
            executionMappingIdentifier: 16609878892269275303
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: &LAST_VIEW.
            }
        }
        comments {
            comments: Created 02-MAR-2012 10:23 by MIKE
        }
    )

)


````
