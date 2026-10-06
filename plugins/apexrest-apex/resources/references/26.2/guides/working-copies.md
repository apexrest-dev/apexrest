# Application locks and Working Copies in 26.2

APEX_APPLICATION_ADMIN.LOCK_APPLICATION records an existing workspace developer or administrator as owner. Re-locking by the same owner can update its comment; a different owner fails. UNLOCK_APPLICATION accepts p_unlock_as_user: always supply the expected owner when using automated cleanup. A null owner removes the owner filter.

CREATE_WORKING_COPY returns the new application ID and rejects duplicate names for the same main app. Supporting objects are not copied. A Working Copy has a distinct target identity; do not reuse the main application's deploy grant or drift baseline. Merge and refresh remain separately controlled workflows.

These APEX metadata locks complement local APEXREST coordination; they do not make its local lock cross-machine. Independent runners still need external serialization. A lock call can have an unknown result after connection loss; inspect actual ownership before retrying or cleaning up. Never release somebody else's lock.

Installing/deinstalling supporting objects uses separate APIs and can affect database objects or data. Keep those changes outside application-only plans unless expressly authorized.

Sources: [lock](https://docs.oracle.com/en/database/oracle/apex/26.2/aeapi/APEX_APPLICATION_ADMIN.LOCK_APPLICATION-Procedure.html), [unlock](https://docs.oracle.com/en/database/oracle/apex/26.2/aeapi/APEX_APPLICATION_ADMIN.UNLOCK_APPLICATION-Procedure.html), [Working Copy](https://docs.oracle.com/en/database/oracle/apex/26.2/aeapi/APEX_APPLICATION_ADMIN.CREATE_WORKING_COPY-Function.html). This is source-reviewed API guidance, not evidence that a live application was locked, copied or merged.
