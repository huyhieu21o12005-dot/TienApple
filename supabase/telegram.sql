-- ==============================================================================
-- Tien Mobile - Thông báo Telegram khi có đơn hàng / lịch sửa chữa / yêu cầu thu cũ
-- Chạy SAU orders.sql. Chạy lại nhiều lần an toàn.
--
-- Cách hoạt động: trigger sau khi thêm dòng vào orders hoặc repair_bookings gọi
-- Telegram Bot API qua pg_net (gửi bất đồng bộ, lỗi Telegram không làm hỏng đơn).
-- Token bot và chat id lưu trong bảng notify_settings: bảng này bật RLS và không có
-- policy nên trình duyệt (khóa công khai) KHÔNG đọc được. KHÔNG ghi token vào file này.
--
-- Cấu hình (chạy riêng một lần trong SQL Editor, thay giá trị thật):
--   insert into public.notify_settings (key, value) values
--     ('telegram_bot_token', '<TOKEN TỪ @BotFather>'),
--     ('telegram_chat_id',   '<CHAT ID NHÓM HOẶC CÁ NHÂN>')
--   on conflict (key) do update set value = excluded.value;
-- Thử gửi:  select public.notify_telegram('Thử thông báo Tien Mobile');
-- ==============================================================================

create extension if not exists pg_net;

create table if not exists public.notify_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.notify_settings enable row level security;
revoke all on public.notify_settings from public, anon, authenticated;

-- Escape ký tự đặc biệt cho parse_mode HTML của Telegram
create or replace function public.tg_escape(t text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

-- Gửi một tin nhắn. Không làm gì nếu chưa cấu hình; không bao giờ ném lỗi.
create or replace function public.notify_telegram(p_text text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_chat text;
begin
  select value into v_token from public.notify_settings where key = 'telegram_bot_token';
  select value into v_chat from public.notify_settings where key = 'telegram_chat_id';
  if coalesce(v_token, '') = '' or coalesce(v_chat, '') = '' then return; end if;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_chat,
      'text', left(coalesce(p_text, ''), 3800),
      'parse_mode', 'HTML',
      'disable_web_page_preview', true
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 15000
  );
exception when others then
  null;
end;
$$;

create or replace function public.tg_order_text(o public.orders)
returns text
language plpgsql
as $$
declare
  v_lines text := '';
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(o.items) loop
    v_lines := v_lines || E'\n\u2022 ' || public.tg_escape(v_item ->> 'name')
      || case when coalesce(v_item ->> 'color', '') <> '' or coalesce(v_item ->> 'storage', '') <> ''
              then ' (' || public.tg_escape(concat_ws(', ', nullif(v_item ->> 'color', ''), nullif(v_item ->> 'storage', ''))) || ')'
              else '' end
      || ' x' || coalesce(v_item ->> 'quantity', '1');
  end loop;

  return E'\U0001f6d2 <b>\u0110\u01a0N H\u00c0NG M\u1edaI ' || public.tg_escape(o.code) || '</b>'
    || E'\nKh\u00e1ch: ' || public.tg_escape(o.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(o.phone)
    || E'\n\u0110\u1ecba ch\u1ec9: ' || public.tg_escape(o.address)
    || E'\nS\u1ea3n ph\u1ea9m:' || v_lines
    || E'\nT\u1ed5ng: <b>' || to_char(o.total, 'FM999G999G999G999') || E' \u20ab</b>'
    || case when o.voucher is not null then E'\nVoucher: ' || public.tg_escape(o.voucher) else '' end
    || case when o.note is not null then E'\nGhi ch\u00fa: ' || public.tg_escape(o.note) else '' end;
end;
$$;

create or replace function public.tg_booking_text(b public.repair_bookings)
returns text
language sql
as $$
  select case when b.service like E'Thu c\u0169%'
              then E'\u267b\ufe0f <b>Y\u00caU C\u1ea6U B\u00c1O GI\u00c1 THU C\u0168 ' else E'\U0001f527 <b>L\u1ecaCH S\u1eecA CH\u1eeeA M\u1edaI ' end
    || public.tg_escape(b.code) || '</b>'
    || E'\nKh\u00e1ch: ' || public.tg_escape(b.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(b.phone)
    || E'\nM\u00e1y: ' || public.tg_escape(b.device)
    || E'\nD\u1ecbch v\u1ee5: ' || public.tg_escape(b.service)
    || case when b.note is not null then E'\nM\u00f4 t\u1ea3: ' || public.tg_escape(b.note) else '' end;
$$;

create or replace function public.trg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.notify_telegram(public.tg_order_text(new));
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public.trg_notify_booking()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.notify_telegram(public.tg_booking_text(new));
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists notify_new_order on public.orders;
create trigger notify_new_order after insert on public.orders
  for each row execute function public.trg_notify_order();

drop trigger if exists notify_new_booking on public.repair_bookings;
create trigger notify_new_booking after insert on public.repair_bookings
  for each row execute function public.trg_notify_booking();

-- Chỉ trigger và quản trị viên SQL được gọi; khách (anon) không gọi trực tiếp được
revoke all on function public.notify_telegram(text) from public, anon, authenticated;
revoke all on function public.trg_notify_order() from public, anon, authenticated;
revoke all on function public.trg_notify_booking() from public, anon, authenticated;

-- Thong bao khi admin/nhan vien luu phieu bao hanh moi
create or replace function public.tg_warranty_text(w public.warranties)
returns text
language sql
as $$
  select E'\U0001f6e1\ufe0f <b>PHI\u1ebeU B\u1ea2O H\u00c0NH M\u1edaI ' || public.tg_escape(w.code) || '</b>'
    || E'\nKh\u00e1ch: ' || public.tg_escape(w.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(w.phone)
    || E'\nM\u00e1y: ' || public.tg_escape(w.device)
    || E'\nS\u1eeda ch\u1eefa: ' || public.tg_escape(w.service)
    || E'\nB\u1ea3o h\u00e0nh: ' || w.warranty_months || E' th\u00e1ng (\u0111\u1ebfn '
    || to_char((w.start_date + make_interval(months => w.warranty_months))::date, 'DD/MM/YYYY') || ')'
    || case when w.note is not null then E'\nGhi ch\u00fa: ' || public.tg_escape(w.note) else '' end;
$$;

create or replace function public.trg_notify_warranty()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.notify_telegram(public.tg_warranty_text(new));
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists notify_new_warranty on public.warranties;
create trigger notify_new_warranty after insert on public.warranties
  for each row execute function public.trg_notify_warranty();

revoke all on function public.trg_notify_warranty() from public, anon, authenticated;
