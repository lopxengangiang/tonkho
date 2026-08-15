# Tồn kho — Tra cứu & chỉnh sửa giá

Trang tra cứu giá bán / giá nhập cho cửa hàng, chạy trên **Cloudflare Pages + Functions + KV**.

Giá trị cốt lõi, và chỉ có vậy:

1. **Tra giá nhanh** — tìm theo tên/mã (không dấu cũng khớp), tối ưu điện thoại.
2. **Sửa giá là mọi người thấy ngay** — bấm *Sửa* → nhập giá mới → *Lưu*. Giá ghi vào Cloudflare KV, mọi máy đều thấy bản mới nhất. Không còn localStorage riêng từng máy, không còn xuất JSON / commit thủ công.
3. **Mật khẩu nằm trên server** — client không còn chứa mật khẩu hay dữ liệu giá; chưa đăng nhập thì API không trả gì.

## Kiến trúc

Cloudflare **Worker** `tonkho` (workers.dev / custom domain) — static assets + API + KV:

```
public/index.html ──► POST /api/login {password}  ──► token (HMAC, hạn 7 ngày)
                  ──► GET  /api/data  (Bearer)    ──► KV "inventory" (fallback: seed)
                  ──► PUT  /api/data  (Bearer)    ──► ghi KV → đồng bộ mọi người
```

- `src/worker.js` — toàn bộ API (login + đọc/ghi dữ liệu). Request khớp file trong `public/` được Cloudflare serve thẳng, còn lại rơi vào Worker.
- `src/seed.js` — dữ liệu khởi tạo, chỉ dùng khi KV còn trống (lần deploy đầu). Sau đó dữ liệu sống trong KV.
- `wrangler.jsonc` — cấu hình deploy: assets `./public`, KV binding `TONKHO`. Binding do file này quản lý — đừng gắn tay trên dashboard (deploy sau sẽ ghi đè).
- Chống dò mật khẩu: sai 3 lần → khóa IP 60 giây (đếm trong KV, phía server).

## Deploy

Worker nối GitHub repo này (Workers Builds) — push lên `main` là tự build + deploy bằng `npx wrangler deploy` (đọc `wrangler.jsonc`).

Cần cấu hình một lần trên dashboard:

1. **KV**: Storage & Databases → KV → Create namespace, dán ID vào `kv_namespaces[0].id` trong `wrangler.jsonc`.
2. **Mật khẩu**: Worker → Settings → Variables and Secrets → Add → **Type = Secret**, Name = `PASSWORD`.
3. Custom domain (tùy chọn): Worker → Settings → Domains & Routes → thêm `tonkho.ngangiang.net` (nhớ tắt GitHub Pages của repo nếu trước đó đang dùng).

Đổi mật khẩu = sửa secret `PASSWORD` (token cũ tự hết hiệu lực vì token ký bằng khóa dẫn xuất từ mật khẩu).

## Cập nhật hàng loạt từ Excel

Dữ liệu vận hành nằm trong KV, key `inventory`, dạng:

```json
{ "updated": "2026-08-15", "items": [ { "ma": "...", "ten": "...", "dvt": "...", "nhap": 0, "ban": 0 } ] }
```

Muốn nạp lại toàn bộ từ Excel: sinh JSON theo format trên rồi hoặc (a) ghi đè key `inventory` trong KV (dashboard/wrangler), hoặc (b) cập nhật `src/seed.js` và xóa key `inventory` để seed nạp lại.

## Bảo mật

Mật khẩu so khớp trên server (Pages Function), dữ liệu chỉ trả sau khi đăng nhập — hơn hẳn bản cũ (mật khẩu + toàn bộ giá nhập nằm trong file tĩnh public). Vẫn là mô hình 1 mật khẩu dùng chung cho nhóm nhỏ; muốn chặt hơn nữa thì bật **Cloudflare Access** (Zero Trust) trước site.

## Nhập giá từ Excel (TCVN3)

```bash
TONKHO_PASSWORD='...' python3 tools/import_xlsx.py Book1.xlsx            # xem trước
TONKHO_PASSWORD='...' python3 tools/import_xlsx.py Book1.xlsx --execute  # ghi thật
```

Tool tự convert bảng mã TCVN3, khớp mã bị Excel cắt số 0 đầu (kèm đối chiếu tên), giữ nguyên mặt hàng không có trong file, không ghi đè giá về 0.
