-- Школа русского: cuentas, suscripciones y progreso
create table if not exists public.customers (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_subscription_id text unique,
  status text not null,               -- active, trialing, past_due, canceled, ...
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.progress enable row level security;

-- customers: solo el servidor (service role) lo usa; sin políticas para clientes.
create policy "ver mi suscripción" on public.subscriptions for select using (auth.uid() = user_id);
create policy "ver mi progreso" on public.progress for select using (auth.uid() = user_id);
create policy "crear mi progreso" on public.progress for insert with check (auth.uid() = user_id);
create policy "actualizar mi progreso" on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bucket privado con el contenido Premium (premium.json y audio-premium.mp3)
insert into storage.buckets (id, name, public) values ('premium', 'premium', false)
on conflict (id) do nothing;
