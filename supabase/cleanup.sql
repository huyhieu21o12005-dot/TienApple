-- ==============================================================================
-- Tien Mobile - Don dep du lieu tam hang ngay (giu dung luong Supabase nho)
-- Chay lai nhieu lan an toan. KHONG xoa don hang, lich hen, phieu bao hanh
-- (day la du lieu kinh doanh, moi dong chi vai tram byte).
--
-- Chi don 2 loai du lieu tam:
--   * warranty_lookups: nhat ky gioi han so lan tra cuu (chi can giu 1 gio)
--   * net._http_response: phan hoi cua pg_net sau khi gui Telegram
-- ==============================================================================

create extension if not exists pg_cron;

create or replace function public.purge_temp_data()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.warranty_lookups where created_at < now() - interval '2 days';
  begin
    delete from net._http_response where created < now() - interval '1 day';
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.purge_temp_data() from public, anon, authenticated;

-- Chay moi ngay luc 03:00 (gio UTC)
select cron.unschedule(jobid) from cron.job where jobname = 'tienmobile-purge-temp';
select cron.schedule('tienmobile-purge-temp', '0 3 * * *', $cron$select public.purge_temp_data();$cron$);
