create or replace function public.allocate_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq bigint;
begin
  if p_prefix = 'YFQ' then
    seq := nextval('public.quote_number_seq');
  elsif p_prefix = 'YFI' then
    seq := nextval('public.inquiry_number_seq');
  else
    raise exception 'unknown number prefix';
  end if;
  return p_prefix || '-' || to_char(now() at time zone 'utc', 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

revoke all on function public.allocate_number(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.allocate_number(text) to service_role;
  end if;
end $$;
