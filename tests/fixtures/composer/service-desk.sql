-- Isolated read-view fixture. Separate DEV DDL/DML authorization required.
create table cmp_tickets (
  ticket_id number generated always as identity primary key,
  title varchar2(200 char) not null,
  status varchar2(16 char) not null,
  parent_id number references cmp_tickets(ticket_id),
  changed_at timestamp default systimestamp not null,
  owner_name varchar2(255 char) not null
);
