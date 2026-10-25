# Hướng Dẫn Quản Trị & Cấu Hình Supabase Cho Tien Mobile Thu Duc

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
- **Trả góp**: nút **💳 Trả góp** (hoặc `/tragop`) liệt kê hồ sơ đang góp; bấm một hồ sơ để xem chi tiết và bấm **✅ +1 kỳ đã đóng** khi khách đóng tiền. **Tra SĐT** cũng hiện hồ sơ trả góp của khách.
- **Thêm phiếu BH**: bấm nút (hoặc `/themphieu`) rồi trả lời một tin theo mẫu `Tên; SĐT; Máy; Nội dung sửa; Số tháng` (bỏ trống số tháng thì mặc định 3). Phiếu được lưu và bot báo vào nhóm như khi tạo trên web.
- **Trợ giúp**: `/help`. Nút ⬅ Menu có ở mọi màn hình để quay lại.

`/start` hiện bàn phím nút bấm cố định dưới ô chat (Menu, Đơn hàng, Lịch sửa, Thu cũ, Bảo hành, Hôm nay, Tra SĐT, Thêm phiếu BH, Trợ giúp). Lệnh tắt: `/donhang`, `/lichsua`, `/thucu`, `/baohanh`, `/homnay`, `/huy` (hủy thao tác đang nhập). Bot cần là quản trị viên của nhóm để nhận tin nhắn thường từ bàn phím.
Bot không có lệnh xóa. Chỉ nhóm có chat id đã cấu hình được dùng bot.

SQL: `supabase/telegram_bot.sql`. Kích hoạt một lần: `select public.telegram_setup('https://<project>.supabase.co/rest/v1/rpc/telegram_webhook?apikey=<khóa công khai>');`. Telegram gọi webhook kèm mã bí mật (lưu trong `notify_settings`), không có mã đúng thì bị từ chối.

**Chia thông báo theo chủ đề (Topics):** nhóm có 4 chủ đề: 🛒 Đơn hàng, 🔧 Lịch sửa chữa, ♻️ Thu cũ, 🛡️ Bảo hành. Thông báo tự vào đúng chủ đề (lịch có dịch vụ "Thu cũ" vào ♻️ Thu cũ). Bot trả lời ngay trong chủ đề mà bạn gõ lệnh; chủ đề General dùng cho `/start`, `/menu`. Thiết lập một lần bằng `supabase/telegram_topics.sql`: chạy `select public.telegram_make_topics();`, vài giây sau chạy `select public.telegram_save_topics();`. Id chủ đề lưu ở `notify_settings` (khóa `telegram_topic_order`, `_booking`, `_tradein`, `_warranty`); chưa có thì thông báo vào General. Bot cần là quản trị viên có quyền quản lý chủ đề.

**Lưu ý chat id:** nếu bật Chủ đề (Topics) hoặc nâng nhóm lên supergroup, chat id đổi (dạng `-100...`). Cập nhật bằng: `update public.notify_settings set value = 'CHAT_ID_MOI' where key = 'telegram_chat_id';`. Bot trả lời mọi lệnh ở chủ đề General.

## Trả góp

Hồ sơ trả góp do **cửa hàng tự nhập** ở trang quản trị, khách không tự đăng ký online.

