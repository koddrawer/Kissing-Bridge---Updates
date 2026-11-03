# Kissing Bridge Live — Updates

Repo cập nhật nóng cho app **Kissing Bridge Live (Cầu Hôn Phú Quốc)**.

- `manifest.json` — version + sha1 từng file trong `app/`
- `app/` — giao diện, hình, âm thanh, logic màn live & bảng điều khiển

App tự kiểm tra repo này khi mở và mỗi 15 phút; tăng `version` trong `manifest.json` (chạy `node tools/make-manifest.js x.y.z` trong mã nguồn) để phát hành bản mới.
