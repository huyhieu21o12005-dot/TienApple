-- ==============================================================================
-- Tien Mobile - Bot Telegram quan ly bang nut bam (menu, don hang, lich hen,
-- thu cu, bao hanh, thong ke, tra SDT).
-- Chay SAU telegram.sql, orders.sql, warranty.sql. Chay lai nhieu lan an toan.
--
-- Cach hoat dong: Telegram goi webhook vao ham telegram_webhook (REST cua Supabase).
--  * Chi xu ly khi header X-Telegram-Bot-Api-Secret-Token khop bi mat luu trong
--    notify_settings (khong ai khac goi duoc du biet khoa cong khai).
--  * Chi tra loi trong nhom dung telegram_chat_id da cau hinh.
--  * Khong co lenh xoa: bot chi xem va doi trang thai don/lich.
-- Kich hoat webhook: chay mot lan  select public.telegram_setup('<URL webhook>');
-- ==============================================================================

create or replace function public.tg_call(p_method text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  select value into v_token from public.notify_settings where key = 'telegram_bot_token';
  if coalesce(v_token, '') = '' then return; end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/' || p_method,
    body := jsonb_strip_nulls(p_payload),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 15000
  );
exception when others then
  null;
end;
$$;

create or replace function public.tg_money(n numeric)
returns text
language sql
immutable
as $$
  select to_char(coalesce(n, 0), 'FM999G999G999G999') || E' \u20ab';
$$;

