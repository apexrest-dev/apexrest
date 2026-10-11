# Poll Submitted — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00063-poll-submitted.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 3802375eb83cd76861866a1bc98816be08404068baf88e79c73f975dc099e283.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 63 (
    name: Poll Submitted
    alias: POLL-SUBMITTED
    title: Poll Submitted
    pageGroup: @polls
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigationMenu {
        overrideUserInterfaceLevel: true
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            @media only screen and (max-width: 640px) {
            section.uRegion {
              width: auto !important;
            }
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

    region hide-nobody (
        name: hide nobody
        type: staticContent
        source {
            htmlCode: "<style>.userBlock{display: none !important} .logoBarNav {padding-top: 8px;visibility: hidden;}</style>"
        }
        layout {
            sequence: 10
            slot: body-3
        }
        advanced {
            excludeTitleFromTranslation: true
        }
        serverSideCondition {
            type: functionBody
            plsqlFunctionBody:
                ```plsql
                if apex_authentication.is_authenticated then
                   return false;
                else
                   return true;
                end if;
                ```
        }
    )

    region poll-submitted (
        name: Poll Submitted!
        type: plSqlDynamicContent
        source {
            plsqlCode:
                ```plsql
                sys.htp.p('<p>Thank you for submitting your poll</p>');
                for c1 in (
                   select thank_you_text
                     from eba_qpoll_polls
                    where id = :POLL_ID
                ) loop
                   if c1.thank_you_text is not null then
                      sys.htp.p('<p>'||apex_escape.html(c1.thank_you_text)||'</p>');
                   end if;
                end loop;
                ```
        }
        layout {
            sequence: 20
            slot: body-3
        }
        appearance {
            template: @/alert
            templateOptions: [
                #DEFAULT#
                t-Alert--wizard
                t-Alert--defaultIcons
                t-Alert--success
            ]
        }
    )

    button return-to-home (
        buttonName: RETURN_TO_HOME
        label: Return to application home
        layout {
            sequence: 10
            region: @poll-submitted
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 1
            }
            warnOnUnsavedChanges: doNotCheck
        }
        security {
            authorizationScheme: @reader-rights
        }
    )

    button view-responses (
        buttonName: VIEW_RESPONSES
        label: View Responses
        layout {
            sequence: 20
            region: @poll-submitted
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
            ]
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 66
            }
            warnOnUnsavedChanges: doNotCheck
        }
        security {
            authorizationScheme: @can-view-poll-results-closed-active-or-staged-and-contributor
        }
    )

)


````