- **Nhập hồ sơ:** `/admin/installments.html` (nút **Trả góp** trên thanh trên cùng) rồi **+ Thêm hồ sơ**. Điền tên, số điện thoại, máy, giá gốc, trả trước, **lãi suất (%/tháng, tự nhập)**, kỳ hạn (tháng), hình thức trả (Tiền mặt, Chuyển khoản, Quẹt thẻ, Công ty tài chính), ngày bắt đầu, giấy tờ đi kèm và ghi chú. Thanh đen **Thành tiền** hiện ngay khi nhập.
- **Công thức:** khoản vay = giá gốc - trả trước; tiền góp mỗi tháng = làm tròn lên nghìn của (khoản vay / số tháng + khoản vay x lãi% ); thành tiền = trả trước + tiền góp x số tháng. Cơ sở dữ liệu tính lại khi lưu nên số liệu luôn khớp.
- **Theo dõi:** nút **+1 kỳ đã đóng** mỗi lần khách đóng tiền; đóng đủ kỳ thì tự chuyển **Đã tất toán**. **Hủy hồ sơ**, **Sửa**, và chỉ quản lý mới **Xóa**.
- **Mã hóa đơn:** mỗi hồ sơ có mã `TG1001`, `TG1002`... (in trên hóa đơn).
- **Ngoài website** (menu **Trả góp**): phần **Tư vấn trả góp** (máy tính ước tính, giấy tờ thường cần, nút gọi/Zalo) và **Tra cứu hồ sơ trả góp**: khách nhập số điện thoại **và mã hóa đơn** để xem tiến độ (tên được che). Tối đa 10 lần tra mỗi số mỗi giờ. Lãi suất điền sẵn ở máy tính tư vấn: sửa `INSTALLMENT_REFERENCE_RATE` trong `Frontend/js/installment.js`.
- **Thông báo:** hồ sơ mới vào chủ đề 💳 **Trả góp** của nhóm Telegram.
- **Cài đặt:** chạy `supabase/telegram_topics.sql`, `supabase/installment.sql`, rồi `select public.telegram_make_topics();` và vài giây sau `select public.telegram_save_topics();`. Bảng cũ `installment_requests` (khách tự đăng ký) không còn dùng; xóa khi không cần: `drop table public.installment_requests;`.

## In hóa đơn

Mỗi mục có nút in: **Đơn hàng** (hóa đơn bán hàng), **Lịch sửa chữa** (phiếu tiếp nhận), **Bảo hành** (phiếu bảo hành), **Trả góp** (hóa đơn trả góp). Bấm **In hóa đơn** hoặc **In phiếu** trên thẻ, trang `/admin/print.html` mở ra . Trước khi in có thể bấm thẳng vào chữ trên phiếu để sửa (nút "Chỉnh sửa" bật/tắt); chỉnh sửa chỉ áp dụng cho bản in, không lưu vào dữ liệu.
- Mặc định khổ **80mm** cho máy in hóa đơn nhiệt; nút **Giấy A5** chuyển sang khổ A5. Trong hộp thoại in chọn đúng máy in, lề **Không (None)**, tỷ lệ 100%.
- Cần đăng nhập quản trị trong cùng trình duyệt. Thêm `&auto=0` vào đường dẫn nếu chỉ muốn xem trước, không tự bật hộp thoại in.
- Phiếu sửa chữa có dòng "Chi phí" để điền tay. Thông tin cửa hàng trên đầu hóa đơn sửa trong `SHOP` ở `Frontend/admin/invoiceHelpers.js`.

### Hợp đồng mua bán

Thẻ **Đơn hàng** và **Trả góp** có nút **In hợp đồng** (khổ A4, `print.html?type=order|installment&doc=contract&id=...`). Hợp đồng tự điền tên, số điện thoại, hàng hóa, giá, và với trả góp là trả trước, lãi %/tháng, kỳ hạn, tiền góp mỗi tháng, thành tiền. Các chỗ chấm `....` (địa chỉ cửa hàng, người đại diện, CCCD khách, số tháng bảo hành, mức xử lý chậm thanh toán) điền tay sau khi in.

Đây là mẫu tham khảo, không phải tư vấn pháp lý. Nên nhờ người am hiểu luật xem lại điều khoản trước khi dùng cho giao dịch lớn.

## Thu chi

Chạy `supabase/cashflow.sql` trong Supabase (một lần). Trang `/admin/cashflow.html` (nút **Thu chi** trên thanh điều hướng) có:
- **+ Thu / + Chi**: ghi khoản có số tiền, ngày, nhóm, ghi chú.
- **Thống kê theo tháng**: tổng thu, tổng chi, lợi nhuận (thu - chi), thu và chi theo nhóm; nút **In bảng thống kê**.
- Ở trang in hóa đơn có nút **Ghi vào sổ thu**: ghi tổng tiền của phiếu vào sổ thu (mỗi mã phiếu chỉ ghi một lần, có thể sửa số tiền trước khi ghi).
- Chỉ chủ shop (owner) được xóa khoản thu chi.

## Đồng bộ sản phẩm và giá từ Google Sheet

Trang **Sản phẩm** có hai nút. Cả hai đọc tab `TONG_HOP` của Google Sheet (sheet phải chia sẻ "bất kỳ ai có đường liên kết"), hiện bảng xem trước có các tab **Tất cả · Apple · Samsung · Xiaomi · OPPO · Vivo · Realme** (theo cột Hãng), tick rồi mới áp dụng. Bảng xem trước ghi rõ "Bảng giá cập nhật ngày ..." theo dòng ngày trong sheet.

