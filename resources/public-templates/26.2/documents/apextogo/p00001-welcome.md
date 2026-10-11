# Welcome — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00001-welcome.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 5c38354c1b08f88854d85f8e2c5e1cd9b2c5557b0d785b1705e2ef004ccb20ed.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1 (
    name: Welcome
    alias: WELCOME
    title: Welcome
    appearance {
        pageTemplate: @/login
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
        formAutoComplete: true
    }

    region background-image (
        name: Background Image
        type: staticContent
        layout {
            sequence: 50
            slot: backgroundImage
        }
        appearance {
            template: @/image
            templateOptions: [
                #DEFAULT#
                t-ImageRegion--auto
                t-ImageRegion--cover
                t-ImageRegion--square
                t-ImageRegion--noFilter
            ]
        }
        accessibility {
            useLandmark: false
        }
        image {
            fileUrl: #APP_FILES#background.jpg
        }
    )

    region welcome-image (
        name: Welcome Image
        type: staticContent
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/image
            templateOptions: [
                #DEFAULT#
                t-ImageRegion--auto
                t-ImageRegion--cover
                t-ImageRegion--square
                t-ImageRegion--noFilter
                margin-top-none
            ]
            cssClasses: [
                u-flex
                u-justify-content-center
            ]
        }
        accessibility {
            useLandmark: false
        }
        image {
            fileUrl: #APP_FILES#splash/splash-1.png
        }
    )

    region welcome-text (
        name: Welcome Text
        type: staticContent
        source {
            htmlCode: <p>Experience the first Oracle APEX sample application designed for mobile.</p>
        }
        layout {
            sequence: 30
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-top-md
                margin-bottom-lg
            ]
            cssClasses: u-textCenter
        }
        accessibility {
            useLandmark: false
        }
    )

    button next (
        buttonName: NEXT
        label: Next
        layout {
            sequence: 40
            slot: contentBody
            column: 5
            columnSpan: 4
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: [
                #DEFAULT#
                t-Button--large
                t-Button--stretch
            ]
            cssClasses: [
                mxw320
                margin-auto
            ]
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 2
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
