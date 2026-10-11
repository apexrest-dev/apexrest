# Sample Email Authentication: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/sample-apps/sample-email-authentication/apexlang/ema/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

4 included page templates of 16 source pages; 43 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00010-about-pre.apx
- pages/p00100-protected.apx
- pages/p09998-verification.apx
- pages/p09999-login.apx
- pages/p10000-admin.apx
- pages/p10010-emails-from.apx
- pages/p10011-settings.apx
- pages/p10022-application-error-log.apx
- pages/p10026-logged-messages.apx
- pages/p10031-manage-user-access.apx
- pages/p10032-user-details.apx
- pages/p10033-add-multiple-users-step-1.apx
- pages/p10034-add-multiple-users-step-2.apx
- pages/p10050-email-reporting.apx
- shared-components/acl-roles.apx
- shared-components/app-computations.apx
- shared-components/app-items.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/email-templates/USER-CREATED.apx
- shared-components/email-templates/VERIFICATION.apx
- shared-components/lists/activity-reports.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/navigation-menu.apx
- shared-components/lists/user-interface.apx
- shared-components/lists/user-related-actions.apx
- shared-components/lovs/access-roles.apx
- shared-components/lovs/yes-no.apx
- shared-components/messages.apx
- shared-components/static-files.apx
- shared-components/static-files/app-icon.css
- shared-components/static-files/app-icon.min.css
- shared-components/static-files/app-sample-email-auth.png
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/oracle-logo.svg
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/create-first-user.sql
- supporting-objects/install-scripts/create-tables.sql
- supporting-objects/install-scripts/default-settings.sql
- supporting-objects/install-scripts/package-body.sql
- supporting-objects/install-scripts/package-spec.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