create or replace function public.tg_btn(p_text text, p_data text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('text', p_text, 'callback_data', p_data);
$$;

create or replace function public.tg_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'new' then E'M\u1edbi'
    when 'confirmed' then E'\u0110\u00e3 x\u00e1c nh\u1eadn'
    when 'shipping' then E'\u0110ang giao'
    when 'in_progress' then E'\u0110ang s\u1eeda'
    when 'done' then E'Ho\u00e0n t\u1ea5t'
    when 'cancelled' then E'\u0110\u00e3 h\u1ee7y'
    else coalesce(p_status, '') end;
$$;

create or replace function public.tg_order_card(o public.orders)
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

  return E'\U0001f6d2 <b>\u0110\u01a0N ' || public.tg_escape(o.code) || E'</b> \u00b7 ' || public.tg_status_label(o.status)
    || E'\nKh\u00e1ch: ' || public.tg_escape(o.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(o.phone)
    || E'\n\u0110\u1ecba ch\u1ec9: ' || public.tg_escape(o.address)
    || E'\nS\u1ea3n ph\u1ea9m:' || v_lines
    || E'\nT\u1ed5ng: <b>' || public.tg_money(o.total) || '</b>'
    || case when o.voucher is not null then E'\nVoucher: ' || public.tg_escape(o.voucher) else '' end
    || case when o.note is not null then E'\nGhi ch\u00fa: ' || public.tg_escape(o.note) else '' end
    || E'\nT\u1ea1o: ' || to_char(o.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI');
end;
$$;

create or replace function public.tg_booking_card(b public.repair_bookings)
returns text
language sql
as $$
  select case when b.service like E'Thu c\u0169%' then E'\u267b\ufe0f <b>THU C\u0168 ' else E'\U0001f527 <b>L\u1ecaCH S\u1eecA ' end
    || public.tg_escape(b.code) || E'</b> \u00b7 ' || public.tg_status_label(b.status)
    || E'\nKh\u00e1ch: ' || public.tg_escape(b.customer_name)
    || E'\nS\u0110T: ' || public.tg_escape(b.phone)
    || E'\nM\u00e1y: ' || public.tg_escape(b.device)
    || E'\nD\u1ecbch v\u1ee5: ' || public.tg_escape(b.service)
    || case when b.note is not null then E'\nM\u00f4 t\u1ea3: ' || public.tg_escape(b.note) else '' end
    || E'\nT\u1ea1o: ' || to_char(b.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI');
$$;

-- Tra theo so dien thoai
create or replace function public.tg_installment_card(r public.installments)
returns text
language sql
as $$
  select E'\U0001f4b3 <b>Tr\u1ea3 g\u00f3p ' || r.code || E'</b> \u00b7 ' || case r.status when 'active' then E'\u0110ang g\u00f3p' when 'completed' then E'\u0110\u00e3 t\u1ea5t to\u00e1n' else E'\u0110\u00e3 h\u1ee7y' end
    || E'\nKh\u00e1ch: ' || public.tg_escape(r.customer_name) || E' \u00b7 ' || r.phone
    || E'\nM\u00e1y: ' || public.tg_escape(r.product)
    || E'\nGi\u00e1 g\u1ed1c: ' || public.tg_money(r.original_price) || E' \u00b7 Tr\u1ea3 tr\u01b0\u1edbc: ' || public.tg_money(r.down_payment)
    || E'\nL\u00e3i: ' || trim(trailing '.' from trim(trailing '0' from r.interest_rate::text)) || E'%/th\u00e1ng \u00b7 ' || r.term_months || E' th\u00e1ng'
    || E'\nG\u00f3p m\u1ed7i th\u00e1ng: <b>' || public.tg_money(r.monthly_payment) || '</b>'
    || E'\n\u0110\u00e3 \u0111\u00f3ng: <b>' || r.paid_months || '/' || r.term_months || E'</b> k\u1ef3'
    || case when r.status = 'active' then E' \u00b7 k\u1ef3 t\u1edbi ' || to_char((r.start_date + make_interval(months => r.paid_months + 1))::date, 'DD/MM/YYYY') else '' end
    || E'\nH\u00ecnh th\u1ee9c: ' || public.tg_escape(r.pay_method)
    || E'\n<b>Th\u00e0nh ti\u1ec1n: ' || public.tg_money(r.total_amount) || '</b>'
    || case when r.documents is not null then E'\nGi\u1ea5y t\u1edd: ' || public.tg_escape(r.documents) else '' end;
$$;

create or replace function public.tg_search(p_input text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := regexp_replace(coalesce(p_input, ''), '[\s.-]', '', 'g');
  v_text text;
  r record;
  v_n int := 0;
begin
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then
    return jsonb_build_object('text', E'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng h\u1ee3p l\u1ec7. V\u00ed d\u1ee5: <code>/tim 0912345678</code>',
      'markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Menu', 'm')))));
  end if;

  v_text := E'\U0001f50e <b>K\u1ebft qu\u1ea3 cho ' || v_phone || '</b>';

  v_text := v_text || E'\n\n<b>\u0110\u01a1n h\u00e0ng</b>';
  for r in select code, customer_name, total, status from public.orders where phone = v_phone order by created_at desc limit 5 loop
    v_n := v_n + 1;
    v_text := v_text || E'\n\u2022 ' || r.code || E' \u00b7 ' || public.tg_escape(r.customer_name) || E' \u00b7 ' || public.tg_money(r.total) || E' \u00b7 ' || public.tg_status_label(r.status);
  end loop;
  if v_n = 0 then v_text := v_text || E'\n(kh\u00f4ng c\u00f3)'; end if;

  v_n := 0;
  v_text := v_text || E'\n\n<b>L\u1ecbch s\u1eeda v\u00e0 thu c\u0169</b>';
  for r in select code, device, service, status from public.repair_bookings where phone = v_phone order by created_at desc limit 5 loop
    v_n := v_n + 1;
    v_text := v_text || E'\n\u2022 ' || r.code || E' \u00b7 ' || public.tg_escape(r.device) || E' \u00b7 ' || public.tg_escape(r.service) || E' \u00b7 ' || public.tg_status_label(r.status);
  end loop;
  if v_n = 0 then v_text := v_text || E'\n(kh\u00f4ng c\u00f3)'; end if;

  v_n := 0;
  v_text := v_text || E'\n\n<b>B\u1ea3o h\u00e0nh</b>';
  for r in select code, device, service, (start_date + make_interval(months => warranty_months))::date as ends
           from public.warranties where phone = v_phone order by created_at desc limit 5 loop
    v_n := v_n + 1;
    v_text := v_text || E'\n\u2022 ' || r.code || E' \u00b7 ' || public.tg_escape(r.device) || E' \u00b7 ' || public.tg_escape(r.service)
      || E' \u00b7 \u0111\u1ebfn ' || to_char(r.ends, 'DD/MM/YYYY') || case when r.ends >= current_date then E' (c\u00f2n h\u1ea1n)' else E' (h\u1ebft h\u1ea1n)' end;
  end loop;
  if v_n = 0 then v_text := v_text || E'\n(kh\u00f4ng c\u00f3)'; end if;

  v_n := 0;
  v_text := v_text || E'\n\n<b>Tr\u1ea3 g\u00f3p</b>';
  for r in select code, product, paid_months, term_months, status from public.installments where phone = v_phone order by created_at desc limit 5 loop
    v_n := v_n + 1;
    v_text := v_text || E'\n\u2022 ' || r.code || E' \u00b7 ' || public.tg_escape(r.product) || E' \u00b7 ' || r.paid_months || '/' || r.term_months || E' k\u1ef3 \u00b7 '
      || case r.status when 'active' then E'\u0111ang g\u00f3p' when 'completed' then E'\u0111\u00e3 t\u1ea5t to\u00e1n' else E'\u0111\u00e3 h\u1ee7y' end;
  end loop;
  if v_n = 0 then v_text := v_text || E'\n(kh\u00f4ng c\u00f3)'; end if;

  return jsonb_build_object('text', v_text,
    'markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Menu', 'm')))));
end;
$$;

