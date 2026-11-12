-- OmniProfile MVP schema: users, candidate profiles, applications,
-- plus the token tables that back the browser-extension OAuth flow.

-- ---------------------------------------------------------------------------
-- Users (public mirror of auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Candidate profiles (one master profile per user)
-- ---------------------------------------------------------------------------
create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  headline text not null default '',
  summary text not null default '',
  contact_info jsonb not null default '{}'::jsonb,       -- { email, phone, address, linkedin, portfolio, ... }
  work_history jsonb not null default '[]'::jsonb,       -- [{ company, title, start, end, bullets }]
  education jsonb not null default '[]'::jsonb,          -- [{ institution, degree, year }]
  skills text[] not null default '{}',
  screening_answers jsonb not null default '{}'::jsonb,  -- standard ATS questions + custom Q&A
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Applications (jobs the extension has filled / the user is tracking)
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_name text not null default '',
  job_title text not null default '',
  job_url text not null,
  status text not null default 'Auto-Filled'
    check (status in ('Auto-Filled', 'Applied', 'Interview', 'Offer', 'Rejected')),
  applied_at timestamptz not null default now(),
  unique (user_id, job_url)
);

create index applications_user_applied_idx on public.applications (user_id, applied_at desc);

-- ---------------------------------------------------------------------------
-- Extension OAuth (authorization code + PKCE -> opaque access token).
-- Only hashes are stored. These tables are reachable solely through the
-- server's secret key: RLS is enabled with no policies.
-- ---------------------------------------------------------------------------
create table public.extension_auth_codes (
  code_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  code_challenge text not null,
  redirect_uri text not null,
  expires_at timestamptz not null
);

create table public.extension_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index extension_tokens_user_idx on public.extension_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.applications enable row level security;
alter table public.extension_auth_codes enable row level security;
alter table public.extension_tokens enable row level security;

create policy "Users read own row" on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users manage own profile" on public.candidate_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own applications" on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
