# Tồn kho — Tra cứu & chỉnh sửa giá

Trang tĩnh tra cứu giá bán / giá nhập. Mật khẩu đơn giản + khóa 1 phút sau 3 lần sai. Chỉnh sửa giá lưu trên trình duyệt (localStorage) và có nút xuất JSON để sao lưu/đồng bộ.

## Cấu hình

Mở [index.html](index.html), phần `CONFIG`:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PASSWORD` | `ngangiang2810@` | Mật khẩu truy cập |
| `MAX_ATTEMPTS` | `3` | Số lần nhập sai tối đa |
| `LOCK_MS` | `60 * 1000` | Khóa 1 phút (ms) sau khi vượt quá |
| `SESSION_MS` | `15 * 60 * 1000` | Phiên đăng nhập 15 phút |

## Deploy GitHub + Cloudflare Pages

1. Push 2 file sau lên GitHub: `index.html`, `data.js`. README thì tùy.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build: **Framework = None**, **Build command = (trống)**, **Output = /**.
4. Deploy. Truy cập `https://<project>.pages.dev`.

Không cần env var, không cần KV, không cần Functions.

## Chỉnh sửa giá

Sau khi đăng nhập → bấm **Sửa** → sửa giá → bấm **Lưu** (lưu localStorage trên máy này) hoặc **Xuất JSON** (tải file `data.js` đã cập nhật — thay file cũ trong repo, commit & push để áp dụng cho mọi người).

Quy tắc:
- **Lưu**: thay đổi chỉ tồn tại trên trình duyệt hiện tại.
- **Xuất JSON**: tải `data.js` mới → commit vào repo → đồng bộ cho mọi máy.

## Cập nhật từ Excel mới

```bash
python gen_seed.py     # ghi đè data.js từ Excel
git add data.js && git commit -m "update prices" && git push
```

Sửa đường dẫn Excel trong biến `SOURCES` của [gen_seed.py](gen_seed.py).

## Ghi chú bảo mật

Đây là trang tĩnh public, **mật khẩu nằm trong mã nguồn client** — ai xem source là thấy. Cơ chế khóa 3-lần-1-phút chỉ chặn dò mật khẩu bằng UI. Đây là mức bảo mật "đủ dùng cho nhóm nhỏ" — không phải mã hóa thực sự.

Muốn bảo vệ nghiêm túc: bật **Cloudflare Access** cho Pages project (Zero Trust → Access → Applications → Add application → Self-hosted) để buộc đăng nhập bằng email OTP của Cloudflare trước khi site được phục vụ.