-- Man hinh theo callback_data: m, o:l, o:v:CODE, o:s:CODE:STATUS, b:l, t:l, b:v:CODE, b:s:CODE:STATUS, w:l, s:t, q
create or replace function public.tg_screen(p_data text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_parts text[] := string_to_array(coalesce(p_data, 'm'), ':');
  v_kind text := v_parts[1];
  v_act text := v_parts[2];
  v_code text := upper(coalesce(v_parts[3], ''));
  v_st text := coalesce(v_parts[4], '');
  v_text text := '';
  v_rows jsonb := '[]'::jsonb;
  v_trade boolean;
  v_day timestamptz := date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
  v_ord public.orders;
  v_bk public.repair_bookings;
  v_ins public.installments;
  r record;
  v_n int := 0;
  a int; b int; c int; d bigint; e int; f int; g int;
begin
  -- Doi trang thai truoc, sau do hien lai the chi tiet
  if v_act = 's' and v_kind = 'o' and v_code ~ '^DH[0-9]+$'
     and v_st in ('new', 'confirmed', 'shipping', 'done', 'cancelled') then
    update public.orders set status = v_st where code = v_code;
    v_act := 'v';
  elsif v_act = 's' and v_kind in ('b', 't') and v_code ~ '^SC[0-9]+$'
     and v_st in ('new', 'confirmed', 'in_progress', 'done', 'cancelled') then
    update public.repair_bookings set status = v_st where code = v_code;
    v_act := 'v';
  elsif v_act = 'p' and v_kind = 'g' and v_code ~ '^TG[0-9]+$' then
    update public.installments set paid_months = paid_months + 1
      where code = v_code and status = 'active' and paid_months < term_months;
    v_act := 'v';
  end if;

  if v_kind = 'o' and v_act = 'l' then
    v_text := E'\U0001f6d2 <b>\u0110\u01a1n h\u00e0ng \u0111ang x\u1eed l\u00fd</b>';
    for r in select code, customer_name, total, status from public.orders
             where status in ('new', 'confirmed', 'shipping') order by created_at desc limit 8 loop
      v_n := v_n + 1;
      v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(
        r.code || E' \u00b7 ' || left(r.customer_name, 18) || E' \u00b7 ' || public.tg_money(r.total) || E' \u00b7 ' || public.tg_status_label(r.status),
        'o:v:' || r.code)));
    end loop;
    if v_n = 0 then v_text := v_text || E'\nKh\u00f4ng c\u00f3 \u0111\u01a1n n\u00e0o c\u1ea7n x\u1eed l\u00fd. \U0001f389'; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(E'\U0001f504 L\u00e0m m\u1edbi', 'o:l'), public.tg_btn(E'\u2b05 Menu', 'm')));

  elsif v_kind = 'o' and v_act = 'v' then
    select * into v_ord from public.orders where code = v_code;
    if not found then
      v_text := E'Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n.';
    else
      v_text := public.tg_order_card(v_ord);
      v_rows := jsonb_build_array(
        jsonb_build_array(public.tg_btn(E'\u2705 X\u00e1c nh\u1eadn', 'o:s:' || v_code || ':confirmed'), public.tg_btn(E'\U0001f69a \u0110ang giao', 'o:s:' || v_code || ':shipping')),
        jsonb_build_array(public.tg_btn(E'\u2714 Ho\u00e0n t\u1ea5t', 'o:s:' || v_code || ':done'), public.tg_btn(E'\u2716 H\u1ee7y \u0111\u01a1n', 'o:s:' || v_code || ':cancelled'))
      );
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Danh s\u00e1ch', 'o:l'), public.tg_btn('Menu', 'm')));

  elsif v_kind in ('b', 't') and v_act = 'l' then
    v_trade := (v_kind = 't');
    v_text := case when v_trade then E'\u267b\ufe0f <b>Y\u00eau c\u1ea7u thu c\u0169 \u0111ang x\u1eed l\u00fd</b>' else E'\U0001f527 <b>L\u1ecbch s\u1eeda ch\u1eefa \u0111ang x\u1eed l\u00fd</b>' end;
    for r in select code, customer_name, device, status from public.repair_bookings
             where status in ('new', 'confirmed', 'in_progress') and ((service like E'Thu c\u0169%') = v_trade)
             order by created_at desc limit 8 loop
      v_n := v_n + 1;
      v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(
        r.code || E' \u00b7 ' || left(r.customer_name, 16) || E' \u00b7 ' || left(r.device, 18) || E' \u00b7 ' || public.tg_status_label(r.status),
        'b:v:' || r.code)));
    end loop;
    if v_n = 0 then v_text := v_text || E'\nKh\u00f4ng c\u00f3 m\u1ee5c n\u00e0o c\u1ea7n x\u1eed l\u00fd. \U0001f389'; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(E'\U0001f504 L\u00e0m m\u1edbi', v_kind || ':l'), public.tg_btn(E'\u2b05 Menu', 'm')));

  elsif v_kind in ('b', 't') and v_act = 'v' then
    select * into v_bk from public.repair_bookings where code = v_code;
    if not found then
      v_text := E'Kh\u00f4ng t\u00ecm th\u1ea5y l\u1ecbch.';
      v_rows := jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Menu', 'm')));
    else
      v_text := public.tg_booking_card(v_bk);
      v_rows := jsonb_build_array(
        jsonb_build_array(public.tg_btn(E'\u2705 X\u00e1c nh\u1eadn', 'b:s:' || v_code || ':confirmed'), public.tg_btn(E'\U0001f527 \u0110ang s\u1eeda', 'b:s:' || v_code || ':in_progress')),
        jsonb_build_array(public.tg_btn(E'\u2714 Ho\u00e0n t\u1ea5t', 'b:s:' || v_code || ':done'), public.tg_btn(E'\u2716 H\u1ee7y', 'b:s:' || v_code || ':cancelled')),
        jsonb_build_array(public.tg_btn(E'\u2b05 Danh s\u00e1ch', case when v_bk.service like E'Thu c\u0169%' then 't:l' else 'b:l' end), public.tg_btn('Menu', 'm'))
      );
    end if;

  elsif v_kind = 'g' and v_act = 'l' then
    v_text := E'\U0001f4b3 <b>Tr\u1ea3 g\u00f3p \u0111ang g\u00f3p</b>';
    for r in select code, customer_name, product, paid_months, term_months from public.installments
             where status = 'active' order by start_date, created_at limit 8 loop
      v_n := v_n + 1;
      v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(
        r.code || E' \u00b7 ' || left(r.customer_name, 14) || E' \u00b7 ' || left(r.product, 14) || E' \u00b7 ' || r.paid_months || '/' || r.term_months,
        'g:v:' || r.code)));
    end loop;
    if v_n = 0 then v_text := v_text || E'\nKh\u00f4ng c\u00f3 h\u1ed3 s\u01a1 n\u00e0o \u0111ang g\u00f3p.'; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(E'\U0001f504 L\u00e0m m\u1edbi', 'g:l'), public.tg_btn(E'\u2b05 Menu', 'm')));

  elsif v_kind = 'g' and v_act = 'v' then
    select * into v_ins from public.installments where code = v_code;
    if not found then
      v_text := E'Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1.';
    else
      v_text := public.tg_installment_card(v_ins);
      if v_ins.status = 'active' then
        v_rows := jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2705 +1 k\u1ef3 \u0111\u00e3 \u0111\u00f3ng', 'g:p:' || v_code)));
      end if;
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Danh s\u00e1ch', 'g:l'), public.tg_btn('Menu', 'm')));

  elsif v_kind = 'w' then
    select count(*) filter (where (start_date + make_interval(months => warranty_months))::date >= current_date),
           count(*) filter (where (start_date + make_interval(months => warranty_months))::date < current_date)
      into a, b from public.warranties;
    v_text := E'\U0001f6e1\ufe0f <b>B\u1ea3o h\u00e0nh</b>' || E'\nC\u00f2n h\u1ea1n: <b>' || a || E'</b> \u00b7 H\u1ebft h\u1ea1n: <b>' || b || '</b>'
      || E'\n\n<b>S\u1eafp h\u1ebft h\u1ea1n (30 ng\u00e0y t\u1edbi)</b>';
    for r in select code, customer_name, phone, device, (start_date + make_interval(months => warranty_months))::date as ends
             from public.warranties
             where (start_date + make_interval(months => warranty_months))::date between current_date and current_date + 30
             order by 5 limit 6 loop
      v_n := v_n + 1;
      v_text := v_text || E'\n\u2022 ' || r.code || E' \u00b7 ' || public.tg_escape(r.customer_name) || E' \u00b7 ' || r.phone || E' \u00b7 ' || public.tg_escape(r.device)
        || E' \u00b7 ' || to_char(r.ends, 'DD/MM') || ' (' || (r.ends - current_date) || E' ng\u00e0y)';
    end loop;
    if v_n = 0 then v_text := v_text || E'\n(kh\u00f4ng c\u00f3)'; end if;
    v_n := 0;
    v_text := v_text || E'\n\n<b>Phi\u1ebfu m\u1edbi nh\u1ea5t</b>';
    for r in select code, customer_name, phone, device from public.warranties order by created_at desc limit 5 loop
      v_n := v_n + 1;
      v_text := v_text || E'\n\u2022 ' || r.code || E' \u00b7 ' || public.tg_escape(r.customer_name) || E' \u00b7 ' || r.phone || E' \u00b7 ' || public.tg_escape(r.device);
    end loop;
    if v_n = 0 then v_text := v_text || E'\n(ch\u01b0a c\u00f3 phi\u1ebfu)'; end if;
    v_rows := jsonb_build_array(jsonb_build_array(public.tg_btn(E'\U0001f504 L\u00e0m m\u1edbi', 'w:l'), public.tg_btn(E'\u2b05 Menu', 'm')));

  elsif v_kind = 's' then
    select count(*) filter (where status <> 'cancelled'), coalesce(sum(total) filter (where status <> 'cancelled'), 0)
      into a, d from public.orders where created_at >= v_day;
    select count(*) filter (where service not like E'Thu c\u0169%'), count(*) filter (where service like E'Thu c\u0169%')
      into b, c from public.repair_bookings where created_at >= v_day;
    select count(*) into e from public.warranties where created_at >= v_day;
    v_text := E'\U0001f4ca <b>H\u00f4m nay ' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') || '</b>'
      || E'\n\u0110\u01a1n h\u00e0ng: <b>' || a || E'</b> \u00b7 Doanh thu: <b>' || public.tg_money(d) || '</b>'
      || E'\nL\u1ecbch s\u1eeda ch\u1eefa: <b>' || b || '</b>'
      || E'\nY\u00eau c\u1ea7u thu c\u0169: <b>' || c || '</b>'
      || E'\nPhi\u1ebfu b\u1ea3o h\u00e0nh m\u1edbi: <b>' || e || '</b>';
    v_rows := jsonb_build_array(jsonb_build_array(public.tg_btn(E'\U0001f504 L\u00e0m m\u1edbi', 's:t'), public.tg_btn(E'\u2b05 Menu', 'm')));

  elsif v_kind = 'h' then
    v_text := public.tg_help_text();
    v_rows := jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Menu', 'm')));

  else
    select count(*) filter (where status = 'new') into a from public.orders;
    select count(*) filter (where status = 'new' and service not like E'Thu c\u0169%'),
           count(*) filter (where status = 'new' and service like E'Thu c\u0169%')
      into b, c from public.repair_bookings;
    select count(*) into f from public.warranties
      where (start_date + make_interval(months => warranty_months))::date between current_date and current_date + 30;
    select count(*) into g from public.installments where status = 'active';
    v_text := E'\U0001f3ea <b>TIEN MOBILE THU DUC \u00b7 QU\u1ea2N L\u00dd</b>'
      || E'\n\u0110\u01a1n m\u1edbi: <b>' || a || E'</b> \u00b7 L\u1ecbch s\u1eeda m\u1edbi: <b>' || b || E'</b> \u00b7 Thu c\u0169 m\u1edbi: <b>' || c || '</b>'
      || E'\nB\u1ea3o h\u00e0nh s\u1eafp h\u1ebft h\u1ea1n (30 ng\u00e0y): <b>' || f || E'</b> \u00b7 Tr\u1ea3 g\u00f3p \u0111ang g\u00f3p: <b>' || g || '</b>'
      || E'\n\nCh\u1ecdn m\u1ee5c b\u00ean d\u01b0\u1edbi:';
    v_rows := jsonb_build_array(
      jsonb_build_array(public.tg_btn(E'\U0001f6d2 \u0110\u01a1n h\u00e0ng (' || a || ')', 'o:l'), public.tg_btn(E'\U0001f527 L\u1ecbch s\u1eeda (' || b || ')', 'b:l')),
      jsonb_build_array(public.tg_btn(E'\u267b\ufe0f Thu c\u0169 (' || c || ')', 't:l'), public.tg_btn(E'\U0001f6e1\ufe0f B\u1ea3o h\u00e0nh', 'w:l')),
      jsonb_build_array(public.tg_btn(E'\U0001f4b3 Tr\u1ea3 g\u00f3p (' || g || ')', 'g:l'), public.tg_btn(E'\U0001f4ca H\u00f4m nay', 's:t')),
      jsonb_build_array(public.tg_btn(E'\U0001f50e Tra S\u0110T', 'q'), public.tg_btn(E'\u2795 Th\u00eam phi\u1ebfu BH', 'a')),
      jsonb_build_array(public.tg_btn(E'\u2753 Tr\u1ee3 gi\u00fap', 'h'), public.tg_btn(E'\U0001f504 L\u00e0m m\u1edbi', 'm'))
    );
  end if;

  return jsonb_build_object('text', left(v_text, 3800), 'markup', jsonb_build_object('inline_keyboard', v_rows));
