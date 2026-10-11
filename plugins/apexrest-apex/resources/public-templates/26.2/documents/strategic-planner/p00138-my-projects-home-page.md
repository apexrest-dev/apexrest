# My Projects — Strategic Planner

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/strategic-planner/apexlang/strategic-planner/pages/p00138-my-projects-home-page.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: fd1256d6df2cdc15d09cc1171e5abea8def987c754cc26ec80a0f6a250a454e9.

Application dependency inventory: oracle:26.2:public-template/strategic-planner/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 138 (
    name: My Projects
    alias: MY-PROJECTS-HOME-PAGE
    title: My &NOMENCLATURE_PROJECTS.
    pageGroup: @activities
    appearance {
        pageMode: modalDialog
        dialogTemplate: @/modal-dialog
        templateOptions: #DEFAULT#
    }
    dialog {
        resizable: false
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
                This report shows &NOMENCLATURE_PROJECTS!LOWER. you are the owner of or if you have incomplete tasks assigned.
                You can be associated with &NOMENCLATURE_PROJECTS!LOWER. in may ways which include:
                </P>
                <ul>
                    <li><strong>Owner</strong>: You are identified as the owner of the &NOMENCLATURE_PROJECT!LOWER.</li>
                    <li><strong>Contributor</strong>: You are assigned a task (Milestone, Review or other) on the &NOMENCLATURE_PROJECT!LOWER.</li>
                    <li><strong>Activity</strong>: You are performing some activities related to the &NOMENCLATURE_PROJECT!LOWER.</li>
                </ul>
                <p>
                    Consider this list of &NOMENCLATURE_PROJECTS!LOWER. as good candidates to associate activity with.  These are &NOMENCLATURE_PROJECTS!LOWER. you are likely to work on.
                </p>
                <p>
                    An open &NOMENCLATURE_PROJECT!LOWER. is a &NOMENCLATURE_PROJECT!LOWER. that is not 100% complete and is not 0% complete.
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
