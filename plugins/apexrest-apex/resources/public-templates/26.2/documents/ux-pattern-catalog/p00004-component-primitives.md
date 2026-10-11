# Component Primitives — Ux Pattern Catalog

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/ux-pattern-catalog/apexlang/ux-pattern-catalog/pages/p00004-component-primitives.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 98705bc49e10a414f2f6f2470aff10ec12c79a32890ec6b102dc082c6f8204d7.

Application dependency inventory: oracle:26.2:public-template/ux-pattern-catalog/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 4 (
    name: Component Primitives
    alias: COMPONENT-PRIMITIVES
    title: Component Primitives
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
    }
    comments {
        comments:
            ```
            ## Purpose
            
            The Component Primitives index is a catalog context page that introduces reusable component-level patterns and helps users choose an appropriate building block. It is not itself a component pattern to copy.
            
            ## When to Use
            
            Use component primitives when designing focused interface elements such as content rows, cards, lists, badges, actions, and other reusable presentation or interaction structures.
            
            ## When to Avoid
            
            Avoid treating component primitives as complete page patterns. Use Page Patterns when the primary need is overall page structure, information hierarchy, navigation, or task flow.
            
            ## AI Guidance
            
            Treat this page as catalog navigation, not as a component pattern example. Use the linked primitive pages as implementation references. Adapt each primitive to the surrounding page context while preserving its intended hierarchy, interaction role, and semantic meaning.
            ```
    }

    region apex-ux-pattern-catalog (
        name: Component Primitives Catalog
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Explore reusable Oracle APEX component primitives for presenting content, actions, status, navigation, and data input. Each example demonstrates recommended configuration, visual hierarchy, and interaction patterns that developers and AI coding assistants can adapt across different application contexts.</p>
                
                <p>Choose the primitive that best supports the intended interaction, then combine and configure it to fit the needs of the page.</p>
                ```
        }
        layout {
            sequence: 40
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h1
                t-Region--removeHeader js-removeLandmark
                margin-bottom-md
            ]
        }
    )

    region patterns (
        name: Components
        type: themeTemplateComponent/contentRow
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                    'fa-media-list' as icon_class,
                    'Content Rows' as title,
                    'Present compact, scannable records with supporting metadata, status, icons, badges, and contextual actions.' as description,
                    'content-rows' as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-cards' as icon_class,
                    'Cards' as title,
                    'Group related content and actions into flexible visual containers for browsing, comparison, and summary views.' as description,
                    'cards' as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-tachometer' as icon_class,
                    'Metrics' as title,
                    'Highlight key values, trends, targets, and supporting context using clear and appropriately emphasized metric displays.' as description,
                    'metrics' as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-bar-chart' as icon_class,
                    'Charts' as title,
                    'Visualize comparisons, distributions, composition, and change over time using charts suited to the data and task.' as description,
                    'charts' as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-tag' as icon_class,
                    'Status and Badges' as title,
                    'Communicate state, category, priority, and other concise metadata with consistent labels and semantic styling.' as description,
                    null as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-hand-pointer-o' as icon_class,
                    'Buttons and Menus' as title,
                    'Present primary, secondary, and contextual actions with clear hierarchy, placement, labeling, and interaction behavior.' as description,
                    null as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-check-square-o' as icon_class,
                    'Form Controls' as title,
                    'Capture selections and input using controls that clearly communicate purpose, available choices, and expected interaction.' as description,
                    null as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-inbox' as icon_class,
                    'Empty States' as title,
                    'Explain why content is unavailable and provide an appropriate next step when a region, search, or collection has no results.' as description,
                    null as page_alias
                from sys.dual
                
                union all
                
                select
                    'fa-compass' as icon_class,
                    'Navigation' as title,
                    'Help users understand their location, move between related views, and access the next level of information efficiently.' as description,
                    null as page_alias
                from sys.dual;
                ```
        }
        layout {
            sequence: 60
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                margin-top-md
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

    region reusable-apex-ux-patterns (
        name: Component Primitives
        type: staticContent
        layout {
            sequence: 90
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-shapes
        }
    )

)


````
