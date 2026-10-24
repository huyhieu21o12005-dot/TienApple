# Hướng Dẫn Quản Trị & Cấu Hình Supabase Cho Tiến Mobile

Tài liệu này hướng dẫn chi tiết từng bước để thiết lập cơ sở dữ liệu Supabase, tạo tài khoản quản trị viên, cấu hình kho lưu trữ hình ảnh và vận hành trang Quản trị sản phẩm (`Frontend/admin/`) cho **Tiến Mobile**.

---

## 1. Tổng quan Kiến trúc

- **Public Site**: Truy cập tại `/` (`Frontend/index.html`). Đọc dữ liệu sản phẩm hiển thị công khai từ bảng `products` trên Supabase (chỉ các mục có `is_visible = true`). Nếu mạng gián đoạn hoặc chưa điền key Supabase, trang web sẽ tự động kích hoạt cơ chế fallback dữ liệu dự phòng từ `data/products.json` mà không bao giờ bị gián đoạn hay trống gian hàng.
- **Admin Dashboard**: Truy cập tại `/admin/` (`Frontend/admin/index.html`). Được bảo vệ hoàn toàn bằng **Supabase Auth**. Giao diện thẻ phẳng chuẩn Apple (Apple Minimalist), hỗ trợ điện thoại (375px) và máy tính (1440px), sửa giá nhanh trực tiếp (inline edit), điều chỉnh tồn kho, bật/tắt hiển thị, thao tác hàng loạt (Bulk mode) và tải ảnh trực tiếp từ camera/thư viện ảnh điện thoại với nén tự động client-side.
- **Bảo mật**: Row Level Security (RLS) trên PostgreSQL. Public Anon Key chỉ được `SELECT` sản phẩm đang hiện; chỉ tài khoản Authenticated mới có quyền sửa đổi dữ liệu và tải/xóa ảnh trên Storage bucket `product-images`. **Tuyệt đối không sử dụng `service_role` key trên client**.

---

## 2. Các Bước Thiết Lập Supabase

### Bước 2.1: Tạo Project mới trên Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng nhập (hoặc đăng ký tài khoản miễn phí).
2. Nhấn nút **New Project**.
3. Điền thông tin:
   - **Name**: `Tien-Mobile`
   - **Database Password**: Đặt mật khẩu mạnh và lưu lại an toàn.
   - **Region**: Chọn khu vực gần Việt Nam nhất (ví dụ: `Singapore - ap-southeast-1`).
4. Nhấn **Create new project** và chờ 1-2 phút để Supabase khởi tạo.

---

### Bước 2.2: Chạy Schema DDL và Dữ liệu Mẫu (Seed)
1. Trong bảng điều khiển Supabase, nhấn vào biểu tượng **SQL Editor** ở thanh menu bên trái.
2. Mở tệp `supabase/schema.sql` trong dự án, sao chép toàn bộ nội dung và dán vào SQL Editor.
3. Nhấn **Run** (Ctrl + Enter) để tạo:
   - Bảng `products` với đầy đủ ràng buộc kiểm tra (`check constraints`), trigger tự động cập nhật thời gian `updated_at`.
   - Các chính sách bảo mật Row Level Security (RLS).
   - Bucket lưu trữ `product-images` cùng các chính sách bảo mật Storage.
4. Tiếp tục mở tệp `supabase/seed.sql`, sao chép toàn bộ nội dung và dán vào SQL Editor rồi nhấn **Run**.
   - Dữ liệu của 8 sản phẩm cốt lõi (iPhone 16 Pro, iPhone 16 Plus, iPhone 15, iPhone 14 Like New, Galaxy S24 Ultra, Xiaomi 14, OPPO Find X7, Củ sạc 30W) cùng các phụ kiện chính hãng sẽ được nạp ngay vào cơ sở dữ liệu.

---

### Bước 2.3: Tạo Tài khoản Quản trị viên (Admin User)
1. Vào mục **Authentication** -> **Users** trong menu Supabase.
2. Nhấn **Add user** -> chọn **Create user**.
3. Điền:
   - **Email**: ví dụ `admin@tienmobile.vn`
   - **Password**: Đặt mật khẩu quản trị (ít nhất 8 ký tự).
   - Tích chọn **Auto Confirm User?** (để tài khoản có thể đăng nhập ngay mà không cần xác thực email).
4. Nhấn **Create user**.

> [!IMPORTANT]
> **Tắt Đăng Ký Công Khai (Disable Public Sign-ups):**
> Để ngăn người lạ tự ý đăng ký tài khoản admin, bạn vào **Authentication** -> **Providers** -> **Email**, tìm mục **Allow new users to sign up** và **TẮT (Disable)** nó đi, sau đó nhấn **Save**.

