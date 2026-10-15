-- Optional isolated development fixture. Never run automatically during compilation/import.
-- Apply after example-rows.sql, only to an explicitly authorized project schema.
-- The package is the only write path for APEXREST_EXAMPLE_ROWS used by the drawer page.
-- It never commits; APEX commits the page submit. ROW_VERSION is incremented by the
-- example-rows.sql trigger, so the update only matches the version the page loaded.
create or replace package APEXREST_EXAMPLE_ROWS_API authid definer as
    procedure create_row(
        p_name   in  varchar2,
        p_status in  varchar2,
        p_id     out number);

    procedure update_row(
        p_id          in number,
        p_name        in varchar2,
        p_status      in varchar2,
        p_row_version in number);
end APEXREST_EXAMPLE_ROWS_API;
/
create or replace package body APEXREST_EXAMPLE_ROWS_API as
    procedure check_data(
        p_name   in varchar2,
        p_status in varchar2,
        p_id     in number default null)
    is
        l_count pls_integer;
    begin
        if trim(p_name) is null then
            raise_application_error(-20001, 'Name is required.');
        end if;
        if p_status is null or p_status not in ('Open', 'Closed') then
            raise_application_error(-20001, 'Status must be Open or Closed.');
        end if;
        select count(*)
          into l_count
          from APEXREST_EXAMPLE_ROWS
         where upper(NAME) = upper(trim(p_name))
           and (p_id is null or ID <> p_id);
        if l_count > 0 then
            raise_application_error(-20001, 'A row named ' || trim(p_name) || ' already exists.');
        end if;
    end check_data;

    procedure create_row(
        p_name   in  varchar2,
        p_status in  varchar2,
        p_id     out number)
    is
    begin
        check_data(p_name, p_status);
        insert into APEXREST_EXAMPLE_ROWS (NAME, STATUS)
        values (trim(p_name), p_status)
        returning ID into p_id;
    end create_row;

    procedure update_row(
        p_id          in number,
        p_name        in varchar2,
        p_status      in varchar2,
        p_row_version in number)
    is
    begin
        if p_id is null then
            raise_application_error(-20001, 'The row to update was not identified.');
        end if;
        check_data(p_name, p_status, p_id);
        update APEXREST_EXAMPLE_ROWS
           set NAME = trim(p_name),
               STATUS = p_status
         where ID = p_id
           and ROW_VERSION = p_row_version;
        if sql%rowcount = 0 then
            raise_application_error(-20002, 'This row was changed by someone else since you opened it. Reload and try again.');
        end if;
    end update_row;
end APEXREST_EXAMPLE_ROWS_API;
/
