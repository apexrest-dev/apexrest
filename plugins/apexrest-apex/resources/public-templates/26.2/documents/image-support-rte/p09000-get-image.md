# Get Image — Image Support Rte

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/image-support-rte/apexlang/image-support-rte/pages/p09000-get-image.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 98f3afc8d9a1ca7973c512477f20ed9d56adaf7b7aac4fc89cffc3d0f7fd9a22.

Application dependency inventory: oracle:26.2:public-template/image-support-rte/dependencies.

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
        authorizationScheme: @access-rights
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
                    l_file_blob  excm_rte_images.file_blob%type;
                    l_mimetype   excm_rte_images.mimetype%type;
                begin
                
                    select file_blob, mimetype
                      into l_file_blob, l_mimetype
                      from excm_rte_images
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
            executionMappingIdentifier: 16664583516701279442
        }
    )

)


````