- **Thêm SP mới từ Sheet**: rà sheet, **bỏ máy đã có** (so theo tên máy + dung lượng) và chỉ thêm máy mới, hàng mới 100%. Giá, giá gạch ngang, tồn kho lấy từ sheet; ảnh, màu, chip, camera để trống để bạn bổ sung sau. Mặc định tạo **ẩn**; thêm ảnh ở trang sửa sản phẩm rồi bật hiển thị (hoặc tick "Hiện ngay trên web"). Khi chưa có ảnh web hiện ảnh tạm.
- **Cập nhật giá từ Sheet**: đổi giá cho **điện thoại hàng mới đã có trên web**. Giá bán = "Giá Sau Sale", giá gạch ngang = "Giá Bán" (khi có sale). Hàng Like New, hàng cũ, phụ kiện không bị đổi. Giá lệch hơn 30% tô vàng và không tự tick.
- Tên sản phẩm tạo ra có dạng "<Mẫu> <Dung lượng>" (Samsung/OPPO... thêm tên hãng phía trước nếu mẫu chưa có). Mỗi dung lượng là một sản phẩm riêng.
- **Thêm máy cũ từ Sheet**: đọc tab `2ND`, mỗi dòng là một sản phẩm riêng (Like New, tồn kho theo sheet, thường là 1). Tab trong bảng xem trước theo dòng máy (iPhone 17, iPhone 16 ... iPad, Apple Watch). Máy đã có trên web (theo mã tạo từ mẫu + dung lượng + mô tả) và máy hết hàng bị bỏ qua. Giá gốc trong sheet không được đọc. Đồng hồ và iPad vào mục phụ kiện. Lưu ý: nếu sửa mô tả của một máy trong sheet, web coi là máy mới; máy đã bán nhớ ẩn hoặc xóa trên web.

### Ảnh minh họa theo mẫu máy

- Bảng ảnh nằm ở `Frontend/admin/modelImages.js` (khóa = tên mẫu, giá trị = ảnh sản phẩm chính thức trên CDN của hãng). Ưu tiên ảnh trang hãng (Apple, Samsung S24, Xiaomi, OPPO A79); mẫu hãng không có ảnh tiện dùng thì lấy ảnh đại lý thegioididong.com (Samsung A, OPPO Find X7 Ultra, Vivo, Realme 12/C67, iPhone 17/Air). Chưa có: Realme GT 6, OPPO Reno 12 Pro, iPhone 12 Pro/Pro Max, đồng hồ SE 3/6/4, iPad Pro 9.7 (giữ ảnh tạm "Đang cập nhật ảnh").
- Hai nút **Thêm SP mới từ Sheet** và **Thêm máy cũ từ Sheet** tự gắn ảnh nếu có mẫu khớp. Máy cũ có ảnh minh họa được thêm dòng "Ảnh minh họa, ảnh máy thật vui lòng liên hệ cửa hàng" vào mô tả.
- Nút **Gắn ảnh minh họa** gắn ảnh cho sản phẩm đã có trên web mà chưa có ảnh (chỉ những mẫu khớp trong bảng); xem trước ảnh rồi tick.
- Ảnh máy thật: thay ở trang sửa sản phẩm, sau đó ảnh minh họa không bị ghi đè (nút chỉ gắn cho sản phẩm chưa có ảnh).

### Xóa hàng loạt

Nút **Xóa hàng loạt** (trang Sản phẩm; nút "Xóa đã chọn" trên thanh chọn cũng mở bảng này):
- **Thẻ lọc dạng xổ xuống:** Hãng, Giá gốc, Tình trạng, Loại, Trạng thái (đang hiện, đang ẩn, hết hàng, chưa có ảnh), Nhãn. Chọn xong hiện thành thẻ có nút ✕ để bỏ; chọn được nhiều thẻ. Cùng nhóm là "hoặc", khác nhóm là "và" (ví dụ Apple + Đang ẩn). Có ô tìm theo tên.
- Danh sách chỉ hiện máy khớp thẻ. Tích **Chọn tất cả N sản phẩm đang hiện** hoặc tích từng máy, rồi bấm **Xóa N sản phẩm** (hỏi xác nhận lần cuối). Đổi thẻ lọc thì máy bị ẩn khỏi danh sách tự bỏ khỏi lựa chọn, nên không xóa nhầm máy không nhìn thấy.
- **Chỉ xóa sản phẩm, ảnh trong kho ảnh (product-images) được giữ lại** để dùng lại khi đăng hàng (cả khi xóa từng sản phẩm). Chỉ chủ shop và quản lý được xóa.

