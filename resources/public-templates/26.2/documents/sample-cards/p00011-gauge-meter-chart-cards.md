# Gauge Meter Chart Cards — Sample Cards

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-cards/apexlang/sample-cards/pages/p00011-gauge-meter-chart-cards.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 65f7ca1b87666e7b78f8232228085b29217615060ee4fe824044a2d48ae28305.

Application dependency inventory: oracle:26.2:public-template/sample-cards/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 11 (
    name: Gauge Meter Chart Cards
    alias: GAUGE-METER-CHART-CARDS
    title: &APP_NAME. - Charts
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    javaScript {
        fileUrls: "[require jet]"
        executeWhenPageLoads: "require([\"ojs/ojgauge\"], function() {});"
    }
    css {
        fileUrls: #JET_CSS_DIRECTORY#alta/oj-alta-notag-min.css
        inline:
            ```css
            .speedometer {
                align: center;
                margin-top: 5px;
                margin-bottom: 5px;
                height: 120px;
                width: 100%;
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
                <p>You can display charts on cards using <a href="&JET_VISUALIZATION_URL." target="_blank" rel="noopener noreferrer external">Oracle JET Data Visualizations</a>. This page uses <a href="https://www.oracle.com/webfolder/technetwork/jet/jetCookbook.html?component=statusMeterGauge&demo=statusMeterGaugeCircular" target="_blank" rel="noopener noreferrer external">Status Meter Gauge</a>.</p>
                
                <p>Cards region does not load necessary Oracle JET library and CSS for you.  To display the vehicle speed using Status Meter Gauge:</p>
                
                <ol>
                
                
                <li>
                    Enter <em>[require jet]</em> command as page inline JavaScript URL to automatically load Oracle JET RequireJS and configuration.
                </li>
                
                <li>
                   Load Status Meter Gauge module by adding a call to require as page JavaScript execute on page load:
                     <pre>require(["ojs/ojgauge"], function() {});</pre>
                </li>
                
                <li>
                    Add the following as page CSS File URLs to load Oracle JET CSS without tag selectors:
                    <pre>&#35;JET_CSS_DIRECTORY&#35;alta/oj-alta-notag-min.css</pre>
                </li>
                
                <li>
                    Use Oracle JET <strong>&lt;oj-status-meter-gauge&gt;</strong> element as Cards Media HTML Expression.
                </li>
                
                </ol>
                
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
            icon: fa-dial-gauge-chart
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
            sequence: 30
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

    region gauge-meter-chart-cards (
        name: Gauge Meter Chart Cards
        type: cards
        source {
            location: localDatabase
            type: sqlQuery
            sqlQuery:
                ```sql
                with v_speed as (
                    select id,
                       state,
                       license_plate,
                       location,
                       vehicle_speed,
                       posted_speed,
                       vehicle_speed - posted_speed over_speed,
                       posted_speed max_val
                    from eba_demo_card_vehicle_speed )
                select s.id, s.state, s.license_plate, s.location,
                       s.vehicle_speed,
                       s.posted_speed,
                       s.over_speed,
                       s.max_val
                from v_speed s
                where over_speed > 0
                ```
        }
        layout {
            sequence: 20
            slot: body
        }
        appearance {
            template: @/cards-container
            templateOptions: #DEFAULT#
        }
        advanced {
            htmlDomId: gauge-container
        }
        card {
            primaryKeyColumn1: ID
        }
        title {
            advancedFormatting: true
            htmlExpression: "<strong>&LICENSE_PLATE.</strong> "
        }
        subtitle {
            column: LOCATION
        }
        body {
            advancedFormatting: true
            htmlExpression: &VEHICLE_SPEED. mph in &POSTED_SPEED. zone
        }
        iconAndBadge {
            badgeColumn: STATE
            badgeLabel: "State: "
        }
        media {
            advancedFormatting: true
            htmlExpression:
                ```html
                <oj-status-meter-gauge
                    id = "vehichle_speed"
                    angle-extent = 250
                    start-angle = 215
                    min = "0"
                    max = "&MAX_VAL!ATTR."
                    labelled-by="readOnly"
                    thresholds='[{"max": 5, "color": "yellow"},{"max": 19, "color": "orange"},{"max": 40, "color": "red"}]'
                    value = "&OVER_SPEED!ATTR."
                    label.text ="mph over"
                    orientation = "circular"
                    class="speedometer" readonly>
                </oj-status-meter-gauge>
                ```
        }
    )

)


````
