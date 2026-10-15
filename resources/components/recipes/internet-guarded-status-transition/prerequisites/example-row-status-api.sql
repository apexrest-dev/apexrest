-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-rows.sql, only to an explicitly authorized project schema.
-- The package owns the Open -> Closed transition. It never commits; APEX commits the
-- page submit. The update matches both the allowed source status and the version the
-- page loaded, so a concurrent change or an already closed row updates nothing.
create or replace package APEXREST_EXAMPLE_ROW_STATUS_API authid definer as
    procedure close_row(
        p_id          in number,
        p_row_version in number);
end APEXREST_EXAMPLE_ROW_STATUS_API;
/
create or replace package body APEXREST_EXAMPLE_ROW_STATUS_API as
    procedure close_row(
        p_id          in number,
        p_row_version in number)
    is
    begin
        update APEXREST_EXAMPLE_ROWS
           set STATUS = 'Closed'
         where ID = p_id
           and STATUS = 'Open'
           and ROW_VERSION = p_row_version;
        if sql%rowcount = 0 then
            raise_application_error(-20003, 'This row can no longer be closed. It was already closed or changed by someone else. Reload and try again.');
        end if;
    end close_row;
end APEXREST_EXAMPLE_ROW_STATUS_API;
/
