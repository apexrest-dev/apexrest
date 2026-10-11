# Design Overview — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p00401-design-overview.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 03f720ac52c985d59f99add92709eddf02d56947bb0bf0ba6fb7f5b052935c26.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 401 (
    name: Design Overview
    alias: DESIGN-OVERVIEW
    title: Design Overview - &APP_TITLE.
    pageGroup: @design
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

    region design (
        name: Design
        type: staticContent
        layout {
            sequence: 10
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: fa-lg fa-design u-color-3
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region key-principles (
        name: Key Principles
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>There are three key aspects of Universal Theme that make it ideally suited for Application Express development: Responsive Design, Versatile UI Components, and Easy Customization.</p>
                
                <h3 class="margin-top-lg"><span class="fa fa-number-1 fa-lg u-color-3-txt"></span> Responsive Design</h3>
                <p>Universal Theme has been designed from the very beginning to work just as well on small screen devices (phones, tablet) as it does on larger screen devices (laptops, desktops).</p>
                <p>This means that the UI components in Universal Theme work across varying screen resolutions while maintaining the same or similar functionality.  In addition, Universal Theme takes full advantage of ultra high screen resolutions by utilizing vector graphics where possible, and relying upon CSS3 features for UI styling.</p>
                
                <h3 class="margin-top-lg"><span class="fa fa-number-2 fa-lg u-color-3-txt"></span> Versatile UI</h3>
                <p>Universal Theme provides the components / building blocks necessary to build practically any type of business application UI.</p>
                <p>From Cards, Forms, Menus, Tabs, Reports, and so much more, these components have been developed with the best practices following common and popular UI patterns. You can browse all of the components provided with Universal Theme by navigating to the Components section of this application.</p>
                
                <h3 class="margin-top-lg"><span class="fa fa-number-3 fa-lg u-color-3-txt"></span> Easy Customization</h3>
                <p>Even for the most basic of requirements, theming and customization is a key and necessary ingredient to the success of your application.</p>
                <p>With Universal Theme, you can effortlessly customize and fully control the look and feel of your applications without becoming an expert in UI design, HTML, CSS, or JavaScript. Using Theme Roller and Template Options, you can easily customize your application to fit your company's brand, and customize the look and feel of various components using Template Options. All of this is possible during runtime, so what you see is what you really get.</p>
                ```
        }
        layout {
            sequence: 30
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

    region what-is-universal-theme (
        name: What is Universal Theme?
        type: staticContent
        source {
            htmlCode: <p>Universal Theme is a user interface for Application Express that enables developers to build modern web applications without requiring extensive knowledge of HTML, CSS, or JavaScript. With some working knowledge of Application Express, you can use Universal Theme to easily build a responsive application that is highly accessible, easily customizable, and easy to maintain.</p>
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

)


````
