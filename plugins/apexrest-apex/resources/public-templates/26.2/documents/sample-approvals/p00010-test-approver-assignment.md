# Test Approver Assignment — Sample Approvals

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-approvals/apexlang/sample-workflow-approvals/pages/p00010-test-approver-assignment.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 6bc526034314728e1adc20ec48bdced295fd9af2abe107e3e43ca5efb6f7ae42.

Application dependency inventory: oracle:26.2:public-template/sample-approvals/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 10 (
    name: Test Approver Assignment
    alias: TEST-APPROVER-ASSIGNMENT
    title: Test Approver Assignment
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        width: 300
        resizable: false
    }
    navigation {
        cursorFocus: firstItemOnPage
        warnOnUnsavedChanges: false
    }
    security {
        authorizationScheme: mustNotBePublicUser
    }

    region test-salary-change-approver-assignments (
        name: Test Salary Change Approver Assignments
        type: staticContent
        layout {
            sequence: 30
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        advanced {
            regionDisplaySelector: true
        }
    )

    pageItem P10_EMPNO (
        type: selectList
        label {
            label: Empno
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select ename||' ['||job||']', empno
                from eba_demo_appr_emp
                order by ename
                ```
            displayExtraValues: false
            displayNullValue: false
        }
        layout {
            sequence: 10
            region: @test-salary-change-approver-assignments
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            height: 1
        }
        validation {
            valueRequired: true
        }
        sessionState {
            storage: request
        }
    )

    pageItem P10_PROPOSED_SALARY (
        type: numberField
        label {
            label: Proposed Salary
            alignment: left
        }
        settings {
            numberAlignment: end
            virtualKeyboard: text
        }
        layout {
            sequence: 20
            region: @test-salary-change-approver-assignments
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
            width: 30
        }
        validation {
            valueRequired: true
        }
        sessionState {
            storage: request
        }
    )

    pageItem P10_TEST_RESULT_ADMIN (
        type: displayOnly
        label {
            label: Admin
            alignment: left
        }
        layout {
            sequence: 80
            region: @test-salary-change-approver-assignments
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        sessionState {
            storage: request
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P10_TEST_RESULT_APPROVER (
        type: displayOnly
        label {
            label: Approver
            alignment: left
        }
        layout {
            sequence: 70
            region: @test-salary-change-approver-assignments
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional-floating
            templateOptions: #DEFAULT#
        }
        sessionState {
            storage: request
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    button test (
        buttonName: Test
        label: Test
        layout {
            sequence: 60
            region: @test-salary-change-approver-assignments
            slot: regionBody
            column: 1
            columnSpan: 1
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    dynamicAction when-test-button-clicked (
        name: When Test Button Clicked
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @test
        }

        action native-execute-plsql-code (
            action: executeServerSideCode
            settings {
                plsqlCode:
                    ```plsql
                    eba_demo_appr.validate_admin_and_approver('SALARY_CHANGE',
                                                              :P10_EMPNO,
                                                              :P10_PROPOSED_SALARY,
                                                              :P10_TEST_RESULT_ADMIN,
                                                              :P10_TEST_RESULT_APPROVER);
                    
                    ```
                itemsToSubmit: [
                    P10_EMPNO
                    P10_PROPOSED_SALARY
                ]
                itemsToReturn: [
                    P10_TEST_RESULT_APPROVER
                    P10_TEST_RESULT_ADMIN
                ]
                showProcessing: true
            }
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

        action native-javascript-code (
            action: executeJsCode
            settings {
                jsCode:
                    ```javascript-browser
                    apex.message.clearErrors();
                    let approver_missing = $v('P10_TEST_RESULT_APPROVER') === '';
                    let admin_missing = $v('P10_TEST_RESULT_ADMIN') === '';
                    let problems = [];
                    if (approver_missing) {
                        problems.push(
                            {
                                "type" : "error",
                                "location" : "page",
                                "message": 'No salary change approver was available to assign (after excluding your username). Check Approver participant entries.'
                            }
                        ); 
                    }
                    if (admin_missing) {
                        problems.push(
                            {
                                "type" : "error",
                                "location" : "page",
                                "message": 'No salary change admin was available to assign. Check Admin participant entries.'
                            }
                        );
                    }
                    if (problems.length > 0) {
                        apex.message.showErrors(problems);
                    }
                    
                    ```
            }
            execution {
                sequence: 20
                fireOnInit: false
            }
        )

    )

)


````
