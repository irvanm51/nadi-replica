# Requirements: Teleport Enterprise Trial + SSO Google Workspace

## Tujuan

Membangun baseline **"sesudah Zero Trust"**: menaruh Teleport di depan replica app
([01-replica-app-requirements.md](./01-replica-app-requirements.md)) yang sudah live di production
([02-deployment-plan.md](./02-deployment-plan.md)), memakai SSO Google Workspace menggantikan
login lokal, supaya bisa dibandingkan langsung dengan baseline "sebelum" (attack surface, RBAC
enforcement, audit trail) menggunakan metodologi yang sama seperti
`teleport/skripsi/teleport-lab/README.md`.

Ini **bukan mulai dari nol** — melanjutkan config yang sudah ada di
`teleport/skripsi/teleport-lab/teleport/teleport.yaml` dan `teleport/skripsi/teleport-lab/roles/`,
di-upgrade ke edisi Enterprise dan dipindah ke production.

## 1. Upgrade ke Teleport Enterprise (Trial)

- Daftar trial di halaman resmi Teleport (dilakukan user sendiri, perlu email kerja/kampus).
- Fitur SSO/OIDC connector ke IdP non-GitHub (Google, Okta, Azure AD) adalah fitur **Enterprise**
  — Community Edition hanya gratis untuk SSO GitHub. Ini alasan kenapa trial Enterprise diperlukan.
- Setelah approve, akan didapat license file (`license.pem`) — simpan di server, mount ke
  container, **jangan commit ke git**.

## 2. Deploy Teleport Auth+Proxy Production

Reuse struktur `teleport.yaml` dari lab (image `teleport-distroless:18`), dengan perubahan:

```yaml
version: v3

teleport:
  nodename: teleport
  data_dir: /var/lib/teleport

auth_service:
  enabled: "yes"
  cluster_name: "teleport.<domain>"          # ganti dari teleport.example.lab
  listen_addr: 0.0.0.0:3025
  proxy_listener_mode: multiplex
  authentication:
    type: oidc                                # ganti dari "local" -> pakai Google OIDC (lihat #3)

proxy_service:
  enabled: "yes"
  web_listen_addr: 0.0.0.0:443
  public_addr: "teleport.<domain>:443"
  acme:
    enabled: "yes"                             # pakai Let's Encrypt otomatis, ganti dari wildcard-key manual

app_service:
  enabled: "yes"
  apps:
    - name: "nadi"
      uri: "http://<app-vps-ip-or-hostname>:3000"
      public_addr: "app.<domain>"              # arahkan ke replica app production, bukan mock portal
      labels:
        portal: "nadi"

ssh_service:
  enabled: "no"
```

Deploy: docker-compose serupa lab, tambah volume mount untuk `license.pem`, jalankan di VPS
terpisah dari VPS app (rekomendasi Zero Trust: access-broker independen dari resource yang
dilindungi) — atau di VPS yang sama kalau budget sangat ketat (lihat catatan di deployment plan).

## 3. Google Workspace OIDC Connector

Langkah yang dilakukan **user sendiri** (butuh akses admin Google Workspace + Google Cloud Console):

1. Buat project baru di Google Cloud Console.
2. Setup OAuth consent screen, tipe "Internal" (kalau organisasi Workspace) atau "External".
3. Buat OAuth Client ID (tipe "Web application"), redirect URI:
   `https://teleport.<domain>/v1/webapi/oidc/callback`.
4. Simpan Client ID + Client Secret — taruh di secret file di server (`.env` atau secret manager),
   **tidak pernah** di-commit ke git.

Lalu buat resource `oidc_connector` di Teleport (lewat `tctl create`):

