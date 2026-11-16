# Home Finance Test

An Oracle APEX 26.2 household finance app with a monthly overview, editable transactions, monthly budgets and sample savings goals. Workspace `DEV`, schema `DEV_APP`, application 16250, alias `home-finance-test`.

The local app, `DEV` workspace, developer account and `DEV_APP` schema were deleted at the user’s request on 2026-11-15. Source is retained for reuse; the configured target and credentials must be recreated before deployment. The instructions below describe the retained implementation.

On **Transactions**, choose **Add Row**, enter the date, description, category, currency and amount, then **Save**. To update an existing transaction, double-click a cell (or choose **Edit**), change its values, then **Save**. Positive amounts represent income and negative amounts represent expenses in the selected currency. Changes remain local until saved. Transaction deletion is not enabled.

Transactions persist in `HF_TRANSACTIONS`. The initial migration creates the table and seeds ten fictional transactions once. Primary keys are generated automatically; required fields, valid categories, nonblank descriptions and nonzero amounts are enforced by database constraints. Native APEX automatic row processing returns inserted keys and prevents lost updates. All authenticated users of this test app share the same household transaction data.

Transactions support EUR, USD, GBP, CHF, CAD, AUD and JPY. New rows default to EUR; the currency migration assigns EUR to existing transactions without changing their amounts. The database foreign key enforces supported currencies, and JPY amounts must be whole numbers. Changing a currency relabels the entered amount; it does not convert that amount. No exchange rates or base-currency conversion are configured.

The overview and budgets query saved transactions in the current calendar month. Navigate to those pages after saving to see updated totals. The overview shows separate income, expense and available totals for each currency used that month, plus EUR. Spending chart labels include the original currency; bar heights represent original amounts rather than equivalent converted values. Budget limits remain sample EUR values and are compared only with EUR spending. Other-currency spending is shown separately with “No budget set” and no remaining-budget value. Savings goals remain EUR samples and are not linked to transaction balances. No bank connections are configured.

Source is under `src/apex/home-finance-test`; the tracked migration is under `src/database/migrations`. Edit the APEXlang directly; the initial read-only scaffold input was removed to avoid overwriting the custom editor.

Oracle APEX compiler validation, migration and guarded import succeeded with SQLcl 26.3 on 2026-11-15, deployment `7ad06dc4-ba7a-4019-a075-7410cbef4efa`. Browser interactions were not requested or verified; no application test suite was run. Private deployment state is retained under `.apexrest/` and credentials are not stored in repository files.