end;
$$;

-- Noi dung huong dan va cac loi nhac nhap lieu
create or replace function public.tg_help_text()
returns text
language sql
immutable
as $$
  select E'\u2753 <b>H\u01b0\u1edbng d\u1eabn d\u00f9ng bot</b>'
    || E'\n\n<b>L\u1ec7nh</b>'
    || E'\n/menu \u00b7 m\u1edf menu qu\u1ea3n l\u00fd (n\u00fat b\u1ea5m)'
    || E'\n/donhang \u00b7 \u0111\u01a1n \u0111ang x\u1eed l\u00fd'
    || E'\n/tragop \u00b7 h\u1ed3 s\u01a1 tr\u1ea3 g\u00f3p \u0111ang g\u00f3p'
    || E'\n/lichsua \u00b7 l\u1ecbch s\u1eeda ch\u1eefa \u0111ang x\u1eed l\u00fd'
    || E'\n/thucu \u00b7 y\u00eau c\u1ea7u thu c\u0169 \u0111ang x\u1eed l\u00fd'
    || E'\n/baohanh \u00b7 t\u00ecnh tr\u1ea1ng b\u1ea3o h\u00e0nh'
    || E'\n/homnay \u00b7 th\u1ed1ng k\u00ea h\u00f4m nay'
    || E'\n/tim 0912345678 \u00b7 tra theo s\u1ed1 \u0111i\u1ec7n tho\u1ea1i'
    || E'\n/themphieu \u00b7 th\u00eam phi\u1ebfu b\u1ea3o h\u00e0nh'
    || E'\n/huy \u00b7 h\u1ee7y thao t\u00e1c \u0111ang nh\u1eadp'
    || E'\n/start \u00b7 hi\u1ec7n b\u00e0n ph\u00edm n\u00fat b\u1ea5m'
    || E'\n\n<b>Th\u00eam phi\u1ebfu b\u1ea3o h\u00e0nh</b> (m\u1ed9t tin, ng\u0103n c\u00e1ch b\u1eb1ng d\u1ea5u ;)'
    || E'\n<code>T\u00ean kh\u00e1ch; S\u0110T; M\u00e1y; N\u1ed9i dung s\u1eeda; S\u1ed1 th\u00e1ng</code>'
    || E'\nV\u00ed d\u1ee5: <code>Nguy\u1ec5n An; 0912345678; iPhone 15; Thay pin; 6</code>'
    || E'\nB\u1ecf tr\u1ed1ng s\u1ed1 th\u00e1ng th\u00ec m\u1eb7c \u0111\u1ecbnh 3 th\u00e1ng.'
    || E'\n\nTrong danh s\u00e1ch, b\u1ea5m v\u00e0o m\u1ed9t m\u1ee5c \u0111\u1ec3 xem chi ti\u1ebft v\u00e0 \u0111\u1ed5i tr\u1ea1ng th\u00e1i. N\u00fat \u2b05 \u0111\u1ec3 quay l\u1ea1i.';
