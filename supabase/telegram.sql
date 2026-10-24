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
    headers := '{"Content-Type": "application/json"}'::jsonb
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
    v_lines := v_lines || E'\n• ' || public.tg_escape(v_item ->> 'name')
      || case when coalesce(v_item ->> 'color', '') <> '' or coalesce(v_item ->> 'storage', '') <> ''
              then ' (' || public.tg_escape(concat_ws(', ', nullif(v_item ->> 'color', ''), nullif(v_item ->> 'storage', ''))) || ')'
              else '' end
      || ' x' || coalesce(v_item ->> 'quantity', '1');
  end loop;

  return '🛒 <b>ĐƠN HÀNG MỚI ' || public.tg_escape(o.code) || '</b>'
    || E'\nKhách: ' || public.tg_escape(o.customer_name)
    || E'\nSĐT: ' || public.tg_escape(o.phone)
    || E'\nĐịa chỉ: ' || public.tg_escape(o.address)
    || E'\nSản phẩm:' || v_lines
    || E'\nTổng: <b>' || to_char(o.total, 'FM999G999G999G999') || ' ₫</b>'
    || case when o.voucher is not null then E'\nVoucher: ' || public.tg_escape(o.voucher) else '' end
    || case when o.note is not null then E'\nGhi chú: ' || public.tg_escape(o.note) else '' end;
end;
$$;

create or replace function public.tg_booking_text(b public.repair_bookings)
returns text
language sql
as $$
  select case when b.service like 'Thu cũ%'
              then '♻️ <b>YÊU CẦU BÁO GIÁ THU CŨ ' else '🔧 <b>LỊCH SỬA CHỮA MỚI ' end
    || public.tg_escape(b.code) || '</b>'
    || E'\nKhách: ' || public.tg_escape(b.customer_name)
    || E'\nSĐT: ' || public.tg_escape(b.phone)
    || E'\nMáy: ' || public.tg_escape(b.device)
    || E'\nDịch vụ: ' || public.tg_escape(b.service)
    || case when b.note is not null then E'\nMô tả: ' || public.tg_escape(b.note) else '' end;
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
