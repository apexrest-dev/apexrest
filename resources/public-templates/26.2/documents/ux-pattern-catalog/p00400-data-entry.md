# Data Entry — Ux Pattern Catalog

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/ux-pattern-catalog/apexlang/ux-pattern-catalog/pages/p00400-data-entry.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 31702ba66b788b9f0e91ce126cafc51ba09e634d8597f731a50c0b52e0185bb1.

Application dependency inventory: oracle:26.2:public-template/ux-pattern-catalog/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 400 (
    name: Data Entry
    alias: DATA-ENTRY
    title: Data Entry
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
    }
    help {
        helpText:
            ```html
            ## Purpose
            
            Organize and explain data-entry patterns in the catalog. This is a category context page, not a pattern implementation.
            
            ## When to Use
            
            Use when this page's primary user task matches the pattern represented by its title and structure.
            
            ## When to Avoid
            
            Avoid when another catalog pattern better supports the user's task, information density, or workflow complexity.
            
            ## AI Guidance
            
            Preserve the page's pattern-first structure, generic terminology, accessible labels, semantic formatting, and clear action hierarchy. Keep documentation in metadata rather than visible instructional text.
                        
            ```
    }

    region about (
        name: About
        type: staticContent
        source {
            htmlCode: Data entry patterns help users create, update, and submit information with the right amount of structure for the task. Use these patterns to choose between focused entry, full-page forms, modal flows, and guided experiences based on complexity, context, and user confidence.
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
            ]
            icon: fa-mouse-pointer
        }
    )

    region data-entry (
        name: Data Entry
        type: staticContent
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-forms
        }
    )

    region patterns (
        name: Patterns
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    'fa-edit' as icon_class,
                    'Data Entry - Simple Form' as title,
                    'A straightforward create or edit pattern for capturing a small to moderate amount of information on a dedicated page.' as description,
                    'data-entry-simple-form' as page_alias
                from sys.dual
                union all
                select
                    'fa-window-maximize' as icon_class,
                    'Data Entry - Drawer Form' as title,
                    'A focused contextual entry pattern for creating or updating a small amount of information without leaving the current page.' as description,
                    'data-entry-drawer-form' as page_alias
                from sys.dual
                union all
                select
                    'fa-align-left' as icon_class,
                    'Data Entry - Sectioned Form' as title,
                    'A longer form pattern that groups related fields into meaningful sections for clearer scanning, completion, and review.' as description,
                    null as page_alias
                from sys.dual
                union all
                select
                    'fa-list-ol' as icon_class,
                    'Data Entry - Wizard' as title,
                    'A guided entry pattern for multi-step workflows where information should be collected, validated, or reviewed in sequence.' as description,
                    null as page_alias
                from sys.dual
                union all
                select
                    'fa-check-square-o' as icon_class,
                    'Data Entry - Bulk Edit' as title,
                    'A batch update pattern for applying the same change to multiple selected records while keeping scope, impact, and confirmation clear.' as description,
                    null as page_alias
                from sys.dual
                ```
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
            ]
        }
        componentAppearance {
            display: report
        }
        settings {
            title: &TITLE.
            description: &DESCRIPTION.
            displayAvatar: true
        }
        plugin-avatar {
            icon: &ICON_CLASS. fa-2x u-opacity-50
            shape: noShape
        }
        plugin-appearance {
            applyThemeColors: false
        }

        column DESCRIPTION (
            layout {
                sequence: 30
            }
            source {
                databaseColumn: DESCRIPTION
                dataType: varchar2
            }
        )

        column ICON_CLASS (
            layout {
                sequence: 10
            }
            source {
                databaseColumn: ICON_CLASS
                dataType: varchar2
            }
        )

        column PAGE_ALIAS (
            layout {
                sequence: 40
            }
            source {
                databaseColumn: PAGE_ALIAS
                dataType: varchar2
            }
        )

        column TITLE (
            layout {
                sequence: 20
            }
            source {
                databaseColumn: TITLE
                dataType: varchar2
            }
        )

        action action (
            position: titleLink
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: f?p=&APP_ID.:&PAGE_ALIAS.:&SESSION.::&DEBUG.::::
            }
            serverSideCondition {
                type: itemIsNotNull
                item: PAGE_ALIAS
            }
        )

    )

)


````
