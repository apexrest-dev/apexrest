# Project Exceptions — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00093-project-exceptions.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d3dc04cef0113e4da4d5524ea5a93504e2cd7d9a09b7e05d429b9229b1728099.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 93 (
    name: Project Exceptions
    alias: PROJECT-EXCEPTIONS
    title: Project Exceptions
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }

    region contents (
        name: contents
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                return sp_util.exceptions_for_project (
                           p_project_id     => :P93_PROJECT_ID,
                           p_one_project_yn => 'Y',
                           p_team_member_id => null,
                           p_link_type      => 'APP',
                           p_app_prefix_url => null,
                           p_app_id         => :APP_ID,
                           p_apex_session   => :APP_SESSION_ID,
                           p_reviews_yn     => case when apex_util.get_build_option_status (
                                                             p_application_id    => :APP_ID,
                                                             p_build_option_name => 'Reviews') = 'INCLUDE' 
                                                    then 'Y'
                                                    else 'N'
                                                    end,
                           p_approvals_yn   => case when apex_util.get_build_option_status (
                                                             p_application_id    => :APP_ID,
                                                             p_build_option_name => 'Approvals') = 'INCLUDE' 
                                                    then 'Y'
                                                    else 'N'
                                                    end );
                ```
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    pageItem P93_PROJECT_ID (
        type: displayOnly
        label {
            alignment: left
        }
        settings {
            basedOn: lov
        }
        lov {
            type: sharedComponent
            lov: @sp-projects-project
        }
        layout {
            sequence: 10
            slot: contentBody
            alignment: left
        }
        appearance {
            template: @/optional-above
            templateOptions: [
                #DEFAULT#
                t-Form-fieldContainer--large
                margin-top-none
                t-Form-fieldContainer--boldDisplay
            ]
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
