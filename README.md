# The Right Home

Phần mềm quản lý căn hộ dịch vụ (CHDV) và văn phòng (VP) cho thuê — PWA, mobile-first.

## Tính năng

### Đã có (Phase 1 → 4)
- **Auth multi-user** với phân quyền theo từng toà nhà (OWNER / MANAGER / ACCOUNTANT / VIEWER)
- **Toà nhà**: CRUD, sơ đồ phòng visual (trống / đang thuê / sắp hết hạn / bảo trì)
- **Phòng**: thêm hàng loạt, xoá nếu chưa có HĐ
- **Hợp đồng**: tạo HĐ cho CHDV (1-2 khách thuê) và VP (cá nhân hoặc công ty)
  - OCR CCCD bằng Gemini Vision (chỉnh sửa được trước khi lưu)
  - Sinh DOCX hợp đồng từ template upload
  - Upload ảnh/PDF hợp đồng đã ký
  - Khách thuê 2 tự động lên thành chính nếu xoá khách 1
- **Cài đặt toà**: đơn giá điện, phí xe, phí dịch vụ, mẫu HĐ DOCX, ngày tự động hoá đơn
- **PWA**: manifest, service worker, installable, offline shell, push notification subscription
- **Design**: gradient brand, line icons (lucide), mobile bottom-nav, glass cards
- **Hoá đơn**: tạo hàng loạt cho HĐ active, edit số điện đầu/cuối + chụp ảnh, tính lại tự động (điện/xe/OT/DV), gửi email với template đẹp qua Gmail SMTP, ghi nhận thanh toán → tự tạo phiếu thu, huỷ HĐ
- **Tài chính**: 5 tab — Giao dịch (phiếu thu/chi với phân loại/PTTT/đối tượng), Doanh thu theo khách, Công nợ theo đối tượng, Sổ quỹ theo PTTT (running balance), KQKD (chỉ tính tick "Hạch toán")
- **Số dư đầu kỳ**: nhập tay cho 3 loại (doanh thu khách / công nợ đối tượng / sổ quỹ PTTT) trong Cài đặt toà
- **Termination flow**: kết thúc HĐ với 3 lý do (hết hạn / dừng thuê / mất cọc). Mất cọc tự động hạch toán deposit vào doanh thu category "Tiền cọc mất". Tự free room.
- **Cron worker**: container `worker` chạy mỗi giờ — auto chuyển PENDING → OVERDUE, auto chuyển ACTIVE → EXPIRED khi hết hạn, auto-generate hoá đơn vào ngày cấu hình mỗi toà

### Sắp ra mắt
- Phase 5 — Cài đặt chung UI (user CRUD + phân quyền, đối tượng, loại thu chi, PTTT), audit log, web push, import Excel
- Phase 6 — Hardening, deploy, polish

## Stack

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui
- **Backend**: Next.js API routes + Prisma 5
- **DB**: PostgreSQL 16
- **Auth**: NextAuth v5 (credentials)
- **OCR**: Google Gemini 2.0 Flash
- **DOCX**: docxtemplater + pizzip
- **Email**: Nodemailer + Gmail SMTP
- **Backup**: pg_dump → Google Drive (service account)
- **Deploy**: Docker Compose + Nginx + Let's Encrypt

## Local development

```bash
# Khởi động Postgres bằng docker
docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16-alpine

# Cài deps & migrate
npm install
cp .env.example .env  # sửa DATABASE_URL về postgres://postgres:dev@localhost:5432/postgres
npx prisma db push
node prisma/seed.js   # tạo admin + 6 toà mặc định

npm run dev
# → http://localhost:3000  (login: admin@shipus.vn / ChangeMe123!)
```

## Deploy lên server (`chdv.shipus.vn` → `103.140.249.232`)

### Một lần ban đầu

1. **DNS**: trỏ `chdv.shipus.vn` (A record) về `103.140.249.232`
2. **SSH vào server**, đảm bảo có Docker + Docker Compose:
   ```bash
   ssh vmadmin@103.140.249.232
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
   sudo usermod -aG docker $USER && newgrp docker
   ```
3. **Clone repo**:
   ```bash
   git clone <repo-url> therighthome && cd therighthome
   git checkout claude/design-apartment-management-pwa-6KQqE
   ```
4. **Tạo `.env`** từ template:
   ```bash
   cp .env.example .env
   # Mở vim/nano và điền các giá trị (xem mục "Secrets cần điền" bên dưới)
   ```
5. **Chạy script deploy** (lấy SSL + start tất cả):
   ```bash
   bash scripts/deploy.sh
   ```
6. App sẽ chạy ở `https://chdv.shipus.vn`. Đăng nhập bằng admin được seed.

### Update code khi đã deploy

```bash
git pull
docker compose build app
docker compose up -d app
```

### Secrets cần điền vào `.env`

