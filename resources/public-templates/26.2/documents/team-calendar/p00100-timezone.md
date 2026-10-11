# Time Zone Preference — Team Calendar

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/team-calendar/apexlang/team-calendar/pages/p00100-timezone.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 104f18e77d1617284f41308d6c03c347f76d2096fd7747b9eeb8095e478c9f7a.

Application dependency inventory: oracle:26.2:public-template/team-calendar/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 100 (
    name: Time Zone Preference
    alias: TIMEZONE
    title: Time Zone Preference
    pageGroup: @public
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText:
            ```html
            <p>
              Select your preferred time zone and click the <strong>Apply Changes</strong> button to set your time zone. Click the <strong>Cancel</strong> button to leave this page.
            </p>
            <p>
              Various other functions in this app record and report timestamps according to this setting.  
            </p>
            ```
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 20
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

    region preference (
        name: Preference
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/alert
            templateOptions: [
                t-Alert--wizard
                t-Alert--defaultIcons
                t-Alert--info
            ]
        }
    )

    pageItem P100_TIMEZONE (
        type: selectList
        label {
            label: Time Zone
            alignment: left
        }
        lov {
            type: sharedComponent
            lov: @std-time-zones
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
        default {
            type: static
            staticValue: &F855_TIMEZONE.
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
        help {
            helpText: Select timezone.  This is used to adjust all dates and times.
        }
    )

    button apply-changes (
        buttonName: APPLY_CHANGES
        label: Apply Changes
        layout {
            sequence: 20
            region: @breadcrumb
            slot: next
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

    button close (
        buttonName: CLOSE
        label: Cancel
        layout {
            sequence: 10
            region: @breadcrumb
            slot: next
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

    process change-timezone (
        name: Change Timezone
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                   c integer := 0;
                begin
                   for c1 in (select id, timezone_preference 
                              from eba_ca_tz_pref 
                              where userid = :APP_USER) loop
                      update eba_ca_tz_pref
                      set timezone_preference = nvl(:P100_TIMEZONE,'UTC')
                      where id = c1.id;
                      c := c + 1;
                   end loop;
                   if c = 0 then
                      insert into eba_ca_tz_pref (userid, timezone_preference)
                      values (:APP_USER,:P100_TIMEZONE);
                   end if;
                   APEX_UTIL.SET_SESSION_TIME_ZONE (  
                          P_TIME_ZONE => :P100_TIMEZONE); 
                    :F855_TIMEZONE := :P100_TIMEZONE;
                   commit;
                end;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: Timezone Set.
        }
        error {
            displayLocation: onErrorPage
        }
        advanced {
            executionMappingIdentifier: 7960497786259588070
        }
        serverSideCondition {
            whenButtonPressed: @apply-changes
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
            saveStateBeforeBranching: true
        }
    )

)


````
