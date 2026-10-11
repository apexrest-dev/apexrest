# About Kanban — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00163-about-kanban.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 8b800db51b260d04b5fe8c9234c904e6bcf7a310d268b382282fa6bc31dafd04.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 163 (
    name: About Kanban
    alias: ABOUT-KANBAN
    title: About Kanban
    pageGroup: @activities
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        height: 600
        resizable: false
    }
    config {
        buildOption: @kanban
    }

    region kanban-board (
        name: Kanban Board
        type: staticContent
        source {
            htmlCode:
                ```html
                    <h3>Kanban Board</h3>
                    <p>A Kanban board provides a multi-dimensional view of projects to assist with the management and planning of projects at a Programme level. A Kanban board tracks three stages: To Do, In Progress, and Done, which in Strategic Planner is represented by five columns:</p>
                
                    <ol>
                        <li><strong>New:</strong> Candidate projects (10%-20% complete).</li>
                        <li><strong>Architecting:</strong> Being scoped and estimated (30% complete).</li>
                        <li><strong>Ready:</strong> Approved and ready to start (40% complete).</li>
                        <li><strong>In Progress:</strong> Actively in development (50%-70% complete).</li>
                        <li><strong>Done:</strong> Development finished, verifying or merging (80%-100% complete).</li>
                    </ol>
                
                    <p>Completed projects that are not release-dependent and projects that have been released are not displayed. Rejected projects are also not displayed.</p>
                
                    <h4>Drag and Drop</h4>
                    <p>Projects can be dragged between columns and groups, providing a quick method to update projects. To drag a project, click and hold, then move it to the new location. A single click on the project will open a detailed view and edit drawer.</p>
                
                    <h4>Weighted Shortest Job First (WSJF)</h4>
                    <p>Projects are listed by priority multiplied by the estimated days effort, in ascending order . This ordering ensures that projects with the highest value for the least effort are likely to be done next.</p>
                
                    <h4>Bottlenecks</h4>
                    <p>The Kanban board can be used to identify bottlenecks, where projects in progress will begin to pile up. It is good practice to limit the amount of work in progress for each group and prioritize resolving problems over starting new projects.</p>
                
                    <h3>Cumulative Flow</h3>
                    <p>Click the ellipsis to view an accompanying Cumulative Flow chart. The Cumulative Flow shows the number of projects at each stage of completion over time. Consistent spacing and angles indicate an even flow through the system, whereas diverging lines indicate uneven flow and bottlenecks. Use the Timescale, Resolution, and Zoom functions to examine different points in the process in more detail.</p>
                
                    <h3>Control Chart</h3>
                    <p>Another visualization is the Control Chart, which shows how long projects take between various stages. This is used to compare how long projects of equal size take to complete. Variances can indicate poor estimating or bottlenecks. Trend analysis can be used to evaluate the effect new strategies are having on efficiency.</p>
                ```
        }
        layout {
            sequence: 10
            slot: contentBody
        }
        appearance {
            template: @/blank-with-attributes
            templateOptions: [
                #DEFAULT#
                margin-top-none
            ]
        }
        advanced {
            regionDisplaySelector: true
        }
    )

)


````
