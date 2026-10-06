create or replace package test_apexrest_customers as
    --%suite(Customer business rules)

    --%test(Creates a customer with a generated identifier)
    procedure creates_customer;
    --%test(Rejects missing customer names)
    --%throws(-20010)
    procedure rejects_empty_name;
    --%test(Rejects malformed email addresses)
    --%throws(-20011)
    procedure rejects_invalid_email;
    --%test(Rejects unknown status)
    --%throws(-20012)
    procedure rejects_invalid_status;
    --%test(Prevents duplicate emails)
    --%throws(-1)
    procedure rejects_duplicate_email;
end;
/
create or replace package body test_apexrest_customers as
    procedure creates_customer is
        l_id number;
        l_name varchar2(200);
    begin
        l_id := apexrest_customer_api.add_customer('Synthetic customer', lower(rawtohex(sys_guid())) || '@example.test');
        select name into l_name from apexrest_customers where id=l_id;
        ut.expect(l_id).to_be_greater_than(0);
        ut.expect(l_name).to_equal('Synthetic customer');
    end;
    procedure rejects_empty_name is
    begin
        apexrest_customer_api.validate_customer(null,'name@example.test','ACTIVE');
    end;
    procedure rejects_invalid_email is
    begin
        apexrest_customer_api.validate_customer('Synthetic','invalid','ACTIVE');
    end;
    procedure rejects_invalid_status is
    begin
        apexrest_customer_api.validate_customer('Synthetic','name@example.test','UNKNOWN');
    end;
    procedure rejects_duplicate_email is
        l_id number;
        l_email varchar2(320) := lower(rawtohex(sys_guid())) || '@example.test';
    begin
        l_id := apexrest_customer_api.add_customer('First synthetic',l_email);
        l_id := apexrest_customer_api.add_customer('Second synthetic',l_email);
    end;
end;
/