---

### Bước 2.4: Kiểm tra Bucket `product-images`
1. Vào mục **Storage** trên menu Supabase.
2. Bạn sẽ thấy bucket `product-images` với nhãn **Public**.
3. Nếu chưa thấy, bạn có thể nhấn **New bucket**, đặt tên chính xác là `product-images`, tích chọn **Public bucket** và nhấn **Save bucket**.

---

### Bước 2.5: Điền URL và Anon Key vào `Frontend/js/config.js`
1. Trong Supabase, vào **Project Settings** (biểu tượng bánh răng ở góc dưới bên trái) -> chọn **API**.
2. Tìm hai thông số:
   - **Project URL**: Ví dụ `https://xyzcompany.supabase.co`
   - **Project API Keys**: Copy khóa có nhãn `anon` `public` (dạng `eyJhbGciOi...`).
3. Mở tệp `Frontend/js/config.js` trong mã nguồn và điền vào:
   ```javascript
   export const SUPABASE_URL = "https://xyzcompany.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   ```
4. Lưu tệp lại.

---

## 3. Khởi Chạy Thử Nghiệm Tại Local

Chạy máy chủ tĩnh cục bộ bằng Python hoặc Node:
```bash
# Khởi chạy từ thư mục gốc dự án
python3 -m http.server 8080 --directory Frontend
```

- Mở trình duyệt và truy cập:
  - **Trang chủ bán hàng**: `http://localhost:8080/`
  - **Trang quản trị sản phẩm**: `http://localhost:8080/admin/`

---

## 4. Triển Khai Lên Vercel (Deployment)

Dự án đã có sẵn tệp cấu hình `vercel.json`:
```json
{
  "outputDirectory": "Frontend"
}
```

Khi đẩy mã nguồn lên GitHub (hoặc liên kết Vercel với repository):
1. Vercel tự động nhận diện thư mục `Frontend` làm thư mục gốc xuất bản.
2. Domain của bạn sẽ phục vụ:
   - Trang bán lẻ: `https://ten-mien-cua-ban.vercel.app/`
   - Trang quản trị: `https://ten-mien-cua-ban.vercel.app/admin/`
3. Không cần cài đặt bước build phức tạp vì toàn bộ dự án sử dụng Vanilla JS ES Modules tiêu chuẩn và Supabase CDN được ghim phiên bản cố định `@supabase/supabase-js@2.45.4`.

---

## 5. Danh Sách Kiểm Thử Thủ Công (Manual Test Checklist)

Bạn có thể đối chiếu các tình huống thực tế sau đây để đảm bảo hệ thống vận hành hoàn hảo:

| STT | Kịch bản kiểm thử | Thao tác thực hiện | Kết quả mong đợi |
|-----|-------------------|-------------------|-------------------|
| 1 | **Đăng nhập Admin** | Mở `/admin/`, nhập email/mật khẩu vừa tạo trên Supabase | Đăng nhập thành công, chuyển vào giao diện danh sách thẻ sản phẩm, hiển thị email admin trên topbar. |
| 2 | **Thêm sản phẩm mới kèm chụp ảnh từ điện thoại** | Nhấn `+ Thêm sản phẩm`, nhập tên "iPhone 15 Pro", bấm chụp/chọn ảnh từ camera | Ảnh được nén tự động (<1200px, ~80% quality), tải lên bucket `product-images`, thẻ mới xuất hiện trong danh sách. |
| 3 | **Chỉnh sửa giá nhanh (Quick Inline Edit)** | Chạm vào giá của một sản phẩm bất kỳ, đổi số tiền (ví dụ 28.000.000) và nhấn Enter | Giá cập nhật tức thì, hiển thị thông báo "Đã lưu", dữ liệu trên Supabase được ghi nhận. |
| 4 | **Ẩn / Hiện sản phẩm** | Nhấn nút trạng thái "Đang hiện" trên thẻ | Nút đổi thành "Đang ẩn", độ mờ thẻ giảm xuống, sản phẩm không còn hiển thị ở trang chủ công khai `/`. |
| 5 | **Điều chỉnh tồn kho** | Bấm nút `+` hoặc `-` trong bộ đếm tồn kho | Con số tồn kho tăng/giảm mượt mà, tự động khóa nút `-` khi tồn kho về 0. |
| 6 | **Giảm giá hàng loạt (%)** | Tích chọn 2-3 sản phẩm, trên thanh thao tác chọn "Giảm giá %", nhập 10% | Cả 3 sản phẩm được tính giá mới giảm 10% (làm tròn hàng chục nghìn), giá cũ được lưu vào mục giá gốc gạch ngang. |
| 7 | **Xóa sản phẩm** | Nhấn nút "Xóa", xác nhận hộp thoại ghi rõ tên sản phẩm | Sản phẩm bị xóa khỏi danh sách và file ảnh tương ứng trong bucket `product-images` tự động được dọn dẹp. |
| 8 | **Trang chủ tự cập nhật** | Mở lại trang chủ `/` | Các thay đổi về giá, ảnh và sản phẩm mới hiển thị ngay lập tức; hiệu ứng nước và 3D hero vẫn hoạt động mượt mà. |
| 9 | **Dự phòng khi mất mạng / chưa điền key** | Giả lập mất mạng hoặc để placeholder `YOUR_SUPABASE_URL` | Trang chủ `/` tự động chuyển sang đọc `data/products.json`, hiển thị đầy đủ danh mục không bị lỗi giao diện. |


