# Home Finance Test

A four-page Oracle APEX 26.2 demonstration with fictional EUR amounts: monthly income, expenses and available balance; a category spending chart; searchable transactions; monthly budgets; and savings goals.

This version is read-only. Data comes from SQL DUAL queries, dates follow the current month, and changes are not persisted. It does not connect to banks or implement transaction entry. Income totals EUR 4,850, expenses EUR 2,290, and available balance EUR 2,560.

Source is under `src/apex/home-finance-test`. `finance-scaffold.json` is the editable page specification. The development environment targets local workspace DEV, schema DEV_APP, app 16250, alias `home-finance-test`. Authentication uses the retained Oracle APEX accounts scheme.

Compiler/import results and browser observations are separate; browser verification was not requested.

Oracle compiler validation and guarded import succeeded with SQLcl 26.3 on 2026-11-15, deployment `73af64ee-1315-4438-a847-3c8546e58781`. The app and its development schema were subsequently deleted at the user’s request on 2026-11-15. This source is retained for reuse; its configured target must be recreated before deployment. Browser behavior was not verified.
