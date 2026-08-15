# Tồn kho — Tra cứu & chỉnh sửa giá

Trang tra cứu giá bán / giá nhập cho cửa hàng, chạy trên **Cloudflare Pages + Functions + KV**.

Giá trị cốt lõi, và chỉ có vậy:

1. **Tra giá nhanh** — tìm theo tên/mã (không dấu cũng khớp), tối ưu điện thoại.
2. **Sửa giá là mọi người thấy ngay** — bấm *Sửa* → nhập giá mới → *Lưu*. Giá ghi vào Cloudflare KV, mọi máy đều thấy bản mới nhất. Không còn localStorage riêng từng máy, không còn xuất JSON / commit thủ công.
3. **Mật khẩu nằm trên server** — client không còn chứa mật khẩu hay dữ liệu giá; chưa đăng nhập thì API không trả gì.

## Kiến trúc

```
index.html  ──► POST /api/login {password}  ──► token (HMAC, hạn 7 ngày)
            ──► GET  /api/data  (Bearer)    ──► KV "inventory" (fallback: seed)
            ──► PUT  /api/data  (Bearer)    ──► ghi KV → đồng bộ mọi người
```

- `functions/api/[[path]].js` — toàn bộ API (login + đọc/ghi dữ liệu).
- `functions/api/_seed.js` — dữ liệu khởi tạo, chỉ dùng khi KV còn trống (lần deploy đầu). Sau đó dữ liệu sống trong KV.
- Chống dò mật khẩu: sai 3 lần → khóa IP 60 giây (đếm trong KV, phía server).

## Deploy (Cloudflare Pages)

1. Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → chọn repo này.
   Framework = None, build command trống, output = `/`.
2. **KV**: Workers & Pages → KV → Create namespace (vd `tonkho`).
   Pages project → Settings → **Bindings** → thêm KV binding, **tên biến = `TONKHO`**.
3. **Mật khẩu**: Pages project → Settings → **Environment variables** → thêm secret **`PASSWORD`** (Production).
4. Redeploy. Truy cập `https://<project>.pages.dev` hoặc gắn custom domain `tonkho.ngangiang.net`
   (Pages → Custom domains — nhớ **tắt GitHub Pages** của repo nếu trước đó đang dùng, vì site này cần Functions, GitHub Pages không chạy được API).

Đổi mật khẩu = sửa secret `PASSWORD` rồi redeploy (token cũ tự hết hiệu lực vì token ký bằng khóa dẫn xuất từ mật khẩu).

## Cập nhật hàng loạt từ Excel

Dữ liệu vận hành nằm trong KV, key `inventory`, dạng:

```json
{ "updated": "2026-08-15", "items": [ { "ma": "...", "ten": "...", "dvt": "...", "nhap": 0, "ban": 0 } ] }
```

Muốn nạp lại toàn bộ từ Excel: sinh JSON theo format trên rồi hoặc (a) ghi đè key `inventory` trong KV (dashboard/wrangler), hoặc (b) cập nhật `functions/api/_seed.js` và xóa key `inventory` để seed nạp lại.

## Bảo mật

Mật khẩu so khớp trên server (Pages Function), dữ liệu chỉ trả sau khi đăng nhập — hơn hẳn bản cũ (mật khẩu + toàn bộ giá nhập nằm trong file tĩnh public). Vẫn là mô hình 1 mật khẩu dùng chung cho nhóm nhỏ; muốn chặt hơn nữa thì bật **Cloudflare Access** (Zero Trust) trước site.
