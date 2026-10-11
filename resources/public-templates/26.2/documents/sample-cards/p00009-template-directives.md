# Template Directives — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00009-template-directives.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: e520b42a714985d770e7694851823b04ab8ebfb8bac570a01cf54056c2d1b581.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 9 (
    name: Template Directives
    alias: TEMPLATE-DIRECTIVES
    title: &APP_NAME. - Template Directives
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    css {
        inline:
            ```css
            .a-tags {
                list-style: none;
            }
            .a-tag {
                background-color: #ebe7e7;
                color: #666;
                border-radius: 5px;
                padding: 5px;
                margin: 3px;
                display: inline;
            }
            ```
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region about-this-page (
        name: About this page
        type: staticContent
        source {
            htmlCode:
                ```html
                <p>You can add template directives in Cards Advanced Formatting.</p>
                <p>This page uses TAGS column which contains comma separated values of the employee focus area. The Cards Body has the following HTML Expression:
                <pre>
                {if TAGS/}
                    &lt;ul class=&quot;a-tags&quot;&gt;
                    {loop &quot;,&quot; TAGS/}
                 	    &lt;li class=&quot;a-tag&quot;&gt;&amp;APEX$ITEM.&lt;/li&gt;
                    {endloop/}
                    &lt;/ul&gt;
                {endif/}
                </pre>
                
                If TAGS column value not null, the loop directive takes a value, in this case the TAGS comma separated value and splits it up into a list. The special symbol APEX$ITEM takes on the value of the current list item value.
                </p>
                ```
        }
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/collapsible
            templateOptions: [
                #DEFAULT#
                is-collapsed
                t-Region--scrollBody
            ]
            icon: fa-file-brackets
            renderComponents: belowContent
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

    region media-image (
        name: Media Image
        type: cards
        source {
            location: localDatabase
            tableName: EBA_DEMO_CARD_EMP
        }
        layout {
            sequence: 30
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: [
                #DEFAULT#
                t-CardsRegion--styleB
            ]
            cssClasses: test
        }
        advanced {
            regionDisplaySelector: true
        }
        componentAppearance {
            gridColumns: 3
        }
        card {
            primaryKeyColumn1: EMPNO
        }
        title {
            column: ENAME
        }
        subtitle {
            column: JOB
        }
        body {
            advancedFormatting: true
            htmlExpression:
                ```html
                {if TAGS/}
                    <ul class="a-tags">
                    {loop "," TAGS/}
                 	    <li class="a-tag">&APEX$ITEM.</li>
                    {endloop/}
                    </ul>
                {endif/}
                ```
        }
        media {
            source: blobColumn
            blobColumn: PROFILE_IMAGE
            position: first
            appearance: widescreen
            imageDescription: &ENAME. - &JOB.
        }
        blobAttributes {
            mimeTypeColumn: MIMETYPE
            lastUpdatedColumn: IMAGE_LAST_UPDATE
        }
        pagination {
            showTotalCount: true
        }

        action action (
            type: fullCard
            layout {
                sequence: 10
            }
            behavior {
                target: {
                    page: 14
                    items: {
                        P14_EMPNO: &EMPNO.
                    }
                    clearCache: 14
                }
            }
        )

    )

)


````
