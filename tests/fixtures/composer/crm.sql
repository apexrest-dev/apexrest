-- Isolated fixture only. Execute only under separately authorized DEV DDL/DML.
-- No COMMIT in API; caller owns the transaction. Not executed by Composer.
create table cmp_customers (
  customer_id number generated always as identity primary key,
  customer_name varchar2(200 char) not null,
  status varchar2(16 char) default 'ACTIVE' not null check (status in ('ACTIVE','INACTIVE')),
  owner_name varchar2(255 char) not null,
  row_version number default 1 not null
);
create or replace package cmp_customer_api as
  procedure save_customer(p_customer_id in out number, p_customer_name in varchar2,
    p_status in varchar2, p_expected_version in number, p_row_version out number);
end;
/
create or replace package body cmp_customer_api as
  procedure save_customer(p_customer_id in out number, p_customer_name in varchar2,
    p_status in varchar2, p_expected_version in number, p_row_version out number) is
    l_user varchar2(255) := v('APP_USER');
  begin
    if l_user is null or not apex_authentication.is_authenticated
      or not apex_authorization.is_authorized('CMP_CUSTOMER_WRITE') then
      raise_application_error(-20001,'Authorization denied');
    end if;
    if trim(p_customer_name) is null or length(p_customer_name)>200
      or p_status is null or p_status not in ('ACTIVE','INACTIVE') then
      raise_application_error(-20002,'Invalid fields');
    end if;
    if p_customer_id is null then
      if p_expected_version is not null then raise_application_error(-20002,'Invalid create draft'); end if;
      insert into cmp_customers(customer_name,status,owner_name)
        values(trim(p_customer_name),p_status,l_user)
        returning customer_id,row_version into p_customer_id,p_row_version;
    else
      if p_expected_version is null then raise_application_error(-20002,'Version required'); end if;
      update cmp_customers set customer_name=trim(p_customer_name),status=p_status,row_version=row_version+1
        where customer_id=p_customer_id and owner_name=l_user and row_version=p_expected_version
        returning row_version into p_row_version;
      if sql%rowcount<>1 then raise_application_error(-20003,'Record changed or unavailable'); end if;
    end if;
  end;
end;
/