## Set giá (cộng thêm lên giá gốc)

Nút **Set giá** ở trang sản phẩm. Giá bán = **giá gốc (`base_price`) + cộng thêm**. Cần chạy `supabase/base_price.sql` một lần.

- Tích **hãng**, **khoảng giá gốc**, **tình trạng** để lọc (cùng nhóm là "hoặc", khác nhóm là "và"); có ô tìm theo tên.
- Tích máy trong bảng (hoặc "Chọn tất cả đang hiện"), nhập mức cộng thêm (đ hoặc %, số âm là giảm), chọn làm tròn lên, bấm **Áp vào máy đã chọn**. Lặp lại với nhóm khác (ví dụ Apple 20tr+ cộng 2tr, rồi iPhone dưới 3tr cộng 500k).
- Bấm sửa trực tiếp ô **Cộng thêm** hoặc **Giá bán** của từng máy. Dòng xanh là thay đổi chưa lưu; bấm **Lưu giá** mới ghi vào cơ sở dữ liệu.
- **Về giá gốc** đưa máy đã chọn về giá gốc. Luôn tính từ giá gốc nên không bị cộng dồn.
- Đồng bộ giá từ Sheet cập nhật **giá gốc** và giữ phần cộng thêm đã set. Sửa giá tay một sản phẩm không đổi giá gốc.
- Popup có 2 thẻ: **Set giá theo tích chọn** (như trên) và **Set giá hàng loạt (theo quy tắc)**: mỗi dòng quy tắc gồm hãng, giá gốc từ/đến, tên máy chứa, mức cộng thêm (đ hoặc %). Mỗi máy nhận một quy tắc, ưu tiên cụ thể nhất: tên máy > khoảng giá > hãng > chung; máy không khớp giữ nguyên. Bấm **Tính vào bảng** để xem kết quả (dòng xanh) rồi **Lưu giá**. Quy tắc được nhớ trên trình duyệt.
- Bộ lọc dạng danh sách xổ xuống (Hãng, Giá gốc, Tình trạng): chọn xong hiện thành thẻ có nút ✕ để bỏ, chọn được nhiều thẻ. Tiền tự thêm dấu chấm hàng nghìn. Cộng thêm có nút −/+ (±500.000đ hoặc ±1%), các mức gợi ý bấm nhanh và dòng xem trước giá của máy đầu tiên được chọn.
- **Liên kết với trang sản phẩm:** thẻ sản phẩm ngoài trang chỉ hiện giá bán cho khách (giá gốc và phần cộng thêm chỉ xem trong popup Set giá). Nút **Set giá** (đầu trang và trên thanh "Đã chọn") mở popup với các máy đang tích, thẻ hãng/loại/trạng thái và ô tìm kiếm của danh sách ngoài. Sửa giá nhanh, giảm giá % và form sản phẩm vẫn giữ/ghi giá gốc để Set giá tính đúng; sau khi lưu danh sách ngoài tự tải lại.

### Hiện / ẩn hàng loạt

Nút **Hiện / ẩn hàng loạt** (đầu trang sản phẩm): lọc bằng thẻ (hãng, giá gốc, tình trạng, trạng thái...), tích chọn tất cả hoặc từng máy rồi bấm **Hiện lên web** hoặc **Ẩn khỏi web**. Mỗi dòng ghi rõ đang hiện hay đang ẩn. Máy thêm từ Sheet mặc định ẩn, dùng nút này để đưa lên web sau khi đã có ảnh (ví dụ thẻ Trạng thái: Đang ẩn + Chưa có ảnh để kiểm tra trước).

Thanh nút nhanh phía trên danh sách sản phẩm: **Chọn tất cả** (tích mọi máy đang lọc), **Hiện tất cả** (hiện mọi máy đang ẩn, có hỏi xác nhận), **Hiện theo thẻ đã chọn** (mở popup hiện/ẩn với thẻ hãng/loại/trạng thái đang chọn ở danh sách, tích sẵn mọi máy khớp; đổi thẻ rồi bấm Hiện lên web).

