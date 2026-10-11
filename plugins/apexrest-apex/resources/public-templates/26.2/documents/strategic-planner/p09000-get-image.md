# Get Image — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p09000-get-image.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 1ce263817dd2ba56ea9ee43033953cfd38675178229d848ff193a34480e621c7.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9000 (
    name: Get Image
    alias: GET-IMAGE
    title: Get Image
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        deepLinking: true
        pageAccessProtection: unrestricted
    }
    sessionManagement {
        rejoinSessions: allSessions
    }

    process download-image (
        name: Download Image
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                declare
                    l_file_blob  sp_comment_images.file_blob%type;
                    l_mimetype   sp_comment_images.mimetype%type;
                begin
                
                    select file_blob, mimetype
                      into l_file_blob, l_mimetype
                      from sp_comment_images
                     where unique_filename = apex_application.g_x01;
                
                    apex_http.download (
                        p_blob         => l_file_blob,
                        p_content_type => l_mimetype,
                        p_is_inline    => true );
                
                end;
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 21931111387623705597
        }
    )

)


````
