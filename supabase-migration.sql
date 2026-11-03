-- R-MALOWA SENA 2.0
-- MIGRAÇÃO ADITIVA: não elimina nem altera profiles, groups, members ou pays.
-- Executar no Supabase SQL Editor depois de fazer uma cópia de segurança.

create table if not exists public.field_reports (
  id text primary key,
  d jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.field_reports enable row level security;

-- Política inicial para utilizadores autenticados.
-- Se já existir um sistema de aprovação de representantes, substitua estas políticas
-- por verificações da tabela de perfis/autorização usada no seu projeto.
drop policy if exists "field_reports_select_authenticated" on public.field_reports;
create policy "field_reports_select_authenticated"
on public.field_reports for select
to authenticated
using (true);

drop policy if exists "field_reports_insert_authenticated" on public.field_reports;
create policy "field_reports_insert_authenticated"
on public.field_reports for insert
to authenticated
with check (true);

drop policy if exists "field_reports_update_authenticated" on public.field_reports;
create policy "field_reports_update_authenticated"
on public.field_reports for update
to authenticated
using (true)
with check (true);

drop policy if exists "field_reports_delete_admin" on public.field_reports;
create policy "field_reports_delete_admin"
on public.field_reports for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Índices para acelerar filtros por data dentro do JSON.
create index if not exists field_reports_group_month_idx
on public.field_reports ((d->>'groupId'), (d->>'year'), (d->>'month'));

-- Atualiza updated_at automaticamente.
create or replace function public.set_field_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_field_reports_updated_at on public.field_reports;
create trigger trg_field_reports_updated_at
before update on public.field_reports
for each row execute function public.set_field_reports_updated_at();

-- Nota: esta migração não configura a Pasta Privada nem a senha geral.
-- A senha não deve ser colocada no código público do navegador.
