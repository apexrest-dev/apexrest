# Involved People — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00096-involved-people.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: a118accdb0158be760a0f094777b1813290abc68449b07a47a7fd0c4435af6a5.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 96 (
    name: Involved People
    alias: INVOLVED-PEOPLE
    title: Involved People
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }

    region users (
        name: "Users "
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 
                    t.ID,
                    t.FIRST_NAME||' '||t.last_name name,
                    t.location,
                    lower(t.TAGS) tags,
                    t.app_role,
                    t.UPDATED,
                    t.created,
                    t.email,
                    t.photo,
                    t.photo_mimetype,
                    t.screen_name
                --
                from SP_TEAM_MEMBERS t
                where nvl(t.IS_CURRENT_YN,'Y') = 'Y' and
                      t.id in 
                      (
                        select id from SP_PROJECT_COMMENTS pc where pc.AUTHOR_ID = :P96_ID
                        union
                        --
                        select OWNER_ID id from sp_projects p where id = :P96_ID
                        union 
                        --
                        select tm.id
                        from SP_PROJECTS p, SP_TEAM_MEMBERS tm
                        where tm.email = lower(p.CREATED_BY) and p.id = :P96_ID
                        union
                        --
                        select tm.id
                        from SP_PROJECTS p, SP_TEAM_MEMBERS tm
                        where tm.email = lower(p.UPDATED_BY) and p.id = :P96_ID
                        union
                        --
                        select tm.id
                        from SP_PROJECT_DOCUMENTS pd, SP_TEAM_MEMBERS tm
                        where tm.email = lower(pd.CREATED_BY) and pd.project_id = :P96_ID
                        union
                        --
                        select pc.TEAM_MEMBER_ID id
                        from   SP_PROJECT_CONTRIBUTORS pc
                        where  pc.PROJECT_ID = :P96_ID
                        union
                        --
                        select tm.id
                        from   SP_PROJECT_LINKS PL, SP_TEAM_MEMBERS tm
                        where  tm.email = lower(pl.CREATED_BY) and pl.project_id = :P96_ID
                        union
                        --
                        select t.OWNER_ID id
                        from   sp_tasks t
                        where  t.PROJECT_ID = :P96_ID
                      )
                
                ```
        }
        orderBy {
            type: staticValue
            orderByClause: 2
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        accessibility {
            landmarkType: region
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            display: report
        }
        settings {
            title: &NAME!HTML.
            description:
                ```html
                &EMAIL. {if COUNTRY/}<br>-  &COUNTRY.{endif/}&COUNTRY!HTML.
                {if TAGS/}<br>Tags: &TAGS.{endif/}
                {if GROUP_MEMBERSHIP/}<br>Groups: &GROUP_MEMBERSHIP.{endif/}
                <br>Screen Name: &SCREEN_NAME!RAW.
                ```
            displayAvatar: true
        }
        plugin-avatar {
            type: image
            image: {
                type: blobColumn
                blobColumn: PHOTO
                filenameColumn: NAME
                mimeTypeColumn: PHOTO_MIMETYPE
                lastUpdatedColumn: UPDATED
            }
        }

        column APP_ROLE (
            layout {
                sequence: 170
            }
            source {
                databaseColumn: APP_ROLE
                dataType: varchar2
            }
        )

        column CREATED (
            layout {
                sequence: 310
            }
            source {
                databaseColumn: CREATED
                dataType: date
            }
        )

        column EMAIL (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: EMAIL
                dataType: varchar2
            }
        )

        column ID (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: ID
                dataType: number
                primaryKey: true
            }
        )

        column LOCATION (
            layout {
                sequence: 300
            }
            source {
                databaseColumn: LOCATION
                dataType: varchar2
            }
        )

        column NAME (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: NAME
                dataType: varchar2
            }
        )

        column PHOTO (
            layout {
                sequence: 280
            }
            source {
                databaseColumn: PHOTO
                dataType: blob
            }
        )

        column PHOTO_MIMETYPE (
            layout {
                sequence: 290
            }
            source {
                databaseColumn: PHOTO_MIMETYPE
                dataType: varchar2
            }
        )

        column SCREEN_NAME (
            layout {
                sequence: 360
            }
            source {
                databaseColumn: SCREEN_NAME
                dataType: varchar2
            }
        )

        column TAGS (
            layout {
                sequence: 50
            }
            source {
                databaseColumn: TAGS
                dataType: varchar2
            }
        )

        column UPDATED (
            layout {
                sequence: 70
            }
            source {
                databaseColumn: UPDATED
                dataType: date
            }
        )

    )

    pageItem P96_ID (
        type: hidden
        layout {
            sequence: 20
            slot: contentBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

)


````
