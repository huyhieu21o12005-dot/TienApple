-- Chia thong bao theo chu de (Topics) trong nhom Telegram.
-- Buoc 1: select public.telegram_make_topics();   (tao 4 chu de)
-- Buoc 2 (sau vai giay): select public.telegram_save_topics();   (luu id chu de)
-- Nhom phai bat Chu de (Topics) va bot la quan tri vien co quyen quan ly chu de.

create or replace function public.telegram_make_topics()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_chat text;
begin
  select value into v_chat from public.notify_settings where key = 'telegram_chat_id';
  for r in select * from (values
    ('order', E'\U0001f6d2 \u0110\u01a1n h\u00e0ng'),
    ('booking', E'\U0001f527 L\u1ecbch s\u1eeda ch\u1eefa'),
    ('tradein', E'\u267b\ufe0f Thu c\u0169'),
    ('warranty', E'\U0001f6e1\ufe0f B\u1ea3o h\u00e0nh')
  ) as t(kind, title)
  loop
    if not exists (select 1 from public.notify_settings where key = 'telegram_topic_' || r.kind) then
      perform public.tg_call('createForumTopic', jsonb_build_object('chat_id', v_chat, 'name', r.title));
    end if;
  end loop;
end;
$$;

-- Doc ket qua createForumTopic trong net._http_response va luu thread id
create or replace function public.telegram_save_topics()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_body jsonb;
  v_kind text;
  v_count int := 0;
begin
  for r in select content from net._http_response where status_code = 200 and content like '%message_thread_id%' order by id desc limit 50
  loop
    begin
      v_body := r.content::jsonb;
    exception when others then continue;
    end;
    if v_body ->> 'ok' <> 'true' or v_body -> 'result' ->> 'message_thread_id' is null then continue; end if;
    v_kind := case
      when v_body -> 'result' ->> 'name' like E'%n h\u00e0ng' then 'order'
      when v_body -> 'result' ->> 'name' like E'%ch\u1eefa' then 'booking'
      when v_body -> 'result' ->> 'name' like E'%Thu c\u0169' then 'tradein'
      when v_body -> 'result' ->> 'name' like E'%B\u1ea3o h\u00e0nh' then 'warranty'
      else null end;
    if v_kind is null then continue; end if;
    insert into public.notify_settings (key, value) values ('telegram_topic_' || v_kind, v_body -> 'result' ->> 'message_thread_id')
      on conflict (key) do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Gui thong bao vao dung chu de (neu da cau hinh), neu chua co thi gui vao General
create or replace function public.notify_telegram(p_text text, p_topic text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_chat text;
  v_thread text;
begin
  select value into v_token from public.notify_settings where key = 'telegram_bot_token';
  select value into v_chat from public.notify_settings where key = 'telegram_chat_id';
  select value into v_thread from public.notify_settings where key = 'telegram_topic_' || coalesce(p_topic, '');
  if coalesce(v_token, '') = '' or coalesce(v_chat, '') = '' then return; end if;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_strip_nulls(jsonb_build_object(
      'chat_id', v_chat,
      'message_thread_id', nullif(v_thread, '')::bigint,
      'text', left(coalesce(p_text, ''), 3800),
      'parse_mode', 'HTML',
      'disable_web_page_preview', true
    )),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 15000
  );
exception when others then
  null;
end;
$$;

create or replace function public.trg_notify_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.notify_telegram(public.tg_order_text(new), 'order');
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
  perform public.notify_telegram(public.tg_booking_text(new),
    case when new.service like E'Thu c\u0169%' then 'tradein' else 'booking' end);
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public.trg_notify_warranty()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.notify_telegram(public.tg_warranty_text(new), 'warranty');
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.telegram_make_topics() from public, anon, authenticated;
revoke all on function public.telegram_save_topics() from public, anon, authenticated;
revoke all on function public.notify_telegram(text, text) from public, anon, authenticated;
revoke all on function public.trg_notify_order() from public, anon, authenticated;
revoke all on function public.trg_notify_booking() from public, anon, authenticated;
revoke all on function public.trg_notify_warranty() from public, anon, authenticated;
