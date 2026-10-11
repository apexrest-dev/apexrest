# My Activities — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00131-my-activities-help.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: d10213cccb1b6973e4c4092e028b5b795882d9e00369657cc58a2d74dcc17769.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 131 (
    name: My Activities
    alias: MY-ACTIVITIES-HELP
    title: My Activities
    pageGroup: @activities
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
    }
    config {
        buildOption: @activity-planning
    }

    region about (
        name: About
        type: dynamicContent
        source {
            plsqlFunctionBody:
                ```plsql
                declare
                   l_clob clob;
                begin
                l_clob := '<p>
                An activity is something that consumes time identified by a start and end date.  
                This report shows your current and future (planned) activities.  
                This report excludes past activities.
                </P>
                <p>
                An activity can be optionally associated with a &NOMENCLATURE_PROJECT!LOWER.. 
                When an activity is associated with a &NOMENCLATURE_PROJECT!LOWER. the &NOMENCLATURE_PROJECT!LOWER. title becomes a link to the &NOMENCLATURE_PROJECT!LOWER. details.
                The "2 days ago" style timeframe indicates last change to the activity.
                </p>
                <p>
                     Click the dot-dot-dot actions menu controls to perform actions related to activities.
                </p>
                <p>
                    Activity Attributes:
                    <ul>
                        <li><strong>Type</strong>: Type of activity performed, see list below for types of activities defined for this application.</li>
                        <li><strong>Activity</strong>: Is a short description, up to 280 characters, of what activity is intended to occur between two dates.</li>
                        <li><strong>Start Date</strong>: Date activity started or is planned to start.</li>
                        <li><strong>End Date</strong>: Date activity was completed or is planned to be completed.</li>
                        <li><strong>Optional &NOMENCLATURE_PROJECT!LOWER.:</strong>: Defines related &NOMENCLATURE_PROJECT!LOWER. if work is in support of a specific &NOMENCLATURE_PROJECT!LOWER..</li>
                        <li><strong>Owner</strong>: Defines who is doing the activity.</li>
                        <li><strong>Tags</strong>: Comma seperated list of tags to help filter activities.</li>
                        <li><strong>URL</strong>: Optional URL relating to the activity.</li>
                    </ul>
                </p>
                <br />
                <br />';
                
                l_clob := replace(l_clob,'&NOMENCLATURE_PROJECTS.',:NOMENCLATURE_PROJECTS);
                l_clob := replace(l_clob,'&NOMENCLATURE_PROJECT.',:NOMENCLATURE_PROJECT);
                l_clob := replace(l_clob,'&NOMENCLATURE_PROJECTS!LOWER.',lower(:NOMENCLATURE_PROJECTS));
                l_clob := replace(l_clob,'&NOMENCLATURE_PROJECT!LOWER.',lower(:NOMENCLATURE_PROJECT));
                return l_clob;
                end;
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: #DEFAULT#
        }
    )

)


````