| Biến                          | Lấy ở đâu                                                              |
|-------------------------------|-------------------------------------------------------------------------|
| `POSTGRES_PASSWORD`           | Tự sinh chuỗi 32 ký tự ngẫu nhiên                                       |
| `NEXTAUTH_SECRET`             | `openssl rand -base64 32`                                               |
| `GEMINI_API_KEY`              | https://aistudio.google.com/apikey (tạo key MỚI, key cũ cần revoke)     |
| `SMTP_USER`                   | Gmail dùng để gửi hoá đơn                                               |
| `SMTP_PASSWORD`               | App Password (16 ký tự) — https://myaccount.google.com/apppasswords    |
| `VAPID_PUBLIC_KEY`/`PRIVATE`  | `npx web-push generate-vapid-keys`                                      |
| `GOOGLE_DRIVE_BACKUP_FOLDER_ID` | Tạo folder Drive, share với email service account, copy ID từ URL     |
| `secrets/google-service-account.json` | Tải file JSON từ Google Cloud Console                          |

### Backup tự động

Container `backup` chạy `pg_dump` mỗi ngày 02:00 (giờ VN) và upload lên Google Drive. Giữ lại 14 ngày local. Nếu chưa cấu hình Drive, dump vẫn được lưu ở `./backups/`.

### Thêm user

Hiện tại tạo trực tiếp qua DB:
```bash
docker compose exec app node -e '
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const p = new PrismaClient();
(async () => {
  await p.user.create({ data: {
    email: "user@shipus.vn", name: "Tên", role: "STAFF",
    passwordHash: await bcrypt.hash("MatKhau123!", 12),
  }});
  console.log("done");
})();
'
```

UI quản lý user sẽ có ở Phase 5.

## Phân quyền

- **ADMIN**: full access tất cả toà nhà, có thể tạo toà, tạo user, gán quyền
- **STAFF**: chỉ thấy toà được gán. Mỗi gán có 1 trong 4 quyền:
  - `OWNER`: full quyền trong toà đó
  - `MANAGER`: HĐ + hoá đơn + tài chính + xem cài đặt
  - `ACCOUNTANT`: chỉ xem HĐ/HĐ, full tài chính, xem cài đặt
  - `VIEWER`: read-only

## Database schema

Xem `prisma/schema.prisma` — 20+ models bao gồm:
- `User`, `UserBuildingPermission`
- `Building`, `Room`, `BuildingSetting`
- `Customer`, `Contract`, `ContractCustomer`, `ContractYearlyRent`
- `Invoice`, `InvoicePayment`
- `Transaction`, `Party`, `TransactionCategory`, `PaymentMethod`
- `OpeningBalance`
- `PushSubscription`, `AuditLog`

## Cấu trúc thư mục

```
therighthome/
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.js           # Seed data (idempotent)
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js             # Service worker (PWA)
│   └── icons/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (auth)/login/
│   │   ├── buildings/
│   │   ├── settings/
│   │   ├── api/          # API routes
│   │   ├── layout.tsx
│   │   └── page.tsx      # Dashboard
│   ├── components/
│   │   ├── ui/           # shadcn-style primitives
│   │   ├── layout/       # AppShell, PageHeader
│   │   └── contract/     # CCCDScanner
│   ├── lib/
│   │   ├── auth.ts       # NextAuth + Prisma
│   │   ├── auth.config.ts # Edge-safe config (middleware)
│   │   ├── prisma.ts
│   │   ├── permissions.ts # Per-building access control
│   │   ├── gemini.ts     # OCR
│   │   ├── docx.ts       # Contract DOCX generation
│   │   ├── codes.ts      # HD-YYMM-NNN generators
│   │   ├── storage.ts    # File upload (local volume)
│   │   └── utils.ts      # cn(), formatVND, ...
│   └── middleware.ts     # Auth guard
├── nginx/                # Nginx + Let's Encrypt config
├── scripts/
│   ├── deploy.sh         # First-time deploy
│   ├── entrypoint.sh     # Container startup
│   └── backup/           # Daily DB backup → Drive
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Bảo mật

- **Đổi password admin mặc định** sau khi đăng nhập lần đầu
- **Đổi Gemini API key** đã bị lộ trong chat ban đầu, tạo key mới
- **Đổi SSH password** server, ưu tiên dùng SSH key + disable password auth
- File ảnh CCCD lưu ở `./storage/id-cards/` được gate qua API auth (không public)
- HSTS enabled qua nginx, Let's Encrypt cert tự renew

## Troubleshooting

### `prisma migrate deploy` fail khi start
Đây là lần đầu (chưa có migrations folder). Container fallback sang `db push` tự động — bình thường. Sau khi schema ổn định, chạy `npx prisma migrate dev --name init` ở local để tạo migrations và commit lên.

### Gemini OCR trả lỗi 403
Kiểm tra `GEMINI_API_KEY` trong `.env`, đảm bảo project trên Google AI Studio đã enable Generative Language API.

### Email không gửi được
Gmail yêu cầu App Password (16 ký tự không space) chứ không phải password thường. Bật 2FA trước, sau đó tạo App Password tại https://myaccount.google.com/apppasswords.

### Bị 502 Bad Gateway
`docker compose logs app` xem app crash chưa, thường do `.env` thiếu biến. Hoặc DB chưa start xong — chờ 10s rồi reload.
