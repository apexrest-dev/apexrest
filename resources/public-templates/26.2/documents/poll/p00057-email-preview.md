# Email Preview — Poll

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/poll/apexlang/poll/pages/p00057-email-preview.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: b2a1f735bc36dba970c2634dee0332dd7a9c9a28e04f20ef5caf239c2a5a4f30.

Application dependency inventory: oracle:26.2:public-template/poll/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 57 (
    name: Email Preview
    alias: EMAIL-PREVIEW
    title: Email Preview
    pageGroup: @administration
    appearance {
        pageTemplate: @/minimal-no-navigation
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: @contribution-rights
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region button-bar (
        name: Button Bar
        type: staticContent
        layout {
            sequence: 10
            slot: body-3
        }
        appearance {
            template: @/buttons-container
            templateOptions: [
                #DEFAULT#
                t-ButtonRegion--noUI
            ]
        }
    )

    region show-template (
        name: Show Template
        type: plSqlDynamicContent
        source {
            plsqlCode:
                ```plsql
                declare
                   l_poll_url   varchar2(4000);
                   l_body       clob;
                   l_subject    varchar2(4000);
                   l_html_body  clob;
                   l_text_body  clob;
                begin
                
                l_poll_url := '<a href="#">'||apex_escape.html(:POLL_NAME)||'</a>';
                                                                     
                l_body := replace(:P72_INVITE_BODY,'#POLL_LINK#',l_poll_url);
                   
                for c1 in (
                    select case when :P57_METHOD = 'INVITE'
                                then nvl(apex_escape.html(:P72_INVITE_SUBJECT),'Please Share Your Opinion on '||:POLL_NAME) 
                                else nvl(apex_escape.html(:P1072_REMINDER_SUBJECT),'Reminder: Please Share Your Opinion on '||:POLL_NAME) 
                                end invite_subject, 
                           case when :P57_METHOD = 'INVITE'
                                then nvl(apex_escape.html(:P72_INVITE_BODY),'<p>Please take #POLL_LINK#.</p>
                '||
                           case when authentication_req_yn = 'N'
                                then apex_lang.message('UNAUTH_MSG') end ||
                '<p>Thanks in advance for your participation!</p>
                <p>Best Regards,</p>
                <p>The '||apex_escape.html(:APPLICATION_TITLE)||' Team</p>') 
                                else nvl(apex_escape.html(:P1072_REMINDER_BODY),'<p>Please take #POLL_LINK#.</p>
                '||
                           case when authentication_req_yn = 'N'
                                then apex_lang.message('UNAUTH_MSG') end ||
                '<p>Thanks in advance for your participation!</p>
                <p>Best Regards,</p>
                <p>The '||apex_escape.html(:APPLICATION_TITLE)||' Team</p>') end invite_body
                      from eba_qpoll_polls
                     where id = :POLL_ID
                ) loop
                
                   apex_mail.prepare_template (
                      p_static_id       => 'INVITE',
                      p_placeholders    => '{' || 
                                           '    "SUBJECT":'           || apex_json.stringify( c1.invite_subject ) || 
                                           '   ,"APPLICATION_TITLE":' || apex_json.stringify( apex_escape.html(:APPLICATION_TITLE) ) || 
                                           '   ,"OPT_OUT_TEXT":'      || apex_json.stringify( apex_lang.message('OPT_OUT_TEXT', 
                                                                                              :APP_PATH || '/f?p=' || :APP_ID || ':optout',
                                                                                              apex_escape.html(:APPLICATION_TITLE)) ) || 
                                           '   ,"BODY":'  || apex_json.stringify( replace(c1.invite_body,'#POLL_LINK#','<a href="#">'||:POLL_NAME||'</a>') ) || 
                                           '}' , 
                      p_application_id  => :APP_ID,
                      p_subject         => l_subject,
                      p_html            => l_html_body,
                      p_text            => l_text_body );
                      
                   sys.htp.p(l_html_body);
                   
                end loop;
                      
                end;
                ```
        }
        layout {
            sequence: 20
            slot: body-3
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: show-template
        }
    )

    pageItem P57_METHOD (
        type: hidden
        layout {
            sequence: 10
            region: @button-bar
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Close Preview
        layout {
            sequence: 10
            region: @button-bar
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:window.close();
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
