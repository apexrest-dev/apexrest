/**
 * Fixed read-only prerequisite inventory. Visibility is an observation, never evidence that
 * an API can execute successfully or that the database/provider security feature is configured.
 * Public synonyms resolve versioned APEX package owners without accepting an arbitrary owner.
 */
export const apexCapabilitiesQuery = `with
  configured_application as (
    select locked_by,is_working_copy,working_copy_name from apex_applications
    where owner=:p_owner and workspace=:p_workspace and application_id=:p_app_id
  ),
  visible_api as (
    select distinct s.synonym_name package_name, p.procedure_name
    from all_synonyms s
    join all_procedures p on p.owner=s.table_owner and p.object_name=s.table_name
    where s.owner='PUBLIC' and s.db_link is null and p.object_type='PACKAGE'
      and s.synonym_name in ('DBMS_CLOUD','APEX_APPLICATION_ADMIN','APEX_WORKFLOW','APEX_HUMAN_TASK')
  ),
  requested_api as (
    select 'dbms-cloud' capability, 'DBMS_CLOUD' package_name,
      cast(null as varchar2(128)) procedure_name from dual
    union all select 'application-lock', 'APEX_APPLICATION_ADMIN', 'LOCK_APPLICATION' from dual
    union all select 'application-unlock', 'APEX_APPLICATION_ADMIN', 'UNLOCK_APPLICATION' from dual
    union all select 'working-copy-create', 'APEX_APPLICATION_ADMIN', 'CREATE_WORKING_COPY' from dual
    union all select 'deep-data-security-api', 'APEX_APPLICATION_ADMIN', 'SET_DEEP_SEC' from dual
    union all select 'workflow-instance-migration', 'APEX_WORKFLOW', 'MIGRATE_INSTANCE' from dual
    union all select 'human-task-outcome', 'APEX_HUMAN_TASK', 'SET_TASK_OUTCOME' from dual
  ),
  observations as (
    select 'apex-version' capability,
      case when count(*)=1 then 'observed' else 'unknown' end status,
      case when count(*)=1 then min(version_no) end observed_value,
      'APEX_RELEASE; release alone does not establish feature readiness' evidence_scope
    from apex_release
    union all
    select 'database-version',
      case when count(*)=1 then 'observed' else 'unknown' end,
      case when count(*)=1 then min(version_full) end,
      'PRODUCT_COMPONENT_VERSION; release alone does not establish feature readiness'
    from product_component_version where product like 'Oracle%Database%'
    union all
    select r.capability,
      case when exists (select 1 from visible_api a where a.package_name=r.package_name
        and (r.procedure_name is null or a.procedure_name=r.procedure_name))
        then 'observed' else 'not-observed' end,
      r.package_name || case when r.procedure_name is not null then '.' || r.procedure_name end,
      'ALL_PROCEDURES via PUBLIC synonym; metadata visibility only, execution not tested'
    from requested_api r
    union all select 'deep-data-security-runtime', 'operator-verification-required', null,
      'Verify database feature enablement, end-user identity propagation, Data Roles and Data Grants' from dual
    union all select 'oci-iam', 'operator-verification-required', null,
      'Verify the intended managed identity and least-privilege OCI IAM policies externally' from dual
    union all select 'oci-credential-binding', 'operator-verification-required', null,
      'Verify the exact DBMS_CLOUD credential and parsing-schema binding; no credential contents read' from dual
    union all select 'outbound-network', 'operator-verification-required', null,
      'Verify parsing-schema ACLs, HTTPS trust, endpoints and WEBSERVICE_USE_SCHEMA_ACL; no outbound call made' from dual
    union all select 'application-lock-state',
      case when count(*)=1 then 'observed' else 'unknown' end,
      case when count(*)=1 then nvl(min(locked_by), 'NULL (no recorded lock owner)') end,
      'Configured APEX_APPLICATIONS.LOCKED_BY only; no lock acquired or released'
      from configured_application
    union all select 'working-copy-state',
      case when count(*)=1 then 'observed' else 'unknown' end,
      case when count(*)=1 then min(is_working_copy) end,
      'Configured APEX_APPLICATIONS.IS_WORKING_COPY only; no copy created, refreshed or merged'
      from configured_application
    union all select 'working-copy-name',
      case when count(*)=1 then 'observed' else 'unknown' end,
      case when count(*)=1 then nvl(min(working_copy_name), 'NULL (no Working Copy name)') end,
      'Configured APEX_APPLICATIONS.WORKING_COPY_NAME only; parent application is not inferred'
      from configured_application
  )
select capability,status,observed_value,evidence_scope from observations
where sys_context('USERENV','CURRENT_SCHEMA')=:p_owner
order by capability`;
