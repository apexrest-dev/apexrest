# Lists - Media List  — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p01301-media-list.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7561b076d956babbd82218b22990c09c41152f99d738ba6a9c74eeeed762e585.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1301 (
    name: "Lists - Media List "
    alias: MEDIA-LIST
    title: Media List - &APP_TITLE.
    pageGroup: @components
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: [
            dm-Page
            dm-Page--center
        ]
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        authentication: public
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @universal-theme-breadcrumb
        }
        layout {
            sequence: 10
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

    region column-aliases (
        name: Column Aliases
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select '#LIST_CLASS#', 'CSS class of the list' from dual union all
                select '#LINK#', 'Link' from dual union all
                select '#LINK_CLASS#', 'Class attribute for the link element' from dual union all
                select '#LINK_ATTR#', 'HTML Attributes for the list item' from dual union all
                select '#ICON_COLOR_CLASS#', 'CSS class for the icon color' from dual union all
                select '#ICON_CLASS#', 'CSS class for the icon' from dual union all
                select '#LIST_TITLE#', 'List title' from dual union all
                select '#LIST_TEXT#', 'List text' from dual union all
                select '#LIST_BADGE#', 'The badge of the list item.' from dual
                ```
        }
        layout {
            sequence: 60
            parentRegion: @media-list-as-a-report-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                js-headingLevel-3
            ]
        }
        componentAppearance {
            template: @/value-attribute-pairs-row
            templateOptions: [
                #DEFAULT#
                t-AVPList--leftAligned
            ]
        }
        pagination {
            type: showAll
        }

        column '#LIST_CLASS#' (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: &#x27;#list Class#&#x27;
                alignment: center
            }
            layout {
                sequence: 10
            }
        )

        column 'CSSCLASSOFTHELIST' (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: &#x27;cssclassofthelist&#x27;
                alignment: center
            }
            layout {
                sequence: 20
            }
        )

    )

    region demo (
        name: Demo
        type: list
        source {
            list: @ut-sample-media-list
        }
        layout {
            sequence: 30
            parentRegion: @media-list-as-a-list-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: Demo List Template
        }
        advanced {
            htmlDomId: Demo1
        }
        componentAppearance {
            listTemplate: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
            ]
            cssClasses: dm-TemplateOption-previewTarget
        }
    )

    region demo-2 (
        name: Demo
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select
                  id,
                  project list_title,
                  apex_util.get_since(updated) list_text,
                  ' ' list_class,
                  null link, 
                  'target="_blank"' link_attr,
                  null icon_color_class,
                  'fa fa-cloud' icon_class
                from eba_UT_chart_projects
                order by updated desc
                ```
        }
        layout {
            sequence: 20
            parentRegion: @media-list-as-a-report-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                js-headingLevel-3
            ]
        }
        advanced {
            htmlDomId: Demo2
        }
        reportLayout {
            numberOfRows: 5
        }
        componentAppearance {
            template: @/media-list
            templateOptions: [
                #DEFAULT#
                u-colors
                t-MediaList--stack
            ]
            cssClasses: dm-TemplateOption-previewTarget
            showNullValuesAs: -
        }
        pagination {
            type: showAll
        }

        column ICON_CLASS (
            reportColumnQueryId: 8
            derivedColumn: N
            heading {
                heading: Icon Class
                alignment: center
            }
            layout {
                sequence: 8
            }
        )

        column ICON_COLOR_CLASS (
            reportColumnQueryId: 7
            derivedColumn: N
            heading {
                heading: Icon Color Class
                alignment: center
            }
            layout {
                sequence: 7
            }
        )

        column ID (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Id
                alignment: center
            }
            layout {
                sequence: 1
            }
        )

        column LINK (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Link
                alignment: center
            }
            layout {
                sequence: 5
            }
        )

        column LINK_ATTR (
            reportColumnQueryId: 6
            derivedColumn: N
            heading {
                heading: Link Attr
                alignment: center
            }
            layout {
                sequence: 6
            }
        )

        column LIST_CLASS (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: List Class
                alignment: center
            }
            layout {
                sequence: 4
            }
        )

        column LIST_TEXT (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: List Text
                alignment: center
            }
            layout {
                sequence: 3
            }
        )

        column LIST_TITLE (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: List Title
                alignment: center
            }
            layout {
                sequence: 2
            }
        )

    )

    region instructions (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 10
            parentRegion: @media-list-as-a-list-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: List Template Instructions
        }
        settings {
            staticId: Demo1
        }
    )

    region instructions-2 (
        name: Instructions
        type: plugin/componentInstructions
        layout {
            sequence: 20
            parentRegion: @media-list-as-a-report-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: Report Template Instructions
        }
        settings {
            staticId: Demo2
        }
    )

    region list-attributes (
        name: List Attributes
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select '#A01#', 'The description of the media list item. ' from dual union all
                select '#A02#', 'The badge of the media list item.' from dual union all
                select '#A03#', 'HTML Attributes for the clickable link inside of the list item.' from dual union all
                select '#A04#', 'HTML Attributes for the list item. ' from dual union all
                select '#A05#', 'Class attribute for the link element. ' from dual union all
                select '#A06#', 'Color class' from dual
                ```
        }
        layout {
            sequence: 60
            parentRegion: @media-list-as-a-list-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                js-headingLevel-3
            ]
        }
        componentAppearance {
            template: @/value-attribute-pairs-row
            templateOptions: [
                #DEFAULT#
                t-AVPList--leftAligned
            ]
        }
        pagination {
            type: showAll
        }

        column '#A01#' (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: &#x27;#a01#&#x27;
                alignment: center
            }
            layout {
                sequence: 10
            }
        )

        column 'THEDESCRIPTIONOFTHEMEDIALISTITEM.' (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: &#x27;thedescriptionofthemedialistitem.&#x27;
                alignment: center
            }
            layout {
                sequence: 20
            }
        )

    )

    region media-list-as-a-list-template (
        name: Media List as a List Template
        type: staticContent
        layout {
            sequence: 20
            slot: body
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h2
                js-headingLevel-2
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region media-list-as-a-report-template (
        name: Media List as a Report Template
        type: staticContent
        source {
            htmlCode: <p>The Media List template is a very common design pattern that has an icon, heading, description, and a badge. With Universal Theme, you can style both <strong>Lists</strong> or <strong>Classic Reports</strong> regions to appear as a Media List by setting the appropriate template.</p>
        }
        layout {
            sequence: 50
            slot: body
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                js-headingLevel-3
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region overview (
        name: Overview
        type: staticContent
        source {
            htmlCode: <p>The Media List template is a very common design pattern that has an icon, heading, description, and a badge. With Universal Theme, you can style both <strong>Lists</strong> or <strong>Classic Reports</strong> regions to appear as a Media List by setting the appropriate template.</p>
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
                js-headingLevel-2
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
            sequence: 20
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

    region sample-sql-query (
        name: Sample SQL Query
        type: plugin/regionSourceCode
        layout {
            sequence: 50
            parentRegion: @media-list-as-a-report-template
            slot: subRegions
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--lightBG
                js-headingLevel-3
            ]
        }
        settings {
            regionStaticId: Demo2
        }
    )

    region template-options (
        name: Template Options
        type: plugin/previewTemplateOptions
        layout {
            sequence: 40
            parentRegion: @media-list-as-a-list-template
            slot: subRegions
            startNewRow: false
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                t-ContentBlock--shadowBG
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: List Template Options
        }
        settings {
            staticId: Demo1
        }
    )

    region template-options-2 (
        name: Template Options
        type: plugin/previewTemplateOptions
        layout {
            sequence: 50
            parentRegion: @media-list-as-a-report-template
            slot: subRegions
            startNewRow: false
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h3
                js-headingLevel-3
            ]
        }
        accessibility {
            landmarkLabel: Report Template Options
        }
        settings {
            staticId: Demo2
        }
    )

)


````
