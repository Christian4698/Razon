create table if not exists roles (
  id text primary key,
  name text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into roles (id, name, permissions)
values
  ('OWNER', 'Owner', '{"owner": true, "admin": true}'::jsonb),
  ('ADMIN', 'Administrator', '{"admin": true}'::jsonb),
  ('USER', 'User', '{"admin": false}'::jsonb)
on conflict (id) do update
set name = excluded.name,
    permissions = excluded.permissions;

create table if not exists users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  display_name text not null,
  role_id text not null references roles(id),
  status text not null check (status in ('ACTIVE', 'DISABLED')),
  must_change_password boolean not null default true,
  first_login_completed boolean not null default false,
  password_hash text,
  password_salt text,
  password_iterations integer,
  password_created_at timestamptz,
  password_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table users add column if not exists first_login_completed boolean not null default false;

create table if not exists licenses (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  plan text not null check (plan in ('STARTER', 'PRO', 'ELITE', 'LIFETIME')),
  duration text not null check (duration in ('1_MONTH', '2_MONTHS', '3_MONTHS', '6_MONTHS', '1_YEAR', 'LIFETIME')),
  status text not null check (status in ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED')),
  license_key_hash text not null unique,
  license_key_preview text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  subscription_id text not null unique
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  license_id text not null references licenses(id) on delete cascade,
  plan text not null check (plan in ('STARTER', 'PRO', 'ELITE', 'LIFETIME')),
  status text not null check (status in ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  expires_at timestamptz,
  renewed_at timestamptz,
  payment_provider text not null default 'NONE' check (payment_provider = 'NONE')
);

create table if not exists devices (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  license_id text not null references licenses(id) on delete cascade,
  label text not null,
  fingerprint_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked boolean not null default false
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  license_id text references licenses(id) on delete cascade,
  device_id text references devices(id) on delete set null,
  session_kind text not null check (session_kind in ('AUTH', 'LICENSE', 'PASSWORD_RESET')),
  refresh_token_hash text,
  remember_me boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists connector_secrets (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  connector_id text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  last4 text not null,
  status text not null check (status in ('SAVED', 'ROTATION_REQUIRED', 'INVALID')),
  updated_at timestamptz not null default now(),
  unique (user_id, connector_id)
);

create table if not exists audit_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  actor_user_id text,
  target_user_id text,
  license_id text,
  event text not null,
  severity text not null default 'INFO' check (severity in ('INFO', 'WARNING', 'CRITICAL')),
  status text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_users_email on users (lower(email));
create index if not exists idx_users_username on users (lower(username));
create index if not exists idx_users_role_id on users (role_id);
create index if not exists idx_licenses_user_id on licenses (user_id, created_at desc);
create index if not exists idx_subscriptions_user_id on subscriptions (user_id);
create index if not exists idx_subscriptions_license_id on subscriptions (license_id);
create index if not exists idx_devices_user_id on devices (user_id);
create index if not exists idx_devices_license_id on devices (license_id);
create index if not exists idx_sessions_user_id on sessions (user_id, session_kind);
create index if not exists idx_sessions_license_id on sessions (license_id);
create index if not exists idx_sessions_device_id on sessions (device_id);
create index if not exists idx_connector_secrets_user_id on connector_secrets (user_id);
create index if not exists idx_audit_logs_actor_user_id on audit_logs (actor_user_id, timestamp desc);
create index if not exists idx_audit_logs_target_user_id on audit_logs (target_user_id, timestamp desc);

alter table roles enable row level security;
alter table users enable row level security;
alter table licenses enable row level security;
alter table subscriptions enable row level security;
alter table devices enable row level security;
alter table sessions enable row level security;
alter table connector_secrets enable row level security;
alter table audit_logs enable row level security;

do $$
begin
  execute 'revoke all on table roles, users, licenses, subscriptions, devices, sessions, connector_secrets, audit_logs from anon, authenticated';
exception when undefined_object then
  null;
end $$;

do $$
begin
  execute 'grant select, insert, update, delete on table roles, users, licenses, subscriptions, devices, sessions, connector_secrets, audit_logs to service_role';
exception when undefined_object then
  null;
end $$;
