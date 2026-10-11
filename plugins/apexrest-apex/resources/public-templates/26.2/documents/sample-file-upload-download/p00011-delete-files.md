# Delete Files — Sample File Upload Download

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-file-upload-download/apexlang/sample-file-upload-download/pages/p00011-delete-files.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e908bb8f4c84ed800825db052ff8797c13a42e55846d1b5de0e759597436a5a4.

Application dependency inventory: oracle:26.2:public-template/sample-file-upload-download/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Delete Files
    alias: DELETE-FILES
    title: Delete Files
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    security {
        formAutoComplete: true
    }
    advanced {
        reloadOnSubmit: always
    }

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 20
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

    region delete-files (
        name: Delete Files
        type: staticContent
        source {
            htmlCode: <span class="infoTextRegion"><p>This action will delete all files used by this application.  Project data will not be deleted.  You may wish to delete sample files to conserve space.</p></span>
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 20
            region: @breadcrumb
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectThisApp
            target: {
                page: 7
            }
            warnOnUnsavedChanges: doNotCheck
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete Files
        layout {
            sequence: 10
            region: @breadcrumb
            slot: delete
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: [
                #DEFAULT#
                t-Button--simple
                t-Button--danger
            ]
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
        }
    )

    process delete-files (
        name: delete files
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                delete from EBA_DEMO_FILES;
                commit;
                ```
        }
        execution {
            sequence: 10
        }
        successMessage {
            successMessage: All rows deleted from files table.
        }
        advanced {
            executionMappingIdentifier: 3241218877384046608
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

    branch (
        execution {
            sequence: 10
        }
        behavior {
            target: {
                page: 7
            }
        }
        comments {
            comments: Created 27-APR-2012 07:39 by MIKE
        }
    )

)


````