$$;

create or replace function public.tg_prompt_search()
returns text
language sql
immutable
as $$ select E'\U0001f50e Nh\u1eadp s\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00e1ch c\u1ea7n tra (tr\u1ea3 l\u1eddi tin n\u00e0y):'; $$;

create or replace function public.tg_prompt_add()
returns text
language sql
immutable
as $$
  select E'\u2795 Nh\u1eadp phi\u1ebfu b\u1ea3o h\u00e0nh m\u1edbi (tr\u1ea3 l\u1eddi tin n\u00e0y) theo m\u1eabu:'
    || E'\nT\u00ean kh\u00e1ch; S\u0110T; M\u00e1y; N\u1ed9i dung s\u1eeda; S\u1ed1 th\u00e1ng'
    || E'\nV\u00ed d\u1ee5: Nguy\u1ec5n An; 0912345678; iPhone 15; Thay pin; 6'
    || E'\n(g\u1eedi /huy \u0111\u1ec3 h\u1ee7y)';
$$;

-- Ban phim co dinh o duoi o chat
create or replace function public.tg_keyboard()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('keyboard', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('text', E'\U0001f3e0 Menu'), jsonb_build_object('text', E'\U0001f6d2 \u0110\u01a1n h\u00e0ng'), jsonb_build_object('text', E'\U0001f527 L\u1ecbch s\u1eeda')),
      jsonb_build_array(jsonb_build_object('text', E'\u267b\ufe0f Thu c\u0169'), jsonb_build_object('text', E'\U0001f6e1\ufe0f B\u1ea3o h\u00e0nh'), jsonb_build_object('text', E'\U0001f4b3 Tr\u1ea3 g\u00f3p')),
      jsonb_build_array(jsonb_build_object('text', E'\U0001f4ca H\u00f4m nay'), jsonb_build_object('text', E'\U0001f50e Tra S\u0110T'), jsonb_build_object('text', E'\u2795 Th\u00eam phi\u1ebfu BH')),
      jsonb_build_array(jsonb_build_object('text', E'\u2753 Tr\u1ee3 gi\u00fap'))),
    'resize_keyboard', true, 'is_persistent', true);