---

## Phân quyền quản trị viên (bảng `admin_users`)

Mặc định `schema.sql` cho **mọi tài khoản đã đăng nhập** quyền sửa sản phẩm. Để chỉ những người được chỉ định mới sửa được, chạy thêm `supabase/admin_users.sql`.

1. Vào **SQL Editor** -> **New query**, dán toàn bộ `supabase/admin_users.sql` rồi **Run** (chạy sau `schema.sql`, chạy lại nhiều lần vẫn an toàn).
2. Tạo user trong **Authentication -> Users** (tick *Auto Confirm User*) nếu chưa có.
3. Mở lại file SQL, ở mục **6. TẠO CHỦ SHOP ĐẦU TIÊN** đổi email, bỏ dấu `--` ở các dòng `insert ...`, rồi chạy để cấp quyền `owner`.
4. Đăng nhập `/admin/`. Tài khoản không có trong bảng sẽ bị đăng xuất kèm thông báo "chưa được cấp quyền quản trị".

| Vai trò | Xem | Thêm, sửa, tải ảnh | Xóa sản phẩm/ảnh | Quản lý danh sách tài khoản |
|---|---|---|---|---|
| `owner` (chủ shop) | Có | Có | Có | Có |
| `admin` (quản trị) | Có | Có | Có | Không |
| `staff` (nhân viên) | Có | Có | **Không** | Không |

Nhân viên không thấy nút "Xóa" trên trang quản trị, và nếu cố gọi trực tiếp thì Supabase từ chối vì policy xóa chỉ cho `owner`/`admin` (hàm `is_manager()`).

Thêm nhân viên: tạo user trong **Authentication -> Users**, rồi chạy
`insert into public.admin_users (user_id, email, display_name, role) select id, email, 'Tên NV', 'staff' from auth.users where email = '...';`

Khóa tạm một nhân viên: `update public.admin_users set is_active = false where email = '...';`

Lưu ý: kiểm tra trong trang `/admin/` chỉ để báo lỗi thân thiện. Việc chặn thật nằm ở quy tắc bảo mật (RLS) trên Supabase.

---

## Đơn hàng và lịch sửa chữa (`orders.sql`)

Trước đây nút đặt hàng chỉ hiện thông báo, shop không nhận được đơn. Giờ đơn và lịch hẹn được lưu vào Supabase.

1. Chạy theo thứ tự: `schema.sql` -> `admin_users.sql` -> **`orders.sql`** (SQL Editor, dán, Run).
2. Khách đặt hàng trên website: hệ thống gọi hàm `create_order()`, **tự tính lại giá và kiểm tra tồn kho từ bảng `products`**, nên khách không sửa giá được từ trình duyệt. Mỗi số điện thoại tối đa 5 yêu cầu mỗi giờ để chống spam.
3. Xem và xử lý tại `/admin/orders.html` (nút **Đơn hàng** trên trang sản phẩm): đổi trạng thái, ghi chú nội bộ, gọi điện bằng một chạm, tự làm mới mỗi 60 giây.
4. Chỉ `owner` mới xóa được đơn. Khách không đọc được đơn của người khác.

Lưu ý:
- Tồn kho **không tự trừ** khi có đơn, chủ shop chỉnh số lượng ở trang sản phẩm. Hàm chỉ từ chối khi số lượng đặt lớn hơn tồn kho.
- Khi Supabase chưa cấu hình hoặc đang tạm dừng, website báo khách gọi hotline thay vì giả vờ đặt thành công.
- Chưa có thông báo tự động (Zalo, email) khi có đơn mới, hiện phải mở trang `/admin/orders.html`.


---

## Đăng nhập bằng tên tài khoản (không cần email thật)