```yaml
kind: oidc
version: v3
metadata:
  name: google-workspace
spec:
  client_id: "process.env.GOOGLE_OIDC_CLIENT_ID"       # TODO: isi dari secret vault/.env, jangan hardcode
  client_secret: "process.env.GOOGLE_OIDC_CLIENT_SECRET" # TODO: isi dari secret vault/.env, jangan hardcode
  issuer_url: "https://accounts.google.com"
  redirect_url: "https://teleport.<domain>/v1/webapi/oidc/callback"
  scope: ["email", "profile"]
  claims_to_roles:
    - claim: "hd"                  # hosted domain claim = domain Workspace
      value: "<workspace-domain>"
      roles: ["mahasiswa"]         # default minimal; mapping detail per grup di langkah berikut
```

## 4. Mapping Role — Reuse RBAC yang Sudah Ada

**Jangan buat role RBAC baru** — role `dosen`, `mahasiswa`, `staf-akademik` sudah ada di
`teleport/skripsi/teleport-lab/roles/` (contoh `role-mahasiswa.yaml` memakai `app_labels`).
Cukup:

1. Buat Google Groups di Workspace: `dosen@<workspace-domain>`, `mahasiswa@<workspace-domain>`,
   `staf-akademik@<workspace-domain>`.
2. Update `claims_to_roles` di connector supaya membaca `groups` claim dan memetakan ke role
   Teleport yang sama persis dengan yang dipakai role lab, contoh:

```yaml
  claims_to_roles:
    - claim: "groups"
      value: "staf-akademik@<workspace-domain>"
      roles: ["staf-akademik"]
    - claim: "groups"
      value: "dosen@<workspace-domain>"
      roles: ["dosen"]
    - claim: "groups"
      value: "mahasiswa@<workspace-domain>"
      roles: ["mahasiswa"]
```

3. Update `app_labels` di masing-masing role (`role-dosen.yaml`, `role-mahasiswa.yaml`,
   `role-staf.yaml`) supaya `portal` mengarah ke label app production (`portal: ["nadi"]`) alih-alih
   kombinasi mock lab (`siakad`, `lms`) — sesuaikan dengan app yang benar-benar di-deploy di
   [01-replica-app-requirements.md](./01-replica-app-requirements.md).

## 5. Registrasi Aplikasi Production

- App production dari poin 1/2 didaftarkan sebagai `app_service` entry (`name: "nadi"`) menunjuk
  ke instance production sungguhan (`app.<domain>`), bukan mock identity-card app di lab.
- User akses lewat `https://app.<domain>` akan otomatis redirect ke Teleport proxy → Google SSO
  login → setelah sukses, diteruskan ke app dengan header identitas/JWT Teleport.

## 6. Audit Log & Session Recording

- Default aktif di Teleport (`data_dir` sudah menyimpan audit log + session recording, seperti
  yang sudah dipakai di lab).
- Simpan/export log ini sebagai evidence skripsi (bandingkan dengan hasil eksperimen "before" yang
  tidak Zero Trust) — lanjutkan format tabel/skema evidence yang sudah didefinisikan di
  `teleport/skripsi/teleport-lab/README.md`.

## 7. Catatan Masa Trial

- Trial Enterprise biasanya terbatas waktu (cek durasi saat pendaftaran) — catat tanggal expiry
  dan pastikan seluruh pengambilan data eksperimen (nmap, JMeter, RBAC test) selesai sebelum masa
  trial habis.
- Fallback kalau trial habis sebelum sidang: downgrade ke Teleport Community + SSO GitHub (gratis)
  sebagai pengganti sementara Google Workspace, dengan catatan di laporan bahwa IdP berbeda namun
  mekanisme Zero Trust yang diuji tetap sama.

## Definition of Done

- [ ] Login ke `https://app.<domain>` redirect otomatis ke Google Workspace SSO, bukan form
      username/password lokal.
- [ ] User di masing-masing Google Group hanya bisa akses sesuai role (`staf-akademik` full,
      `dosen` input nilai, `mahasiswa` lihat KRS/nilai) — role Teleport reuse dari lab, bukan baru.
- [ ] Audit log & session recording tersimpan dan bisa diekspor sebagai evidence.
- [ ] Tidak ada client secret Google OIDC yang ter-commit ke git di mana pun.