$$;

-- Doi chu tren nut ban phim thanh lenh (bo emoji dau chu)
create or replace function public.tg_label_cmd(p_text text)
returns text
language sql
immutable
as $$
  select case lower(btrim(regexp_replace(coalesce(p_text, ''), E'^[^A-Za-z\u00c0-\u1ef9]+', '')))
    when lower('Menu') then '/menu'
    when lower(E'\u0110\u01a1n h\u00e0ng') then '/donhang'
    when lower(E'L\u1ecbch s\u1eeda') then '/lichsua'
    when lower(E'Tr\u1ea3 g\u00f3p') then '/tragop'
    when lower(E'Thu c\u0169') then '/thucu'
    when lower(E'B\u1ea3o h\u00e0nh') then '/baohanh'
    when lower(E'H\u00f4m nay') then '/homnay'
    when lower(E'Tra S\u0110T') then '/tim'
    when lower(E'Th\u00eam phi\u1ebfu BH') then '/themphieu'
    when lower(E'Tr\u1ee3 gi\u00fap') then '/help'
    else '' end;
$$;

-- Tao phieu bao hanh tu tin nhan: Ten; SDT; May; Noi dung sua; So thang
create or replace function public.tg_add_warranty(p_input text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_parts text[] := regexp_split_to_array(btrim(coalesce(p_input, '')), '\s*[;|]\s*|\s*\n\s*');
  v_phone text;
  v_months int := 3;
  v_code text;
  v_end date;
  v_menu jsonb := jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(public.tg_btn(E'\u2b05 Menu', 'm'))));
begin
  if array_length(v_parts, 1) is null or array_length(v_parts, 1) < 4 then
    return jsonb_build_object('text', E'\u26a0\ufe0f Thi\u1ebfu th\u00f4ng tin. M\u1eabu: <code>T\u00ean kh\u00e1ch; S\u0110T; M\u00e1y; N\u1ed9i dung s\u1eeda; S\u1ed1 th\u00e1ng</code>', 'markup', v_menu);
  end if;

  v_phone := regexp_replace(v_parts[2], '[\s.-]', '', 'g');
  v_phone := regexp_replace(v_phone, '^\+?84', '0');
  if v_phone !~ '^0[35789][0-9]{8}$' then
    return jsonb_build_object('text', E'\u26a0\ufe0f S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng h\u1ee3p l\u1ec7 (c\u1ea7n 10 ch\u1eef s\u1ed1).', 'markup', v_menu);
  end if;

  if array_length(v_parts, 1) >= 5 and btrim(v_parts[5]) <> '' then
    if btrim(v_parts[5]) !~ '^[0-9]{1,2}$' or btrim(v_parts[5])::int not between 1 and 60 then
      return jsonb_build_object('text', E'\u26a0\ufe0f S\u1ed1 th\u00e1ng b\u1ea3o h\u00e0nh ph\u1ea3i t\u1eeb 1 \u0111\u1ebfn 60.', 'markup', v_menu);
    end if;
    v_months := btrim(v_parts[5])::int;
  end if;

  if btrim(v_parts[1]) = '' or btrim(v_parts[3]) = '' or btrim(v_parts[4]) = '' then
    return jsonb_build_object('text', E'\u26a0\ufe0f T\u00ean, m\u00e1y v\u00e0 n\u1ed9i dung s\u1eeda kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.', 'markup', v_menu);
  end if;

  insert into public.warranties (customer_name, phone, device, service, warranty_months)
  values (left(btrim(v_parts[1]), 100), v_phone, left(btrim(v_parts[3]), 100), left(btrim(v_parts[4]), 300), v_months)
  returning code, (start_date + make_interval(months => warranty_months))::date into v_code, v_end;

  return jsonb_build_object(
    'text', E'\u2705 \u0110\u00e3 t\u1ea1o phi\u1ebfu <b>' || v_code || E'</b> \u00b7 b\u1ea3o h\u00e0nh ' || v_months || E' th\u00e1ng, \u0111\u1ebfn ' || to_char(v_end, 'DD/MM/YYYY'),
    'markup', v_menu);
