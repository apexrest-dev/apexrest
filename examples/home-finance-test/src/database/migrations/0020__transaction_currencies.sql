create table hf_currencies (
    currency_code varchar2(3 char) constraint hf_currencies_pk primary key,
    currency_name varchar2(60 char) not null,
    minor_units number(1) not null,
    constraint hf_currencies_units_ck check (minor_units in (0, 2))
);

insert into hf_currencies (currency_code, currency_name, minor_units)
select 'EUR', 'Euro', 2 from dual union all
select 'USD', 'US dollar', 2 from dual union all
select 'GBP', 'Pound sterling', 2 from dual union all
select 'CHF', 'Swiss franc', 2 from dual union all
select 'CAD', 'Canadian dollar', 2 from dual union all
select 'AUD', 'Australian dollar', 2 from dual union all
select 'JPY', 'Japanese yen', 0 from dual;

alter table hf_transactions add (
    currency_code varchar2(3 char) default 'EUR' not null
);

alter table hf_transactions add constraint hf_transactions_currency_fk
    foreign key (currency_code) references hf_currencies (currency_code);

alter table hf_transactions add constraint hf_transactions_precision_ck
    check (currency_code <> 'JPY' or amount = trunc(amount));

commit;
