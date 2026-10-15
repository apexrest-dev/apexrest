-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-error-shield.sql, only to an explicitly authorized project schema.
-- handle_error is an APEX error handling function: it must never raise, it shows
-- raise_application_error texts without the ORA prefix, maps known constraints and
-- replaces every unexpected technical error with a generic message and a reference code.
create or replace package APEXREST_EXAMPLE_ERROR_API authid definer as
    function handle_error(p_error in apex_error.t_error) return apex_error.t_error_result;
end APEXREST_EXAMPLE_ERROR_API;
/
create or replace package body APEXREST_EXAMPLE_ERROR_API as
    c_generic constant varchar2(200) :=
        'An unexpected error occurred. Contact support and quote reference ';

    -- Records the incident in its own transaction so the user's rolled-back work
    -- does not remove it. Returns the stable reference code of the root cause.
    function record_incident(p_error in apex_error.t_error) return varchar2
    is
        pragma autonomous_transaction;
        l_fingerprint APEXREST_EXAMPLE_INCIDENTS.FINGERPRINT%type;
        l_reference   APEXREST_EXAMPLE_INCIDENTS.REFERENCE_CODE%type;
    begin
        select rawtohex(standard_hash(
                   v('APP_ID') || '|' || v('APP_PAGE_ID') || '|' || p_error.ora_sqlcode || '|'
                   || substr(p_error.message, 1, 200), 'SHA256'))
          into l_fingerprint
          from dual;
        l_reference := 'ERR-' || substr(l_fingerprint, 1, 8);

        merge into APEXREST_EXAMPLE_INCIDENTS t
        using (select l_fingerprint FINGERPRINT from dual) s
           on (t.FINGERPRINT = s.FINGERPRINT)
         when matched then update
              set t.OCCURRENCE_COUNT = t.OCCURRENCE_COUNT + 1,
                  t.LAST_SEEN_AT = systimestamp,
                  t.APP_USER = v('APP_USER')
         when not matched then insert (
              REFERENCE_CODE, FINGERPRINT, APPLICATION_ID, PAGE_ID, APP_USER, REQUEST,
              COMPONENT_TYPE, COMPONENT_NAME, ORA_SQLCODE, ERROR_MESSAGE)
              values (
              l_reference, l_fingerprint, v('APP_ID'), v('APP_PAGE_ID'), v('APP_USER'), v('REQUEST'),
              p_error.component.type, p_error.component.name, p_error.ora_sqlcode,
              substr(p_error.message
                     || case when p_error.additional_info is not null
                                  and p_error.additional_info <> p_error.message
                             then ' ' || p_error.additional_info end, 1, 4000));
        commit;
        return l_reference;
    exception
        when others then
            rollback;
            return null;
    end record_incident;

    procedure mask(p_error in apex_error.t_error, p_result in out nocopy apex_error.t_error_result)
    is
        l_reference varchar2(12);
    begin
        l_reference := record_incident(p_error);
        p_result.message := c_generic || nvl(l_reference, 'unavailable') || '.';
        p_result.additional_info := null;
    end mask;

    function handle_error(p_error in apex_error.t_error) return apex_error.t_error_result
    is
        l_result     apex_error.t_error_result;
        l_constraint varchar2(255);
    begin
        l_result := apex_error.init_error_result(p_error => p_error);

        if p_error.is_internal_error then
            -- Keep access-denied and session errors; mask everything else.
            if not p_error.is_common_runtime_error then
                mask(p_error, l_result);
            end if;
            return l_result;
        end if;

        if p_error.ora_sqlcode in (-1, -2091, -2290, -2291, -2292) then
            l_constraint := apex_error.extract_constraint_name(p_error => p_error);
            begin
                select MESSAGE
                  into l_result.message
                  from APEXREST_EXAMPLE_CONSTRAINT_MESSAGES
                 where CONSTRAINT_NAME = l_constraint;
            exception
                when no_data_found then
                    null;
            end;
        end if;

        if p_error.ora_sqlcode is not null and l_result.message = p_error.message then
            if p_error.ora_sqlcode between -20999 and -20000 then
                l_result.message := apex_error.get_first_ora_error_text(p_error => p_error);
            else
                mask(p_error, l_result);
            end if;
        end if;

        if l_result.page_item_name is null and l_result.column_alias is null then
            apex_error.auto_set_associated_item(p_error => p_error, p_error_result => l_result);
        end if;
        return l_result;
    exception
        when others then
            l_result.message := c_generic || 'unavailable.';
            l_result.additional_info := null;
            return l_result;
    end handle_error;
end APEXREST_EXAMPLE_ERROR_API;
/