Mọi hộp thoại xác nhận, thông báo và nhập số (xóa, đăng xuất, hiện tất cả, ghi sổ thu, đặt hàng/đặt lịch trên web...) dùng popup của trang (`Frontend/js/dialog.js`) thay cho hộp thoại mặc định của trình duyệt. Enter = đồng ý, Esc hoặc bấm ra ngoài = hủy.

Khi thêm máy từ Sheet (mới hoặc cũ) có ô tích **Chỉ thêm máy có ảnh**: máy chưa có ảnh được ẩn khỏi danh sách và không được thêm (ghi rõ số máy bị bỏ). Ô "Hiện ngay trên web" giữ nguyên lựa chọn khi đổi hãng hoặc đổi ô tích.

## Trang khách: giỏ hàng, chi tiết sản phẩm, nút Quay lại

- Giỏ hàng là **popup giữa màn hình** (có nút "Quay lại"/✕, Esc và bấm nền để đóng).
- Bấm vào sản phẩm mở **trang chi tiết riêng** `product.html?id=<mã>` (ảnh, giá, màu, dung lượng, thông số, mô tả, Đặt mua ngay / + Giỏ hàng). Nút **Quay lại** về đúng trang trước; mở trực tiếp thì về danh sách điện thoại. "Đặt mua ngay" mở trang chủ kèm popup giỏ hàng (`index.html?cart=1`).
- Các mục ở trang chủ (Điện thoại, Sửa chữa, Phụ kiện, Cam kết, Trả góp, Bảo hành) có nút **← Quay lại** ở đầu mục; chuyển mục được lưu vào lịch sử nên nút Quay lại của trình duyệt cũng về đúng mục trước.

### Trang khách: số lượng trên thẻ lọc và hiển thị

- Thẻ hãng (Tất cả, Apple, Samsung...) và thẻ phụ kiện được dựng **từ sản phẩm thật** đang hiện trên web, kèm số máy đúng theo tình trạng, khoảng giá và tìm kiếm đang chọn. Hãng không còn máy thì tự biến mất.
- Tên máy dài xuống 2 dòng thay vì bị cắt "…"; ảnh nền trắng hòa vào khung xám; nút Gọi/Zalo nhỏ lại trên điện thoại để không che nút "Giỏ hàng"; giỏ hàng và trang chi tiết đã chỉnh cho màn hình nhỏ (thanh nút mua cố định ở đáy).

## Phụ kiện từ Google Sheet (tab PHU_KIEN)

Nút **Phụ kiện từ Sheet** (đầu trang sản phẩm) đọc tab `PHU_KIEN` của Google Sheet, dòng 1 là tiêu đề:

| Cột | Nội dung |
| --- | --- |
| Mã SP | Tùy chọn. Có thì dùng làm mã (viết thường, gạch nối); trống thì web tự đặt mã `pk-<tên>` |
| Nhóm | Củ sạc & Cáp, Tai nghe, Ốp lưng & Cường lực (khác thì vào nhóm "Phụ kiện khác"). Quyết định thẻ lọc phụ kiện trên web |
| Hãng, Tên Phụ Kiện, Phân Loại / Màu | Tên hiển thị = Hãng + Tên - Phân loại. **Tên Phụ Kiện bắt buộc** |
| Giá Bán, Sale (%) | Giá niêm yết và phần trăm giảm (gõ `10%`). Cột Giá Sau Sale tự tính |
| Tồn Kho | Số lượng; Trạng Thái tự ghi Còn hàng / Hết hàng |
| Hiển Thị Web | Điền `Không` để bỏ qua dòng đó (trống = hiện) |
| Bảo Hành, Link Ảnh, Ghi Chú | Link ảnh http/https tùy chọn; Ghi chú và bảo hành vào mô tả |

Bấm nút sẽ liệt kê: **món chưa có** (thêm mới, mặc định ẩn, có ô "Hiện ngay" và "Chỉ thêm máy có ảnh") và **món đã có** (đổi giá nếu khác giá gốc; phần cộng thêm đã Set giá được giữ). Tích chọn rồi bấm Áp dụng.
