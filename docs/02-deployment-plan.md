# Requirements: Deployment ke Production

## Tujuan

Men-deploy replica web kampus ([01-replica-app-requirements.md](./01-replica-app-requirements.md))
ke internet supaya bisa jadi target eksperimen yang representatif (nmap/JMeter/dll, mengikuti
metodologi yang sudah dijalankan di `teleport/skripsi/teleport-lab/README.md`). Budget: hemat.

Semua langkah yang melibatkan pembayaran atau pembuatan akun **harus dilakukan oleh user sendiri**
— dokumen ini hanya berisi instruksi persis apa yang perlu diklik/dijalankan.

## 1. Registrasi Domain

Referensi harga (per Agustus 2026, cek harga terbaru saat checkout):

| Registrar | Domain | Estimasi harga/tahun |
|---|---|---|
| Niagahoster | `.my.id` | ~Rp35.000–50.000 |
| Domainesia | `.my.id` / `.com` | ~Rp35.000 / ~Rp150.000 |
| Namecheap | `.com` | ~$10–13 |

Langkah:
1. Cek ketersediaan nama domain (mis. `nadi-kampus.my.id` atau sejenis).
2. Buat akun di registrar pilihan, checkout domain (pembayaran oleh user).
3. Setelah domain aktif, siapkan 2 subdomain yang akan dipakai:
   - `app.<domain>` → replica app (poin ini)
   - `teleport.<domain>` → Teleport proxy (lihat [03-teleport-sso-plan.md](./03-teleport-sso-plan.md))

## 2. VPS

Referensi harga low-cost:

| Provider | Spek | Estimasi harga/bulan |
|---|---|---|
| DigitalOcean | 1 vCPU / 1GB RAM (Basic Droplet) | ~$6 |
| Vultr | 1 vCPU / 1GB RAM | ~$6 |
| Contabo | 4 vCPU / 8GB RAM (VPS S) | ~$5–7 (spek jauh lebih besar) |
| IDCloudHost | Cloud VPS kecil, billing Rupiah | ~Rp50.000–100.000 |

Rekomendasi: 1 VPS Ubuntu 22.04 LTS untuk app (poin ini), pertimbangkan VPS kedua yang terpisah
untuk Teleport (dijelaskan alasannya di dokumen poin 3) — kalau budget sangat ketat, keduanya bisa
digabung di satu VPS asal spek minimal 2 vCPU/2GB RAM.

## 3. DNS

Di dashboard registrar/DNS manager domain:
- A record `app` → IP publik VPS app.
- A record `teleport` → IP publik VPS Teleport (atau IP yang sama kalau digabung).
- TTL bisa default (3600s), diperkecil sementara (300s) saat awal setup untuk mempercepat propagasi.

## 4. Provisioning VPS Dasar

Dijalankan lewat SSH ke VPS baru:

```bash
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
# copy public key SSH ke /home/deploy/.ssh/authorized_keys, lalu:
# nonaktifkan password login & root login di /etc/ssh/sshd_config:
#   PermitRootLogin no
#   PasswordAuthentication no
systemctl restart sshd

curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 5. Reverse Proxy + TLS

Rekomendasi **Caddy** (auto-HTTPS, config jauh lebih simpel daripada Nginx+Certbot manual):

```
# /etc/caddy/Caddyfile
app.<domain> {
    reverse_proxy localhost:3000
}
```

Caddy otomatis mengurus sertifikat Let's Encrypt (gratis) dan renewal. Alternatif: Nginx + Certbot
kalau tim sudah familiar dengan itu.

## 6. Deploy Aplikasi

```bash
git clone <repo-url> /opt/nadi-replica
cd /opt/nadi-replica
cp .env.example .env
# isi .env manual di server (nano .env) — JANGAN commit .env ke git
docker compose up -d
docker compose ps   # pastikan healthy
```

## 7. Hardening & Monitoring Dasar

- `fail2ban` untuk proteksi brute-force SSH.
- Log rotation bawaan Docker (`json-file` driver dengan `max-size`/`max-file` di
  `docker-compose.yml`) supaya disk tidak penuh.
- Backup terjadwal: cron harian `pg_dump` dari container `db`, disimpan ke storage terpisah
  (mis. object storage murah seperti DigitalOcean Spaces / Backblaze B2).

## Definition of Done

- [ ] `https://app.<domain>` bisa diakses publik dengan TLS valid (padlock hijau, tanpa warning).
- [ ] SSH ke VPS hanya bisa lewat key, root login & password login nonaktif.
- [ ] Firewall aktif, hanya port 22/80/443 terbuka.
- [ ] Backup Postgres berjalan otomatis (verifikasi minimal 1 file backup pernah dibuat).
- [ ] Subdomain `teleport.<domain>` sudah disiapkan (DNS-nya) untuk dipakai di poin 3.