Ô đăng nhập ở `/admin/` nhận **tên tài khoản** như `chushop` hoặc `nhanvien1`. Supabase Auth bắt buộc có email, nên trang tự ghép thành `ten@tienmobile.vn` (hằng số `LOGIN_EMAIL_DOMAIN` trong `adminHelpers.js`). Không có thư nào được gửi tới địa chỉ này.

Tạo một tài khoản:
1. **Authentication -> Users -> Add user -> Create new user**: Email = `nhanvien1@tienmobile.vn`, nhập mật khẩu, **tick Auto Confirm User**.
2. Cấp vai trò bằng SQL (đổi `staff` thành `admin` hoặc `owner` nếu cần):
   `insert into public.admin_users (user_id, email, display_name, role) select id, email, 'Nhân viên 1', 'staff' from auth.users where email = 'nhanvien1@tienmobile.vn';`
3. Nhân viên đăng nhập với tên `nhanvien1` và mật khẩu đã đặt.

Tên tài khoản gồm chữ thường, số, `.`, `_`, `-`, dài 3-30 ký tự. Vì không có email thật nên **không có chức năng quên mật khẩu**: chủ shop đặt lại mật khẩu trong **Authentication -> Users** (nút ba chấm, *Send password recovery* không dùng được, hãy chọn đặt mật khẩu mới).

## Bảo hành

- Chạy `supabase/warranty.sql` một lần trong SQL Editor (cần đã chạy `admin_users.sql` trước).
- Trang quản trị: `admin/warranty.html` (liên kết "Bảo hành" trên thanh điều hướng). Thêm/sửa phiếu gồm tên khách, số điện thoại, máy, nội dung sửa chữa, số tháng bảo hành (1–60), ngày bắt đầu. Hạn bảo hành tự tính.
- Nhân viên (staff) được thêm và sửa phiếu, chỉ quản lý (owner/admin) được xóa.
- Khách tra cứu tại mục **Bảo hành** trên website bằng số điện thoại. Hàm `lookup_warranty` chỉ trả thông tin cần thiết (tên khách được che, không trả ghi chú nội bộ), tối đa 20 phiếu và 10 lượt tra/giờ cho mỗi số.

## Thông báo Telegram (đơn hàng, lịch sửa chữa, thu cũ)

Mỗi khi khách đặt hàng, đặt lịch sửa hoặc gửi yêu cầu báo giá thu cũ, bot Telegram tự gửi tin (mã, tên, số điện thoại, nội dung, mô tả) vào nhóm hoặc tài khoản chính của chủ shop.

SQL đã chạy: `supabase/telegram.sql` (tạo trigger, bảng `notify_settings`). Bước còn lại là cấu hình bot, làm một lần:

1. Trên Telegram mở **@BotFather**, gửi `/newbot`, đặt tên, nhận **token** (dạng `123456:ABC...`). Token là mật khẩu của bot, không gửi cho ai và không đưa vào code hay GitHub.
2. Muốn nhận trong nhóm: tạo nhóm, thêm bot vào nhóm, gửi một tin bất kỳ trong nhóm. Muốn nhận cá nhân: mở bot và bấm Start.
3. Lấy **chat id**: mở `https://api.telegram.org/bot<TOKEN>/getUpdates` trên trình duyệt, tìm `"chat":{"id":...}`. Id của nhóm thường bắt đầu bằng dấu `-`.
4. Vào Supabase → SQL Editor, chạy (thay giá trị thật):
   ```sql
   insert into public.notify_settings (key, value) values
     ('telegram_bot_token', 'TOKEN_CUA_BAN'),
     ('telegram_chat_id',   'CHAT_ID_CUA_BAN')
   on conflict (key) do update set value = excluded.value;
   select public.notify_telegram('Thử thông báo Tien Mobile');
   ```
5. Bot phải gửi được tin thử. Từ đó mỗi đơn mới sẽ tự báo. Muốn đổi nhóm hoặc bot, chạy lại câu `insert` với giá trị mới.

Lưu ý: nếu Telegram lỗi hoặc chưa cấu hình, đơn của khách vẫn được lưu bình thường. Bảng `notify_settings` không đọc được từ trình duyệt.

## Dung lượng và dọn dữ liệu tạm

