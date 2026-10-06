# Workflow and Human Tasks in APEX 26.2

Workflow activities support draftGeneric, draftSwitch and draftWait placeholders. Keep incomplete models in development. A successful metadata compilation does not mean draft logic is executable or a model is ready to activate. Export PNG/SVG diagrams for review when useful.

Action Tasks can define custom outcomes, and APEX_HUMAN_TASK.SET_TASK_OUTCOME sets them programmatically. Test valid and invalid outcomes, transition authorization and the workflow branches they select. Human Tasks entering Errored raise a Fail event; configure and verify appropriate recovery actions. Sending notifications is a distinct effect.

APEX_WORKFLOW.MIGRATE_INSTANCE can move running instances to a newer model version, providing variables, new parameters and the resume activity. It changes runtime business state: it is not part of application-only import. Require explicit instance-level authorization, a reviewed migration mapping and native pre/post state evidence. Do not auto-migrate running instances after metadata deployment.

Follow these inventory references for exact property spelling; generated inventory documents may contain alternatives for several variants. Apply only the properties supported by the chosen type and use the 26.2 compiler. Use the version declaration identifier for its version, and component identifiers for static IDs; the inventory also contains metadata fields that are not explicit source properties. The draft-workflow recipe verifies syntax only. Native task execution, migration and error handling remain separate checks.

Sources: [workflow additions](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/new-features.html), [instance migration API](https://docs.oracle.com/en/database/oracle/apex/26.2/aeapi/APEX_WORKFLOW.MIGRATE_INSTANCE-Procedure.html).
