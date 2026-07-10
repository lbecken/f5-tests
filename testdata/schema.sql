-- Demo schema for syndata: exercises the features the tool must handle.
--   * Hibernate-style global sequence (ids without column defaults)
--   * serial column (audit_log)
--   * identity column (api_keys)
--   * Postgres enum type (orders.status)
--   * CHECK ... IN constraints (customers.status, payments.method)
--   * join table with composite PK (product_tag)
--   * self-referencing FKs (categories.parent_id, employees.manager_id)
--   * FK cycle broken via nullable column (employees <-> departments)
--   * one-to-one via unique FK (payments.order_id)

create sequence if not exists hibernate_sequence start with 1 increment by 1;

create type order_status as enum ('NEW', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');

create table customers (
    id              bigint primary key,
    first_name      varchar(60)  not null,
    last_name       varchar(60)  not null,
    email           varchar(150) not null unique,
    phone           varchar(40),
    date_of_birth   date,
    status          varchar(20)  not null check (status in ('ACTIVE', 'INACTIVE', 'BLOCKED')),
    loyalty_points  integer      not null default 0,
    created_at      timestamptz  not null default now()
);

create table addresses (
    id           bigint primary key,
    customer_id  bigint      not null references customers (id),
    street       varchar(120) not null,
    city         varchar(80)  not null,
    state        varchar(80),
    postal_code  varchar(16)  not null,
    country_code char(2)      not null,
    is_primary   boolean      not null default false
);

create table categories (
    id        bigint primary key,
    name      varchar(80) not null unique,
    parent_id bigint references categories (id)
);

create table products (
    id             bigint primary key,
    sku            varchar(20)   not null unique,
    name           varchar(120)  not null,
    description    text,
    price          numeric(10, 2) not null check (price >= 0),
    stock_quantity integer        not null default 0,
    weight_kg      numeric(6, 3),
    active         boolean        not null default true,
    category_id    bigint references categories (id),
    created_at     timestamptz    not null default now()
);

create table tags (
    id   bigint primary key,
    name varchar(40) not null unique
);

create table product_tag (
    product_id bigint not null references products (id),
    tag_id     bigint not null references tags (id),
    primary key (product_id, tag_id)
);

create table departments (
    id               bigint primary key,
    name             varchar(80) not null unique,
    head_employee_id bigint -- FK to employees added below: cycle with employees.department_id
);

create table employees (
    id            bigint primary key,
    department_id bigint       not null references departments (id),
    manager_id    bigint references employees (id),
    first_name    varchar(60)  not null,
    last_name     varchar(60)  not null,
    email         varchar(150) not null unique,
    hired_on      date         not null,
    salary        numeric(10, 2)
);

alter table departments
    add constraint fk_departments_head foreign key (head_employee_id) references employees (id);

create table orders (
    id                  bigint primary key,
    customer_id         bigint       not null references customers (id),
    shipping_address_id bigint references addresses (id),
    status              order_status not null,
    total_amount        numeric(12, 2) not null,
    placed_at           timestamptz  not null,
    notes               text
);

create table order_items (
    id         bigint primary key,
    order_id   bigint         not null references orders (id),
    product_id bigint         not null references products (id),
    quantity   integer        not null check (quantity > 0),
    unit_price numeric(10, 2) not null,
    unique (order_id, product_id)
);

create table payments (
    id        bigint primary key,
    order_id  bigint      not null unique references orders (id),
    method    varchar(20) not null check (method in ('CARD', 'PAYPAL', 'BANK_TRANSFER', 'INVOICE')),
    amount    numeric(12, 2) not null,
    paid_at   timestamptz not null,
    reference uuid        not null
);

create table audit_log (
    id          bigserial primary key,
    entity_name varchar(80) not null,
    entity_id   bigint,
    action      varchar(20) not null,
    details     jsonb,
    occurred_at timestamptz not null default now()
);

create table api_keys (
    id         bigint generated always as identity primary key,
    label      varchar(80) not null,
    secret     varchar(64) not null,
    expires_at timestamptz
);