- Mỗi đơn, lịch hẹn hoặc phiếu bảo hành chỉ chiếm khoảng 1 KB, nên gói miễn phí 500 MB của Supabase đủ chứa hàng trăm nghìn dòng. Không cần xóa đơn hàng để tiết kiệm chỗ; đây là dữ liệu kinh doanh.
- Tin Telegram không lưu gì thêm trong cơ sở dữ liệu. Chỉ có hai loại dữ liệu tạm: nhật ký giới hạn số lần tra cứu bảo hành (`warranty_lookups`) và phản hồi của Telegram (`net._http_response`).
- `supabase/cleanup.sql` đã lên lịch tự dọn hai loại này mỗi ngày lúc 03:00 UTC (10:00 giờ Việt Nam). Nhóm Telegram nên bật tự xóa tin sau 1 tháng để gọn.
- Nên xuất đơn hàng cũ (hơn 1-2 năm) ra file rồi lưu riêng nếu muốn nhẹ bảng, nhưng không bắt buộc.

## Đổi token bot Telegram

Khi cần đổi token (bị lộ hoặc thu hồi): trong BotFather gửi `/revoke`, chọn bot, copy token mới, rồi chạy trong SQL Editor:
`update public.notify_settings set value = 'TOKEN_MOI' where key = 'telegram_bot_token';`
Token cũ hết hiệu lực ngay, thông báo sẽ không gửi cho đến khi cập nhật token mới.

## Bot Telegram quản lý bằng nút bấm

Gõ `/menu` (hoặc `/start`) trong nhóm tienmobiletd để mở menu với các nút:
- **Đơn hàng**: danh sách đơn đang xử lý, bấm một đơn để xem chi tiết và đổi trạng thái (Xác nhận, Đang giao, Hoàn tất, Hủy).
- **Lịch sửa** và **Thu cũ**: tương tự, trạng thái Xác nhận, Đang sửa, Hoàn tất, Hủy.
- **Bảo hành**: số phiếu còn hạn và hết hạn, phiếu sắp hết hạn trong 30 ngày, phiếu mới nhất.
- **Hôm nay**: số đơn, doanh thu (không tính đơn hủy), lịch sửa, thu cũ, phiếu bảo hành mới.
- **Tra SĐT**: gõ `/tim 0912345678`, hoặc bấm nút rồi trả lời tin bot hỏi, để xem đơn, lịch và phiếu bảo hành của khách.
- **Thêm phiếu BH**: bấm nút (hoặc `/themphieu`) rồi trả lời một tin theo mẫu `Tên; SĐT; Máy; Nội dung sửa; Số tháng` (bỏ trống số tháng thì mặc định 3). Phiếu được lưu và bot báo vào nhóm như khi tạo trên web.
- **Trợ giúp**: `/help`. Nút ⬅ Menu có ở mọi màn hình để quay lại.

`/start` hiện bàn phím nút bấm cố định dưới ô chat (Menu, Đơn hàng, Lịch sửa, Thu cũ, Bảo hành, Hôm nay, Tra SĐT, Thêm phiếu BH, Trợ giúp). Lệnh tắt: `/donhang`, `/lichsua`, `/thucu`, `/baohanh`, `/homnay`, `/huy` (hủy thao tác đang nhập). Bot cần là quản trị viên của nhóm để nhận tin nhắn thường từ bàn phím.
Bot không có lệnh xóa. Chỉ nhóm có chat id đã cấu hình được dùng bot.

SQL: `supabase/telegram_bot.sql`. Kích hoạt một lần: `select public.telegram_setup('https://<project>.supabase.co/rest/v1/rpc/telegram_webhook?apikey=<khóa công khai>');`. Telegram gọi webhook kèm mã bí mật (lưu trong `notify_settings`), không có mã đúng thì bị từ chối.

**Chia thông báo theo chủ đề (Topics):** nhóm có 4 chủ đề: 🛒 Đơn hàng, 🔧 Lịch sửa chữa, ♻️ Thu cũ, 🛡️ Bảo hành. Thông báo tự vào đúng chủ đề (lịch có dịch vụ "Thu cũ" vào ♻️ Thu cũ). Bot trả lời ngay trong chủ đề mà bạn gõ lệnh; chủ đề General dùng cho `/start`, `/menu`. Thiết lập một lần bằng `supabase/telegram_topics.sql`: chạy `select public.telegram_make_topics();`, vài giây sau chạy `select public.telegram_save_topics();`. Id chủ đề lưu ở `notify_settings` (khóa `telegram_topic_order`, `_booking`, `_tradein`, `_warranty`); chưa có thì thông báo vào General. Bot cần là quản trị viên có quyền quản lý chủ đề.

**Lưu ý chat id:** nếu bật Chủ đề (Topics) hoặc nâng nhóm lên supergroup, chat id đổi (dạng `-100...`). Cập nhật bằng: `update public.notify_settings set value = 'CHAT_ID_MOI' where key = 'telegram_chat_id';`. Bot trả lời mọi lệnh ở chủ đề General.
