# CI/CD — Auto-deploy lên production

Mỗi khi merge vào `main`, GitHub Actions sẽ tự SSH vào server, `git pull`, rebuild Docker image, restart container và health check.

## Setup 1 lần (làm một lần khi enable lần đầu)

### Bước 1 — Tạo SSH key dành riêng cho CI

Trên **máy local** của bạn:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/therighthome_deploy -N ""
```

Lệnh sinh ra 2 file:
- `~/.ssh/therighthome_deploy` — **PRIVATE key** → cho GitHub
- `~/.ssh/therighthome_deploy.pub` — **PUBLIC key** → cho server

### Bước 2 — Cài public key lên server

Cách nhanh nhất, dùng `ssh-copy-id`:

```bash
ssh-copy-id -i ~/.ssh/therighthome_deploy.pub vmadmin@103.140.249.232
```

(Nó sẽ hỏi password vmadmin một lần cuối, sau đó key được append vào `~/.ssh/authorized_keys` trên server.)

Verify đã add được:
```bash
ssh -i ~/.ssh/therighthome_deploy vmadmin@103.140.249.232 "whoami"
# Phải in: vmadmin (không hỏi password)
```

### Bước 3 — Add secrets vào GitHub repo

Vào https://github.com/ngalinh/therighthome/settings/secrets/actions → **New repository secret** và add 3 (hoặc 4) secret sau:

| Tên | Giá trị |
|---|---|
| `SSH_PRIVATE_KEY` | Toàn bộ nội dung file `~/.ssh/therighthome_deploy` (kể cả dòng `-----BEGIN ... PRIVATE KEY-----` và `-----END ... PRIVATE KEY-----`) |
| `SSH_HOST` | `103.140.249.232` |
| `SSH_USER` | `vmadmin` |
| `DEPLOY_PATH` | `/home/vmadmin/therighthome` (optional — default đã đúng) |
| `APP_PORT` | `3002` (optional — default đã đúng) |

Để copy private key vào clipboard:
```bash
# macOS
cat ~/.ssh/therighthome_deploy | pbcopy
# Linux (cần xclip)
cat ~/.ssh/therighthome_deploy | xclip -selection clipboard
```

### Bước 4 — Test deploy thủ công

Vào tab **Actions** trên GitHub:
1. Chọn workflow **"Deploy to production"**
2. Click **"Run workflow"** → chọn branch `main` → **Run workflow**

Nếu OK sẽ thấy 2 step `Pull, build, deploy` và `Health check` đều xanh. Mở `https://admin.therighthome.vn/login` verify còn chạy.

## Sau khi setup xong — workflow tự động

```
git push main → CI chạy → CI pass → Deploy chạy → SSH vào server → git pull + build + restart → health check
```

Mỗi PR merge vào `main` sẽ trigger deploy. Nếu CI fail thì deploy không chạy.

## Manual redeploy

Bất kỳ lúc nào muốn force redeploy (ví dụ vừa sửa `.env` trên server và muốn restart):

- **Cách 1** (qua web): tab Actions → Deploy → Run workflow
- **Cách 2** (qua CLI nếu cài `gh`):
  ```bash
  gh workflow run deploy.yml -R ngalinh/therighthome
  ```

## Rollback nếu deploy hỏng

Trên server:

```bash
cd ~/therighthome
git log --oneline -10        # xem commit cũ
git reset --hard <commit-sha-cũ>
docker compose build app worker
docker compose up -d app worker
```

Hoặc revert PR trên GitHub → Deploy tự chạy lại với code cũ.

## Bảo mật & lưu ý

- SSH key `therighthome_deploy` trên máy local **không được commit lên git**. Nếu lộ → tạo key mới + remove dòng cũ trong `~/.ssh/authorized_keys` trên server + update `SSH_PRIVATE_KEY` secret.
- GitHub Secrets được mã hoá at-rest, chỉ truy cập được bởi workflow của repo đó. Không ai (kể cả admin) đọc được sau khi save.
- Có thể siết thêm: trong `~/.ssh/authorized_keys` trên server, prefix key bằng `command="cd ~/therighthome && /usr/bin/git fetch && /usr/bin/git reset --hard origin/main && docker compose build app worker && docker compose up -d app worker"` để key chỉ chạy được lệnh đó. (Không bắt buộc, làm khi cần hardening.)
- Concurrency group `production` đảm bảo 2 deploy không chạy song song (tránh race khi merge nhiều PR cùng lúc).

## Troubleshooting

**`Permission denied (publickey)`** → public key chưa được add vào server hoặc add nhầm. Verify lại với `ssh -i ~/.ssh/therighthome_deploy vmadmin@103.140.249.232 whoami`.

**`Host key verification failed`** → workflow đã handle (StrictHostKeyChecking=accept-new), nếu vẫn fail thì vào server kiểm tra IP đổi không.

**`docker compose: command not found`** → thiếu plugin compose v2 trên server. `sudo apt install -y docker-compose-plugin`.

**Health check fail** → app build OK nhưng không response trên :3002. Check `docker compose logs app --tail 100` để debug. Workflow đã in 50 dòng cuối cho bạn.
