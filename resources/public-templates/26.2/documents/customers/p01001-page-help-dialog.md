# Page Help Dialog — Customers

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/customers/apexlang/customers/pages/p01001-page-help-dialog.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1d71cbf6cefb0ff3b37a8e6a9f3f707c2e16721886be18c55f9f594dd1d38cb1.

Application dependency inventory: oracle:26.2:public-template/customers/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1001 (
    name: Page Help Dialog
    alias: PAGE-HELP-DIALOG
    title: Help
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }

    region about-this-page (
        name: About this Page
        type: plSqlDynamicContent
        source {
            plsqlCode:
                ```plsql
                for c1 in 
                (
                    select page_title, help_text 
                      from apex_application_pages
                     where page_id = :P1001_PAGE_ID 
                       and application_id = :APP_ID
                )
                loop
                    if c1.help_text is null then
                        sys.htp.p('No help is available for this page.');
                    else
                        if substr(c1.help_text, 1, 3) != '<p>' then
                            sys.htp.p('<p>');
                        end if;
                
                        sys.htp.p(apex_application.do_substitutions(c1.help_text, 'ESC'));
                
                        if substr(trim(c1.help_text), -4) != '</p>' then
                            sys.htp.p('</p>');
                        end if;
                    end if;
                end loop;
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--slimPadding
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P1001_PAGE_ID (
        type: hidden
        layout {
            sequence: 10
            region: @about-this-page
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button about-this-app (
        buttonName: ABOUT_THIS_APP
        label: Learn More about &APP_TITLE.
        layout {
            sequence: 10
            region: @buttons
            slot: previous
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--small
                t-Button--link
            ]
        }
        behavior {
            action: redirectThisApp
            target: {
                page: HELP
                action: resetPagination
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