exception when others then
  return jsonb_build_object('text', E'\u26a0\ufe0f Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c phi\u1ebfu, ki\u1ec3m tra l\u1ea1i th\u00f4ng tin.', 'markup', v_menu);
end;
$$;

-- Webhook: Telegram goi ham nay (tham so JSON khong ten theo quy uoc cua PostgREST)
create or replace function public.telegram_webhook(jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_upd jsonb := $1;
  v_hdr text;
  v_secret text;
  v_cfg_chat text;
  v_cb jsonb := v_upd -> 'callback_query';
  v_msg jsonb := coalesce(v_upd -> 'message', v_cb -> 'message');
  v_chat bigint;
  v_screen jsonb;
  v_text text := btrim(coalesce(v_msg ->> 'text', ''));
  v_arg text;
  v_cmd text;
  v_reply text := coalesce(v_msg -> 'reply_to_message' ->> 'text', '');
  v_reply_bot boolean := coalesce((v_msg -> 'reply_to_message' -> 'from' ->> 'is_bot')::boolean, false);
  v_data text;
  v_thread bigint := (coalesce(v_upd -> 'message', v_cb -> 'message') ->> 'message_thread_id')::bigint;
begin
  v_hdr := coalesce((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb) ->> 'x-telegram-bot-api-secret-token', '');
  select value into v_secret from public.notify_settings where key = 'telegram_webhook_secret';
  if coalesce(v_secret, '') = '' or v_hdr <> v_secret then
    return jsonb_build_object('ok', false);
  end if;

  select value into v_cfg_chat from public.notify_settings where key = 'telegram_chat_id';
  v_chat := (v_msg -> 'chat' ->> 'id')::bigint;
  if v_chat is null or v_chat::text <> coalesce(v_cfg_chat, '') then
    return jsonb_build_object('ok', true);
  end if;

  -- Bam nut tren tin nhan
  if v_cb is not null then
    v_data := coalesce(v_cb ->> 'data', 'm');
    perform public.tg_call('answerCallbackQuery', jsonb_build_object('callback_query_id', v_cb ->> 'id'));
    if v_data = 'q' or v_data = 'a' then
      perform public.tg_call('sendMessage', jsonb_build_object('message_thread_id', v_thread,
        'chat_id', v_chat,
        'text', case when v_data = 'q' then public.tg_prompt_search() else public.tg_prompt_add() end,
        'reply_markup', jsonb_build_object('force_reply', true, 'input_field_placeholder',
          case when v_data = 'q' then '0912345678' else E'T\u00ean; S\u0110T; M\u00e1y; N\u1ed9i dung s\u1eeda; S\u1ed1 th\u00e1ng' end)));
    else
      v_screen := public.tg_screen(v_data);
      perform public.tg_call('editMessageText', jsonb_build_object(
        'chat_id', v_chat,
        'message_id', (v_msg ->> 'message_id')::bigint,
        'text', v_screen ->> 'text',
        'parse_mode', 'HTML',
        'disable_web_page_preview', true,
        'reply_markup', v_screen -> 'markup'));
    end if;
    return jsonb_build_object('ok', true);
  end if;

  if v_text = '' then return jsonb_build_object('ok', true); end if;

  -- Lenh go tay hoac nut ban phim
  if left(v_text, 1) = '/' then
    v_cmd := lower(split_part(split_part(v_text, ' ', 1), '@', 1));
    v_arg := btrim(substr(v_text, length(split_part(v_text, ' ', 1)) + 1));
  else
    v_cmd := public.tg_label_cmd(v_text);
    v_arg := '';
  end if;

  if v_cmd = '/start' then
    perform public.tg_call('sendMessage', jsonb_build_object('message_thread_id', v_thread,
      'chat_id', v_chat,
      'text', E'\U0001f44b Ch\u00e0o m\u1eebng \u0111\u1ebfn <b>Tien Mobile Thu Duc \u00b7 Qu\u1ea3n l\u00fd</b>. D\u00f9ng b\u00e0n ph\u00edm b\u00ean d\u01b0\u1edbi ho\u1eb7c g\u00f5 /help.',
      'parse_mode', 'HTML',
      'reply_markup', public.tg_keyboard()));
    v_screen := public.tg_screen('m');
  elsif v_cmd in ('/menu', '/back') then
    v_screen := public.tg_screen('m');
  elsif v_cmd = '/donhang' then
    v_screen := public.tg_screen('o:l');
  elsif v_cmd = '/lichsua' then
    v_screen := public.tg_screen('b:l');
  elsif v_cmd = '/tragop' then
    v_screen := public.tg_screen('g:l');
  elsif v_cmd = '/thucu' then
    v_screen := public.tg_screen('t:l');
  elsif v_cmd = '/baohanh' then
    v_screen := public.tg_screen('w:l');
  elsif v_cmd = '/homnay' then
    v_screen := public.tg_screen('s:t');
  elsif v_cmd = '/help' then
    v_screen := public.tg_screen('h');
  elsif v_cmd = '/huy' then
    v_screen := public.tg_screen('m');
    v_screen := jsonb_set(v_screen, '{text}', to_jsonb(E'\u0110\u00e3 h\u1ee7y thao t\u00e1c.' || E'\n\n' || (v_screen ->> 'text')));
  elsif v_cmd = '/tim' and v_arg <> '' then
    v_screen := public.tg_search(v_arg);
  elsif v_cmd = '/themphieu' and v_arg <> '' then
    v_screen := public.tg_add_warranty(v_arg);
  elsif v_cmd in ('/tim', '/themphieu') then
    perform public.tg_call('sendMessage', jsonb_build_object('message_thread_id', v_thread,
      'chat_id', v_chat,
      'text', case when v_cmd = '/tim' then public.tg_prompt_search() else public.tg_prompt_add() end,
      'reply_markup', jsonb_build_object('force_reply', true)));
    return jsonb_build_object('ok', true);
  elsif v_reply_bot and v_reply like public.tg_prompt_search() || '%' then
    v_screen := public.tg_search(v_text);
  elsif v_reply_bot and v_reply like left(public.tg_prompt_add(), 40) || '%' then
    v_screen := public.tg_add_warranty(v_text);
  else
    return jsonb_build_object('ok', true);
  end if;

  perform public.tg_call('sendMessage', jsonb_build_object('message_thread_id', v_thread,
    'chat_id', v_chat,
    'text', v_screen ->> 'text',
    'parse_mode', 'HTML',
    'disable_web_page_preview', true,
    'reply_markup', v_screen -> 'markup'));
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', true);
end;
$$;

-- Kich hoat webhook va menu lenh. Tao bi mat neu chua co.
create or replace function public.telegram_setup(p_webhook_url text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.notify_settings where key = 'telegram_webhook_secret';
  if coalesce(v_secret, '') = '' then
    v_secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into public.notify_settings (key, value) values ('telegram_webhook_secret', v_secret)
      on conflict (key) do update set value = excluded.value;
  end if;

  perform public.tg_call('setWebhook', jsonb_build_object(
    'url', p_webhook_url,
    'secret_token', v_secret,
    'allowed_updates', jsonb_build_array('message', 'callback_query'),
    'max_connections', 5,
    'drop_pending_updates', true));

  perform public.tg_call('setMyCommands', jsonb_build_object('commands', jsonb_build_array(
    jsonb_build_object('command', 'start', 'description', E'Hi\u1ec7n b\u00e0n ph\u00edm n\u00fat b\u1ea5m'),
    jsonb_build_object('command', 'menu', 'description', E'M\u1edf menu qu\u1ea3n l\u00fd'),
    jsonb_build_object('command', 'donhang', 'description', E'\u0110\u01a1n h\u00e0ng \u0111ang x\u1eed l\u00fd'),
    jsonb_build_object('command', 'lichsua', 'description', E'L\u1ecbch s\u1eeda ch\u1eefa'),
    jsonb_build_object('command', 'tragop', 'description', E'H\u1ed3 s\u01a1 tr\u1ea3 g\u00f3p'),
    jsonb_build_object('command', 'thucu', 'description', E'Y\u00eau c\u1ea7u thu c\u0169'),
    jsonb_build_object('command', 'baohanh', 'description', E'T\u00ecnh tr\u1ea1ng b\u1ea3o h\u00e0nh'),
    jsonb_build_object('command', 'homnay', 'description', E'Th\u1ed1ng k\u00ea h\u00f4m nay'),
    jsonb_build_object('command', 'tim', 'description', E'Tra theo s\u1ed1 \u0111i\u1ec7n tho\u1ea1i'),
    jsonb_build_object('command', 'themphieu', 'description', E'Th\u00eam phi\u1ebfu b\u1ea3o h\u00e0nh'),
    jsonb_build_object('command', 'help', 'description', E'H\u01b0\u1edbng d\u1eabn'),
    jsonb_build_object('command', 'huy', 'description', E'H\u1ee7y thao t\u00e1c'))));
end;
$$;

revoke all on function public.tg_call(text, jsonb) from public, anon, authenticated;
revoke all on function public.tg_screen(text) from public, anon, authenticated;
revoke all on function public.tg_search(text) from public, anon, authenticated;
revoke all on function public.telegram_setup(text) from public, anon, authenticated;
revoke all on function public.tg_add_warranty(text) from public, anon, authenticated;
revoke all on function public.telegram_webhook(jsonb) from public;
grant execute on function public.telegram_webhook(jsonb) to anon, authenticated;
