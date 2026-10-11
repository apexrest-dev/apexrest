# Theme Styles — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p00405-theme-styles.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6cb081fc6f8f815b1813c7eceb93b2398d77af4827ebf9d505054287e4624080.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 405 (
    name: Theme Styles
    alias: THEME-STYLES
    title: Theme Styles
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            [aria-describedby="TSInstructions"] {
                max-width:90%!important;
                width: 1400px!important;
            }
            ```
    }
    security {
        authentication: public
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
        }
        layout {
            sequence: 1
            slot: breadcrumbBar
        }
        appearance {
            template: @/title-bar
            templateOptions: [
                #DEFAULT#
                t-BreadcrumbRegion--useBreadcrumbTitle
            ]
        }
        componentAppearance {
            breadcrumbTemplate: @/breadcrumb
            templateOptions: #DEFAULT#
        }
    )

    region official-theme-styles (
        name: Official Theme Styles
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>Here are the official <strong>Theme Styles</strong> for Oracle APEX.</p>
                <p>These <strong>Theme Styles</strong> are part of the official Oracle APEX release and are maintained and supported by our team.</p>
                ```
        }
        layout {
            sequence: 20
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region official-theme-styles-cards (
        name: Official Theme Styles Cards
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select s.name,
                       case 
                        when :P0_THEME_STYLE_ID is not null and s.theme_style_id = :P0_THEME_STYLE_ID then 'Current' 
                        when :P0_THEME_STYLE_ID is null and s.is_current = 'Yes' then 'Current' 
                       end as badge,
                       s.theme_style_id,
                       '#APP_FILES#theme_styles/'||replace(lower(s.name), ' ', '-')||'.png' image,
                       'javascript:apex.page.submit( { request: ''APPLY_THEME_STYLE'', set: { ''P0_THEME_STYLE_ID'': ''' || s.theme_style_id || ''' }, showWait: true } );' javascript
                  from apex_application_theme_styles s, 
                       apex_application_themes t
                 where s.application_id = t.application_id
                   and s.theme_number   = t.theme_number
                   and s.application_id = :app_id
                   and t.ui_type_name   = 'DESKTOP'
                   and t.is_current     = 'Yes'
                   and s.theme_roller_output_file_url like '%THEME_FILES%' -- custom theme style
                 order by case when s.name like '%Redwood%' then 2 else 1 end, s.name
                ```
        }
        layout {
            sequence: 10
            parentRegion: @official-theme-styles
            slot: subRegions
        }
        appearance {
            template: @/cards-container
            templateOptions: #DEFAULT#
        }
        componentAppearance {
            gridColumns: 3
        }
        title {
            column: NAME
        }
        iconAndBadge {
            badgeColumn: BADGE
        }
        media {
            source: urlColumn
            urlColumn: IMAGE
        }

        action action (
            label: Live Preview
            layout {
                sequence: 10
            }
            behavior {
                type: redirectUrl
                targetUrl: &JAVASCRIPT.
            }
            appearance {
                hot: true
            }
        )

    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>Using <strong>Theme Roller</strong> you can create <strong>Theme Styles</strong> to customize the UI of your application in more than a few creative ways.</p>
        }
        layout {
            sequence: 10
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region region-display-selector (
        name: Region Display Selector
        type: regionDisplaySelector
        layout {
            sequence: 11
            slot: breadcrumbBar
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
        settings {
            mode: scrollWindow
            rememberSelection: false
        }
    )

    dynamicAction customevent-openinstructions (
        name: customEvent openInstructions
        execution {
            sequence: 10
        }
        when {
            event: custom
            customEvent: openInstructions
            selectionType: jsExpression
            javaScriptExpression: document
        }

        action native-set-value (
            action: setValue
            settings {
                type: jsExpression
                jsExpression: this.data.themeStyleId
            }
            affectedElements {
                selectionType: items
                items: P405_THEME_STYLE_ID
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

)


````
