-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-requests.sql, only to an explicitly authorized project schema.
-- Each transition is a named verb that locks the row and checks its legal source status.
-- The package never commits; APEX commits the page submit.
create or replace package APEXREST_EXAMPLE_REQUEST_FLOW_API authid definer as
    procedure approve(
        p_id         in number,
        p_decided_by in varchar2);

    procedure reject(
        p_id         in number,
        p_reason     in varchar2,
        p_decided_by in varchar2);
end APEXREST_EXAMPLE_REQUEST_FLOW_API;
/
create or replace package body APEXREST_EXAMPLE_REQUEST_FLOW_API as
    function locked_status(p_id in number) return varchar2
    is
        l_status APEXREST_EXAMPLE_REQUESTS.STATUS%type;
    begin
        select STATUS
          into l_status
          from APEXREST_EXAMPLE_REQUESTS
         where ID = p_id
           for update;
        return l_status;
    exception
        when no_data_found then
            raise_application_error(-20004, 'The request no longer exists.');
    end locked_status;

    procedure approve(
        p_id         in number,
        p_decided_by in varchar2)
    is
    begin
        if locked_status(p_id) <> 'REQUESTED' then
            raise_application_error(-20005, 'Only a request in REQUESTED status can be approved.');
        end if;
        update APEXREST_EXAMPLE_REQUESTS
           set STATUS = 'APPROVED',
               REJECTION_REASON = null,
               DECIDED_BY = p_decided_by,
               DECIDED_AT = systimestamp
         where ID = p_id;
    end approve;

    procedure reject(
        p_id         in number,
        p_reason     in varchar2,
        p_decided_by in varchar2)
    is
    begin
        if locked_status(p_id) <> 'REQUESTED' then
            raise_application_error(-20005, 'Only a request in REQUESTED status can be rejected.');
        end if;
        if trim(p_reason) is null then
            raise_application_error(-20006, 'A rejection reason is required.');
        end if;
        update APEXREST_EXAMPLE_REQUESTS
           set STATUS = 'REJECTED',
               REJECTION_REASON = trim(p_reason),
               DECIDED_BY = p_decided_by,
               DECIDED_AT = systimestamp
         where ID = p_id;
    end reject;
end APEXREST_EXAMPLE_REQUEST_FLOW_API;
/
