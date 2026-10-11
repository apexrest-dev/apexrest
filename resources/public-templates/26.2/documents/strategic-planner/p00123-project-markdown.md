# &NOMENCLATURE_PROJECT. Markdown — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00123-project-markdown.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 5cbc3d0b64d1106b2cfd4c65c2d07e7ef3be7a9ffdf335a3b9ec967c8b35e21a.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 123 (
    name: &NOMENCLATURE_PROJECT. Markdown
    alias: PROJECT-MARKDOWN
    title: &NOMENCLATURE_PROJECT. Markdown
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/drawer
        templateOptions: [
            #DEFAULT#
            js-dialog-class-t-Drawer--pullOutEnd
        ]
    }

    region buttons (
        name: buttons
        type: staticContent
        layout {
            sequence: 20
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
    )

    region display-markdown (
        name: Display Markdown
        type: dynamicContent
        source {
            plsqlFunctionBody: sys.htp.p(apex_markdown.to_html(:P123_PROJECT_MD));
        }
        layout {
            sequence: 20
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        serverSideCondition {
            type: itemIsNotNull
            item: :P123_PROJECT_MD
        }
    )

    region hidden-items (
        name: hidden items
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes-no-grid
            templateOptions: #DEFAULT#
        }
        advanced {
            excludeTitleFromTranslation: true
        }
    )

    pageItem P123_PROJECT_ID (
        type: hidden
        layout {
            sequence: 10
            region: @hidden-items
            slot: regionBody
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P123_PROJECT_MD (
        type: hidden
        layout {
            sequence: 20
            region: @hidden-items
            slot: regionBody
        }
        sessionState {
            dataType: clob
        }
        security {
            sessionStateProtection: restricted
        }
    )

    button copy (
        buttonName: copy
        label: Copy
        layout {
            sequence: 10
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P123_PROJECT_MD
        }
    )

    button download (
        buttonName: download
        label: Download
        layout {
            sequence: 20
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
            executeValidations: false
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P123_PROJECT_MD
        }
    )

    dynamicAction copy-markdown (
        name: copy markdown
        execution {
            sequence: 20
        }
        when {
            event: click
            selectionType: button
            button: @copy
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    (async () => {
                        const value = apex.item("P123_PROJECT_MD").getValue();
                    
                        try {
                            if (navigator.clipboard && window.isSecureContext) {
                                await navigator.clipboard.writeText(value);
                            } else {
                                const textarea = document.createElement("textarea");
                                textarea.value = value;
                                textarea.style.position = "fixed";
                                textarea.style.opacity = "0";
                                document.body.appendChild(textarea);
                                textarea.select();
                    
                                if (!document.execCommand("copy")) {
                                    throw new Error("Copy failed");
                                }
                    
                                textarea.remove();
                            }
                    
                            apex.message.showPageSuccess("Copied to clipboard.");
                        } catch (error) {
                            apex.message.alert("Unable to copy the item value.");
                        }
                    })();
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    dynamicAction download (
        name: download
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @download
        }

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    const text = apex.item("P123_PROJECT_MD").getValue() || "";
                    
                    const blob = new Blob([text], {
                      type: "text/plain;charset=utf-8"
                    });
                    
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    
                    link.href = url;
                    link.download = "markdown.txt";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    ```
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    process full-summary (
        name: create markdown
        type: executeCode
        source {
            plsqlCode:
                ```plsql
                :P123_PROJECT_MD := sp_summary_util.generate_project_high_level (p_project_id => :P123_PROJECT_ID );
                
                ```
        }
        execution {
            sequence: 20
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 26246334088160998143
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P123_PROJECT_ID
        }
    )

)


````
