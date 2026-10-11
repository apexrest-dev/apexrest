# Getting Started — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p00500-getting-started.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 7846c032b9ef7922868d8d2fd8dc3c1ffb0e20d21cf6c9d249b6b192ba287719.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 500 (
    name: Getting Started
    alias: GETTING-STARTED
    title: Getting Started - &APP_TITLE.
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
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

    region about (
        name: About
        type: staticContent
        source {
            htmlCode: <p>Universal Theme is a responsive, versatile, and customizable user interface for your APEX apps. It is designed uniquely for Oracle APEX to make it easy for developers to build beautiful, modern applications, at any scale, for any purpose, that work on any device.</p>
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
                t-ContentBlock--h1
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region explore-universal-theme (
        name: Explore Universal Theme
        type: list
        source {
            list: @ut-get-started-navigation
        }
        layout {
            sequence: 50
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h1
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            listTemplate: @/cards
            templateOptions: [
                #DEFAULT#
                t-Cards--featured force-fa-lg
                t-Cards--displayIcons
                t-Cards--3cols
                t-Cards--hideBody
                t-Cards--iconsRounded
                t-Cards--animColorFill
            ]
        }
    )

    region getting-started (
        name: Getting Started
        type: staticContent
        source {
            htmlCode: <p>It is easy to get started using Universal Theme. Just follow the Create Application wizard to get something up and running. From here you can start to build out your application, start customizing it using Template Options and Theme Roller, and learn all about it in this very app.</p>
        }
        layout {
            sequence: 40
            slot: body
            columnSpan: 8
            columnCssClasses: col-sm-12
        }
        appearance {
            template: @/content-block
            templateOptions: [
                #DEFAULT#
                t-ContentBlock--h1
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region oracle-apex-universal-theme (
        name: Oracle APEX Universal Theme
        type: staticContent
        layout {
            sequence: 20
            slot: breadcrumbBar
        }
        appearance {
            template: @/hero
            templateOptions: #DEFAULT#
            icon: app-sample-universal-theme
        }
        advanced {
            regionDisplaySelector: true
        }
    )

)


````
