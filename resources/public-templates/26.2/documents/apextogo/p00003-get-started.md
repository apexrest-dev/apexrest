# Get Started — Apextogo

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apextogo/apexlang/apextogo/pages/p00003-get-started.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 04cf47fa32074256d3addcecac001a0c537c8b10c4e594a99cb3e59948f8e73c.

Application dependency inventory: oracle:26.2:public-template/apextogo/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 3 (
    name: Get Started
    alias: GET-STARTED
    title: Get Started
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
            sequence: 70
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

    region get-started-image (
        name: Get Started Image
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
            fileUrl: #APP_FILES#splash/splash-3.png
        }
    )

    region get-started-text (
        name: Get Started Text
        type: staticContent
        source {
            htmlCode: <p>Get the best experience on your mobile device<a href="#action$a-pwa-install"> by installing this app</a>.</p>
        }
        layout {
            sequence: 40
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

    button go (
        buttonName: GO
        label: Go!
        layout {
            sequence: 50
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
                page: 9999
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

)


````
