# Qask: application dependency inventory

Source reference only. A page is not a standalone recipe: preserve its application dependency closure, table/API contracts, shared components, plug-ins, static assets and destination pages. No local compiler, SQL execution, import or browser verification is implied. Preserve target authentication and authorization when adapting.

Pinned source: https://github.com/oracle/apex/tree/fbe095e4c6e783b3fa930ffae927e4826e549190/starter-apps/qask/apexlang/qask/

The list below is an inventory of the source application, not a statement that every file is required by each page. Inspect the page's SQL, item bindings, shared references, handlers and links, then retrieve the needed dependencies from the pinned source. Database setup is a separate authorized task. Do not copy the source application's deployments, authentication or authorization over an existing application.

18 included page templates of 42 source pages; 74 source APEXlang files.

## Source files

- .apex/apexlang.json
- application.apx
- deployments/default.json
- page-groups.apx
- pages/p00000-global-page.apx
- pages/p00001-home.apx
- pages/p00010-about.apx
- pages/p00011-participant-information.apx
- pages/p00012-session-ended.apx
- pages/p00020-question.apx
- pages/p00021-your-answer.apx
- pages/p00050-host-your-own.apx
- pages/p00100-qanda-sessions.apx
- pages/p00111-session-details.apx
- pages/p00112-ask-question.apx
- pages/p00113-question-responses.apx
- pages/p00114-start-session.apx
- pages/p00115-copy-session.apx
- pages/p00116-delete-session.apx
- pages/p00120-session-summary.apx
- pages/p00121-question-summary.apx
- pages/p09995-accept-service-terms.apx
- pages/p09998-verification.apx
- pages/p09999-login.apx
- pages/p10000-admin.apx
- pages/p10005-all-sessions.apx
- pages/p10010-emails-from.apx
- pages/p10011-settings.apx
- pages/p10012-service-terms.apx
- pages/p10013-service-term-details.apx
- pages/p10014-accepted-service-terms1.apx
- pages/p10020-activity-dashboard.apx
- pages/p10022-application-error-log.apx
- pages/p10023-page-performance.apx
- pages/p10024-page-views.apx
- pages/p10026-logged-messages.apx
- pages/p10031-manage-user-access.apx
- pages/p10032-user-details.apx
- pages/p10033-add-multiple-users-step-1.apx
- pages/p10034-add-multiple-users-step-2.apx
- pages/p10035-account-requests.apx
- pages/p10036-account-request-details.apx
- pages/p10037-restricted-to-email-domains.apx
- pages/p10038-restricted-to-email-domain-details.apx
- pages/p10050-email-reporting.apx
- pages/p10051-job-reporting.apx
- shared-components/acl-roles.apx
- shared-components/app-computations.apx
- shared-components/app-items.apx
- shared-components/app-processes.apx
- shared-components/authentications.apx
- shared-components/authorizations.apx
- shared-components/breadcrumbs/breadcrumb.apx
- shared-components/build-options.apx
- shared-components/component-settings.apx
- shared-components/email-templates/ACCESS-DECLINED.apx
- shared-components/email-templates/EXISTING-ACCOUNT.apx
- shared-components/email-templates/USER-CREATED.apx
- shared-components/email-templates/VERIFICATION.apx
- shared-components/lists/activity-reports.apx
- shared-components/lists/navigation-bar.apx
- shared-components/lists/p120-actions.apx
- shared-components/lists/user-interface.apx
- shared-components/lists/user-related-actions.apx
- shared-components/lovs/access-request-statuses.apx
- shared-components/lovs/access-roles.apx
- shared-components/lovs/answer-type.apx
- shared-components/lovs/timeframe-4-weeks.apx
- shared-components/lovs/yes-no.apx
- shared-components/messages.apx
- shared-components/static-files.apx
- shared-components/static-files/app-icon.css
- shared-components/static-files/app-icon.min.css
- shared-components/static-files/icons/app-icon-144-rounded.png
- shared-components/static-files/icons/app-icon-192.png
- shared-components/static-files/icons/app-icon-256-rounded.png
- shared-components/static-files/icons/app-icon-32.png
- shared-components/static-files/icons/app-icon-512.png
- shared-components/static-files/jquery.qrcode.min.js
- shared-components/static-files/oracle-logo.svg
- shared-components/themes/universal-theme/template-option-groups.apx
- shared-components/themes/universal-theme/theme.apx
- supporting-objects/deinstall-script.sql
- supporting-objects/install-scripts.apx
- supporting-objects/install-scripts/add-installing-user.sql
- supporting-objects/install-scripts/close-old-job.sql
- supporting-objects/install-scripts/create-data.sql
- supporting-objects/install-scripts/create-tables.sql
- supporting-objects/install-scripts/create-triggers.sql
- supporting-objects/install-scripts/qask-util-body.sql
- supporting-objects/install-scripts/qask-util-spec.sql
- supporting-objects/substitutions.apx
- supporting-objects/supporting-objects.apx
