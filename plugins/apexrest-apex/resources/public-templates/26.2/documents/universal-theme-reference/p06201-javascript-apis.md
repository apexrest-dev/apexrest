# JavaScript APIs — Universal Theme Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/universal-theme-reference/apexlang/ut/pages/p06201-javascript-apis.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: aa7e32bffc42e8d1886d37012d800fefafd386fd3196fdd249dfcc1765928ba1.

Application dependency inventory: oracle:26.2:public-template/universal-theme-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 6201 (
    name: JavaScript APIs
    alias: JAVASCRIPT-APIS
    title: JavaScript APIs - &APP_TITLE.
    pageGroup: @tools-and-utilities
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
        cssClasses: dm-Page
    }
    navigation {
        warnOnUnsavedChanges: false
    }
    css {
        inline:
            ```css
            code.event-name {
                background: rgba(147, 180, 197, 0.25);
                padding: 6px 8px;
                border-radius: 3px;
                text-shadow: 1px 1px #fff;
            }
            
            code.event-name:hover {
                color: #000;
                background:#eee
            }
            
            .dm-Code {
                border-radius: var(--ut-component-border-radius);
                border: var(--ut-component-border-width) solid var(--ut-component-border-color);
            }
            ```
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

    region api-list (
        name: API List
        type: staticContent
        source {
            htmlCode:
                ```html
                <ol class="event-list">
                    <li class="margin-bottom-md">
                        <p><code class="event-name">apex.theme42.util.configAPEXMsgs( pOptions )</code></p><p>Configure the display behavior of success messages. You can use this API to programmatically determine how long the success message is displayed before automatically dismissing itself.</p>
                <pre class="dm-Code lang-js"><code>apex.jQuery(function() {
                  apex.theme42.util.configAPEXMsgs({
                    autoDismiss: true,
                    duration: 5000  // duration is optional (Default is 3000 milliseconds)
                  });
                });</code></pre>
                <p><small>Note: The previous name for this API, <code>apex.theme42.configureSuccessMessages</code>, is deprecated and will be removed in a future release.  Please update your application to use the new name.</small></p>
                    </li>
                    
                    <li class="margin-bottom-md">
                        <p><code class="event-name">apex.theme42.util.scrollTo( pId )</code></p>
                        <p>Enables smooth scrolling to the specified anchor, taking into account the sticky top height so the content is not partially blocked.</p>
                <pre class="dm-Code lang-js"><code>// Example 1: Simply call it to scroll to an region
                apex.theme42.util.scrollTo( 'my_region' );
                
                // Example 2: Use smooth scroll for all anchor links such as href="#my_content".
                apex.jQuery(function() {
                  $( "a[href^='#']" ).click(function( e ) {
                    e.preventDefault();
                    apex.theme42.util.scrollTo( apex.jQuery( this ).attr( 'href' ) );
                  });
                });</code></pre>
                    </li>
                </ol>
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

    region introduction (
        name: Introduction
        type: staticContent
        source {
            htmlCode: <p>Universal Theme provides the following JavaScript APIs that you may find useful in your applications.</p>
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
