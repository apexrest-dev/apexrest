# Team Member Photo — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00160-team-member-photo.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 64f67aa7ed76eb11420f6d7ad227afdc1a2d675b86b60895f949cb4a2f87b4e4.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 160 (
    name: Team Member Photo
    alias: TEAM-MEMBER-PHOTO
    title: Team Member Photo
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }

    region for-id (
        name: for id
        type: staticContent
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
    )

    pageItem P160_TM_ID (
        type: hidden
        layout {
            sequence: 10
            region: @for-id
            slot: regionBody
        }
    )

    process get-photo (
        name: get photo
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                DECLARE
                    l_file           blob;
                    l_content_type   varchar2( 4000 );
                    l_filename       varchar2( 4000 );
                BEGIN
                
                    SELECT photo,
                           nvl(photo_mimetype,'image/png') photo_mimtype,
                           nvl(photo_filename,'profile.png') photo_filename
                      INTO l_file,
                           l_content_type,
                           l_filename
                      FROM sp_team_members
                     WHERE id = :P160_TM_ID;
                
                    apex_http.download(
                        p_blob           => l_file,
                        p_content_type   => l_content_type,
                        p_filename       => l_filename );
                
                END;
                ```
        }
        execution {
            sequence: 10
            point: beforeHeader
        }
        advanced {
            executionMappingIdentifier: 38593520213831791839
        }
    )

)


````
