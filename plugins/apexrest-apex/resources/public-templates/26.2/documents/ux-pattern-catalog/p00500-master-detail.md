# Master Detail — Ux Pattern Catalog

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/ux-pattern-catalog/apexlang/ux-pattern-catalog/pages/p00500-master-detail.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 37eac827a35b0eaf5255a4d1e3c72324676c07655d368fc23b38e00093e95fff.

Application dependency inventory: oracle:26.2:public-template/ux-pattern-catalog/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 500 (
    name: Master Detail
    alias: MASTER-DETAIL
    title: Master Detail
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
            
            Organize and explain master-detail patterns in the catalog. This is a category context page, not a pattern implementation.
            
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
            htmlCode: Master-detail patterns help users work across related levels of information while preserving context. Use these patterns when users need to select a parent record, inspect dependent detail, compare related rows, or move between summary and detail without losing their place.
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

    region master-detail (
        name: Master Detail
        type: staticContent
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-copy
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
                    'fa-columns' as icon_class,
                    'Master Detail - Split View' as title,
                    'A two-pane layout where users select a master record on one side and review or act on its details on the other. Best for triage, queues, inbox-style workflows, and rapid review.' as description,
                    null as page_alias
                from sys.dual
                union all
                select
                    'fa-table' as icon_class,
                    'Master Detail - Stacked Grids' as title,
                    'A classic data maintenance pattern where parent records and child records are shown in stacked interactive grids for structured review, comparison, and inline updates.' as description,
                    null as page_alias
                from sys.dual
                union all
                select
                    'fa-level-down' as icon_class,
                    'Master Detail - Drill Down' as title,
                    'A progressive navigation pattern where users start from a master list and open a focused detail view for related information when the detail needs more space.' as description,
                    null as page_alias
                from sys.dual
                union all
                select
                    'fa-list-alt' as icon_class,
                    'Master Detail - Related Records' as title,
                    'A detail-centered pattern where one parent record stays in focus while related child records, activity, or dependencies are shown below.' as description,
                    null as page_alias
                from sys.dual
                union all
                select
                    'fa-sitemap' as icon_class,
                    'Master Detail - Hierarchy' as title,
                    'A hierarchical pattern where users navigate parent-child levels through a tree or grouped structure and inspect the selected node in context.' as description,
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
