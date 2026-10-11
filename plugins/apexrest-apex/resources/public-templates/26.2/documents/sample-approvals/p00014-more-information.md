# More Information — Sample Approvals

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-approvals/apexlang/sample-workflow-approvals/pages/p00014-more-information.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: c4ae6d06d8304082a04ce69e8df51f97564fd4669a56b80d3b5a27f01948b123.

Application dependency inventory: oracle:26.2:public-template/sample-approvals/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 14 (
    name: More Information
    alias: MORE-INFORMATION
    title: More Information
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            .is-markdownified code {
               background-color: inherit !important;
               border-style: none !important;
            }
            ```
    }
    security {
        authentication: public
    }

    region approvals-and-tasks-features (
        name: Approvals and Tasks Features
        type: plugin/markdownRegion
        layout {
            sequence: 20
            parentRegion: @more-information
            slot: tabs
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        settings {
            source: applicationStaticFile
            fileName: AboutTheApprovalsFeature.md
        }
    )

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
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

    region more-information (
        name: More Information
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>
                    The <em>Sample Workflow, Approvals, and Tasks</em> app illustrates
                    the key functionality of the Oracle APEX Workflow, Approvals, and Tasks components. 
                    It lets users manage requests to change an employee's salary, job, and bank acount,
                    as well as request a new laptop, after getting the approval of an appropriate individual. 
                    Managers can also initiate a subordinate's appraisal process.
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/tabs-container
            templateOptions: [
                #DEFAULT#
                js-useLocalStorage
                t-TabsRegion-mod--simple
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    region sample-application (
        name: Sample Application
        type: plugin/markdownRegion
        layout {
            sequence: 40
            parentRegion: @more-information
            slot: tabs
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        settings {
            source: applicationStaticFile
            fileName: AboutTheSampleApplication.md
        }
    )

    region using-the-sample (
        name: Using the Sample
        type: plugin/markdownRegion
        layout {
            sequence: 50
            parentRegion: @more-information
            slot: tabs
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        settings {
            source: applicationStaticFile
            fileName: UsingTheSample.md
        }
    )

    region workflow-features (
        name: Workflow Features
        type: plugin/markdownRegion
        layout {
            sequence: 10
            parentRegion: @more-information
            slot: tabs
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        settings {
            source: applicationStaticFile
            fileName: AboutTheWorkflowFeature.md
        }
    )

)


````
