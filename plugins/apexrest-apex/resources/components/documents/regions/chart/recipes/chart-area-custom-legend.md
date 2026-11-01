# Area Chart with Custom Legend

Native JET stacked area chart whose legend is rebuilt by an initialization JavaScript dataFilter without static files; synthetic data.

Status: ready.

Component: component:regions/chart.

## Source attribution

Original adaptation of the pinned public source below. This source is separate from the captured Universal Theme reference application. The source hash identifies the reviewed upstream file; compiler evidence binds the authored recipe files.

```json
{
  "sourceUrl": "https://github.com/oracle/apex/blob/244dd3691fa5c2897a069fc912b149b9c2853679/sample-apps/sample-charts/apexlang/sample-charts/pages/p00002-area.apx",
  "repository": "https://github.com/oracle/apex",
  "commit": "244dd3691fa5c2897a069fc912b149b9c2853679",
  "path": "sample-apps/sample-charts/apexlang/sample-charts/pages/p00002-area.apx",
  "sourceSha256": "f1ce99b97d22cbb24f31d4fa9b1302cee6d46cd0aeee5e83e174df13bc891fe9",
  "license": "UPL-1.0",
  "derivation": "original-adaptation"
}
```

## Data contract

```json
{
  "source": "synthetic-dual",
  "tables": [],
  "bindings": [],
  "submittedItems": []
}
```

## Adaptation

- Choose a free page number and rename all P1_ items consistently.
- Rename region, series and axis identifiers before merging into an existing page.
- Preserve the target application authentication and authorization.
- Replace synthetic data only with authorized project SQL and keep every column alias used by the series column mapping.

Apply the files below as an overlay to component:scaffold for offline validation. In an existing project, adapt and merge the component into its existing page and shared objects. The example is not an import authorization.

## pages/p00001-home.apx

```apexlang
page 1 (
    name: Area Chart with Custom Legend
    alias: HOME
    title: Area Chart with Custom Legend
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        pageAccessProtection: argumentsMustHaveChecksum
    }

    region regional-sales (
        name: Regional Sales (Custom Legend)
        type: chart
        layout {
            sequence: 10
            slot: body
        }
        appearance {
            template: @/standard
            templateOptions: [
                #DEFAULT#
                t-Region--scrollBody
            ]
        }
        advanced {
            htmlDomId: customLegendChart
        }
        chart {
            type: area
        }
        chartAppearance {
            stack: true
        }
        chartLayout {
            height: 400
        }
        dataCursor {
            cursor: true
            behavior: smooth
            dimOnHover: false
        }
        legend {
            position: top
        }
        componentAdvanced {
            initJavaScriptFunction:
                ```javascript-browser
                function( options ) {
                    // Replace the default legend with a custom single-section legend.
                    options.dataFilter = function( data ) {
                        var shapes = [ "square", "circle", "diamond", "triangleUp" ];
                        data.legend = {
                            title: "Sales Region",
                            sections: [ { items: [] } ]
                        };
                        for ( var i = 0; i < data.series.length; i++ ) {
                            data.legend.sections[ 0 ].items.push( {
                                text: data.series[ i ].name,
                                color: data.series[ i ].color,
                                markerShape: shapes[ i % shapes.length ]
                            } );
                            data.series[ i ].displayInLegend = "off";
                        }
                        return data;
                    };
                    return options;
                }
                ```
        }

        series east (
            name: East
            execution {
                sequence: 10
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select to_char(add_months(trunc(sysdate, 'YYYY'), level - 1), 'Mon') as month_label,
                           level as month_no,
                           100 + level * 12 as sales
                      from dual
                   connect by level <= 6
                     order by month_no
                    ```
            }
            columnMapping {
                label: MONTH_LABEL
                value: SALES
            }
        )

        series west (
            name: West
            execution {
                sequence: 20
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select to_char(add_months(trunc(sysdate, 'YYYY'), level - 1), 'Mon') as month_label,
                           level as month_no,
                           80 + mod(level * 17, 40) as sales
                      from dual
                   connect by level <= 6
                     order by month_no
                    ```
            }
            columnMapping {
                label: MONTH_LABEL
                value: SALES
            }
        )

        series central (
            name: Central
            execution {
                sequence: 30
            }
            source {
                type: sqlQuery
                sqlQuery:
                    ```sql
                    select to_char(add_months(trunc(sysdate, 'YYYY'), level - 1), 'Mon') as month_label,
                           level as month_no,
                           60 + level * 5 as sales
                      from dual
                   connect by level <= 6
                     order by month_no
                    ```
            }
            columnMapping {
                label: MONTH_LABEL
                value: SALES
            }
        )

        axis x (
            name: x
            title: Month
            minorTicks {
                show: false
            }
        )

        axis y (
            name: y
            title: Sales (Units)
            minorTicks {
                show: false
            }
        )
    )
)

```

## Verification

```json
{
  "compiler": {
    "status": "passed",
    "evidence": "recipes/compiler-evidence.json",
    "sourceSha256": "ba6163e9d7c52421e963a9a3c62701684add6123f3f7c58035f90992d7142b19",
    "scaffoldSha256": "a7570417d18c1e496e702fa199d3055cec72d5caf7539db71ca300992c1ce7c8",
    "mmdVersion": "26.1.0+3102"
  },
  "sql": "not-run",
  "import": "not-run",
  "browser": "not-run"
}
```

Compile again after adapting. Compiler success is not SQL, imported application or browser evidence.
