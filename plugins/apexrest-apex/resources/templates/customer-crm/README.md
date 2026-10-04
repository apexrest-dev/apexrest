# Customer CRM

A real APEXlang overlay on the Oracle-generated starter: customers report (page 10), dashboard (20), modal form (80), server validation package/trigger, immutable table migration, utPLSQL tests and authenticated browser CRUD with unique synthetic records. It retains default authentication; configure a dedicated test account through authorized APEX administration. No password or ORDS endpoint is included.

`project init ./crm --template customer-crm` generates fresh Oracle metadata and applies the reviewed overlay. Local SQLcl compilation passed on 26.1.2 with MMD 26.1.0+3102. Live target deployment, test selectors and SQL results still need integration evidence. Required suites are SQL and E2E. Configure the environment and authorized test grants, provide utPLSQL for the SQL suite, then authenticate interactively.
