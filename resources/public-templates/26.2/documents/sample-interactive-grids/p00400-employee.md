# Employee — Sample Interactive Grids

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-interactive-grids/apexlang/sample-interactive-grids/pages/p00400-employee.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 4cde12c1180829ff69440a759b220d5d29245d87a8de854fc36833d9cf54a7cf.

Application dependency inventory: oracle:26.2:public-template/sample-interactive-grids/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 400 (
    name: Employee
    alias: EMPLOYEE
    title: Employee
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    javaScript {
        functionAndGlobalVariableDeclaration: var htmldb_delete_message='"DELETE_CONFIRM_MSG"';
    }
    help {
        helpText: No help is available for this page.
    }

    region buttons (
        name: Buttons
        type: staticContent
        layout {
            sequence: 10
            slot: dialogFooter
        }
        appearance {
            template: @/buttons-container
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    region employee (
        name: Employee
        type: staticContent
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
        settings {
            outputAs: text
        }
    )

    pageItem P400_COMM (
        type: numberField
        label {
            label: Commission
            alignment: left
        }
        settings {
            numberAlignment: end
            virtualKeyboard: text
        }
        layout {
            sequence: 80
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: COMM
            used: always
        }
    )

    pageItem P400_DEPTNO (
        type: selectList
        label {
            label: Deptartment
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                select dname, deptno 
                from eba_demo_ig_dept
                ```
        }
        layout {
            sequence: 40
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            type: databaseColumn
            databaseColumn: DEPTNO
            used: always
        }
    )

    pageItem P400_EMPNO (
        type: hidden
        layout {
            sequence: 10
            region: @employee
            slot: regionBody
        }
        source {
            type: databaseColumn
            databaseColumn: EMPNO
            used: always
        }
        security {
            sessionStateProtection: checksumRequiredSessionLevel
        }
    )

    pageItem P400_ENAME (
        type: textField
        label {
            label: Name
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 20
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 60
        }
        source {
            type: databaseColumn
            databaseColumn: ENAME
            used: always
        }
    )

    pageItem P400_HIREDATE (
        type: datePicker
        label {
            label: Hire Date
            alignment: left
        }
        layout {
            sequence: 60
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: HIREDATE
            used: always
        }
    )

    pageItem P400_JOB (
        type: textField
        label {
            label: Job
            alignment: left
        }
        settings {
            trimSpaces: none
        }
        layout {
            sequence: 30
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 9
        }
        source {
            type: databaseColumn
            databaseColumn: JOB
            used: always
        }
    )

    pageItem P400_MGR (
        type: selectList
        label {
            label: Manager
            alignment: left
        }
        lov {
            type: sqlQuery
            sqlQuery:
                ```sql
                Select ename,empno 
                from eba_demo_ig_emp 
                where job = 'MANAGER' 
                or job = 'PRESIDENT'
                ```
        }
        layout {
            sequence: 50
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            height: 1
        }
        source {
            type: databaseColumn
            databaseColumn: MGR
            used: always
        }
    )

    pageItem P400_NOTES (
        type: textarea
        label {
            label: Notes
            alignment: left
        }
        layout {
            sequence: 100
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 60
            height: 4
        }
        validation {
            maxLength: 1000
        }
        source {
            type: databaseColumn
            databaseColumn: NOTES
            used: always
        }
    )

    pageItem P400_ONLEAVE (
        type: switch
        label {
            label: On Leave
            alignment: left
        }
        layout {
            sequence: 90
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/required
            templateOptions: #DEFAULT#
        }
        source {
            type: databaseColumn
            databaseColumn: ONLEAVE
            used: always
        }
    )

    pageItem P400_SAL (
        type: numberField
        label {
            label: Salary
            alignment: left
        }
        settings {
            numberAlignment: end
            virtualKeyboard: text
        }
        layout {
            sequence: 70
            region: @employee
            slot: regionBody
            alignment: left
        }
        appearance {
            template: @/optional
            templateOptions: #DEFAULT#
            width: 32
        }
        validation {
            maxLength: 255
        }
        source {
            type: databaseColumn
            databaseColumn: SAL
            used: always
        }
    )

    button cancel (
        buttonName: CANCEL
        label: Cancel
        layout {
            sequence: 10
            region: @buttons
            slot: close
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: definedByDynamicAction
        }
    )

    button create (
        buttonName: CREATE
        label: Create
        layout {
            sequence: 40
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            databaseAction: insert
        }
        serverSideCondition {
            type: itemIsNull
            item: P400_EMPNO
        }
    )

    button delete (
        buttonName: DELETE
        label: Delete
        layout {
            sequence: 20
            region: @buttons
            slot: delete
        }
        appearance {
            buttonTemplate: @/text
            templateOptions: #DEFAULT#
        }
        behavior {
            action: redirectUrl
            targetUrl: javascript:apex.confirm(htmldb_delete_message,'DELETE');
            executeValidations: false
            warnOnUnsavedChanges: doNotCheck
            databaseAction: delete
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P400_EMPNO
        }
    )

    button save (
        buttonName: SAVE
        label: Apply Changes
        layout {
            sequence: 30
            region: @buttons
            slot: next
        }
        appearance {
            buttonTemplate: @/text
            hot: true
            templateOptions: #DEFAULT#
        }
        behavior {
            warnOnUnsavedChanges: doNotCheck
            databaseAction: update
        }
        serverSideCondition {
            type: itemIsNotNull
            item: P400_EMPNO
        }
    )

    dynamicAction cancel-dialog (
        name: Cancel Dialog
        execution {
            sequence: 10
        }
        when {
            event: click
            selectionType: button
            button: @cancel
        }

        action native-dialog-cancel (
            action: cancelDialog
            execution {
                sequence: 10
                fireOnInit: false
            }
        )

    )

    process close-dialog (
        name: Close Dialog
        type: closeDialog
        settings {
            showSuccessMessages: false
        }
        execution {
            sequence: 50
        }
        successMessage {
            successMessage: Success
        }
        advanced {
            executionMappingIdentifier: 1340089812711668222
        }
        serverSideCondition {
            type: requestIsContainedInValue
            value: CREATE,SAVE,DELETE
        }
    )

    process fetch-row-from-eba-demo-ig-emp (
        name: Fetch Row from EBA_DEMO_IG_EMP
        type: autoRowFetch
        source {
            tableName: EBA_DEMO_IG_EMP
            pkColumn: EMPNO
            pkItem: P400_EMPNO
        }
        execution {
            sequence: 10
            point: afterHeader
        }
        advanced {
            executionMappingIdentifier: 1340088570559668221
        }
    )

    process process-row-of-eba-demo-ig-emp (
        name: Process Row of EBA_DEMO_IG_EMP
        type: autoRowProcessing
        target {
            tableName: EBA_DEMO_IG_EMP
            pkColumn: EMPNO
            pkItem: P400_EMPNO
        }
        execution {
            sequence: 30
        }
        successMessage {
            successMessage: Action Processed.
        }
        advanced {
            executionMappingIdentifier: 1340088962261668221
        }
    )

    process reset-page (
        name: reset page
        type: clearSessionState
        execution {
            sequence: 40
        }
        advanced {
            executionMappingIdentifier: 1340089406025668221
        }
        serverSideCondition {
            whenButtonPressed: @delete
        }
    )

)


````
