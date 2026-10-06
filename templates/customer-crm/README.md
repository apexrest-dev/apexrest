# Customer CRM

A real APEXlang overlay on the Oracle-generated starter: customers report (page 10), dashboard (20), modal form (80), server validation package/trigger, immutable table migration, utPLSQL tests and authenticated browser CRUD with unique synthetic records. It retains default authentication; configure a dedicated test account through authorized APEX administration. No password or ORDS endpoint is included.

`project init ./crm --template customer-crm` generates fresh Oracle metadata and applies the overlay. Required suites are SQL and E2E. Configure the environment and authorized test grants, provide utPLSQL, then authenticate interactively. The 26.2 starter enables session rejoin for saved-state E2E; the APEX instance must also allow it (`REJOIN_EXISTING_SESSIONS=Y`).
