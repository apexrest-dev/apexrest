# A PWA Page — Apex Pwa Reference

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Source: https://github.com/oracle/apex/blob/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/apex-pwa-reference/apexlang/apex-pwa-reference/pages/p01000-empty.apx

Copyright (c) Oracle and/or its affiliates. UPL-1.0; see ORACLE-LICENSE.txt.

APEX 26.2; MMD 26.2.0+3479. Original source SHA-256: 79a582b6f206ff650751fa2f6b1d22aba9cb7183f7dccaf4d8c669f33543f62e.

Application dependency inventory: oracle:26.2:public-template/apex-pwa-reference/dependencies.

<!-- BEGIN ORIGINAL APEXLANG -->
````apexlang
page 1000 (
    name: A PWA Page
    alias: EMPTY
    title: A PWA Page
    appearance {
        pageTemplate: @/standard
        templateOptions: #DEFAULT#
    }
    security {
        authentication: public
    }
)


````
