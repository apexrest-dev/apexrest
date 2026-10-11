# Connect By — Sample Reporting

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-reporting/apexlang/sample-reporting/pages/p00026-connect-by.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: f7c3316449522a672f62ac9f46c95c1f9280662dbcb98c0832479226b92e7bea.

Application dependency inventory: oracle:26.2:public-template/sample-reporting/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 26 (
    name: Connect By
    alias: CONNECT-BY
    title: Connect By
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    advanced {
        reloadOnSubmit: always
    }
    help {
        helpText: No help is available for this page.
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode: <p>If a table contains hierarchical data, you can use CONNECT BY PRIOR to access the details about the current row's parents.  The Indented Hierarchy display in the classic report below is created using the pseudo column LEVEL.  That numerical representation is used to indent the employees using LPAD, producing a tree-like display.  Using SYS_CONNECT_BY_PATH, includes the full parent path (rather than just the immediate parent value).  The greater than sign is used as the separator and it is "LTRIM"ed so that it will not display before the president's name.</p>
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

    region breadcrumb (
        name: Breadcrumb
        type: breadcrumb
        source {
            breadcrumb: @breadcrumb
        }
        layout {
            sequence: 40
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

    region connect-by (
        name: Connect By
        type: classicReport
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                select 
                       empno, 
                       mgr,
                       ename, 
                       case when level > 1
                            then lpad(' ',((level-1)*3)+1,' . ')
                            end || ename padded_ename,
                       ltrim(sys_connect_by_path(ename,' > '),' > ') manager_hierarchy
                from eba_demo_ir_emp
                connect by prior empno = mgr
                start with mgr is null
                order siblings by ename
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--noPadding
                t-Region--scrollBody
                t-Region--noBorder
                t-Region--hideHeader js-addHiddenHeadingRoleDesc
            ]
        }
        advanced {
            htmlDomId: QUERY
        }
        reportLayout {
            numberOfRows: 10
        }
        componentAppearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Report--stretch
            ]
            showNullValuesAs: " - "
        }
        messages {
            whenNoDataFound: no data found
        }
        componentAdvanced {
            stripHtml: true
        }

        column EMPNO (
            reportColumnQueryId: 1
            derivedColumn: N
            heading {
                heading: Employee Number
            }
            layout {
                sequence: 1
            }
            sorting {
                sortable: false
            }
        )

        column ENAME (
            reportColumnQueryId: 3
            derivedColumn: N
            heading {
                heading: Employee Name
            }
            layout {
                sequence: 3
            }
            sorting {
                sortable: false
            }
        )

        column MANAGER_HIERARCHY (
            reportColumnQueryId: 5
            derivedColumn: N
            heading {
                heading: Full Path
            }
            layout {
                sequence: 5
            }
            sorting {
                sortable: false
            }
        )

        column MGR (
            reportColumnQueryId: 2
            derivedColumn: N
            heading {
                heading: Manager
            }
            layout {
                sequence: 2
            }
            sorting {
                sortable: false
            }
        )

        column PADDED_ENAME (
            reportColumnQueryId: 4
            derivedColumn: N
            heading {
                heading: Indented Hierarchy
            }
            layout {
                sequence: 4
            }
            sorting {
                sortable: false
            }
        )

    )

    region sql-source (
        name: SQL Source
        type: plugin/sourceDisplay
        layout {
            sequence: 10
            parentRegion: @connect-by
            slot: subRegions
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--noBorder
                t-Region--scrollBody
            ]
        }
        settings {
            regionStaticId: QUERY
        }
    )

)


````
