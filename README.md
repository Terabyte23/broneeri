<h1 align="center">🚗 AutoServicePro</h1>

<p align="center">
  <strong>SaaS broneerimissüsteem autoteenindusele</strong><br/>
  Veebipõhine platvorm, mis võimaldab klientidel mugavalt broneerida autoteeninduse aegu ja tasuda Stripe''i kaudu.
</p>

<p align="center">
  <a href="http://b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io/"><img src="https://img.shields.io/badge/Live%20Demo-online-brightgreen?style=for-the-badge&logo=vercel" alt="Live Demo"/></a>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/PocketBase-Go-B8DBE4?style=for-the-badge&logo=go&logoColor=white" alt="PocketBase"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe"/>
  <img src="https://img.shields.io/badge/Coolify-Self--hosted-F97316?style=for-the-badge" alt="Coolify"/>
</p>

---

## 📋 Sisukord

- [Projekti kirjeldus](#-projekti-kirjeldus)
- [Arhitektuur](#-arhitektuur-ja-tehniline-valik)
- [Töötavad teenused](#-töötavad-teenused)
- [Andmemudel ja API reeglid](#-pocketbase-andmemudel-ja-api-reeglid)
- [Juurutamine Coolify kaudu](#-juurutamine-coolify-kaudu)
- [Keskkonnamuutujad ja Stripe](#-keskkonnamuutujad-ja-stripe-makselahendus)
- [Lokaalne käivitamine](#-lokaalne-käivitamine-arenduseks)

---

## 📖 Projekti kirjeldus

**AutoServicePro** on projektinädala raames loodud täisfunktsionaalne SaaS broneerimisplatvorm autoteenindusele.

Rakendus võimaldab klientidel:

| # | Funktsioon |
|---|-----------|
| ✅ | Registreeruda ja sisse logida e-posti ning parooliga |
| ✅ | Valida sobiva teenuse (õlivahetus, diagnostika, pidurite remont jne), kuupäeva ja kellaaja |
| ✅ | Sisestada sõiduki andmed (mark, mudel, registrinumber) |
| ✅ | Salvestada broneering turvaliselt PocketBase andmebaasi |
| ✅ | Tasuda broneeringu eest Stripe makselingiga |
| ✅ | Vaadata oma aktiivseid ja varasemaid broneeringuid ning nende staatust (**Minu broneeringud**) |

---

## 🏗️ Arhitektuur ja tehniline valik

```
┌─────────────────────────────────────┐
│           Kasutaja (brauser)        │
└────────────────┬────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────┐
│     Frontend: React 19 + Vite       │
│         Tailwind CSS                │
│   (Coolify → Nixpacks / Static)     │
└────────────────┬────────────────────┘
                 │ REST API
┌────────────────▼────────────────────┐
│   Backend: PocketBase (Go + SQLite) │
│   Auth · REST API · File Storage    │
│   Coolify → Dockerfile · Port 8090  │
│   Persistent Volume: /pb/pb_data    │
└────────────────┬────────────────────┘
                 │ Payment
┌────────────────▼────────────────────┐
│         Stripe Payment Link         │
│     (buy.stripe.com / Checkout)     │
└─────────────────────────────────────┘
```

| Kiht | Tehnoloogia | Kirjeldus |
|------|------------|-----------|
| **Frontend** | React 19 + Vite + Tailwind CSS | Kiire, kergekaaluline ja kaasaegne kasutajaliides |
| **Backend / DB** | PocketBase | Isehostitav Go-põhine SQLite andmebaas, REST API, Auth ja failihaldus ühes paketis |
| **Hosting / PaaS** | Coolify | Isehostitav PaaS lahendus VPS serveril |
| **Maksed** | Stripe | Payment Link + Checkout Embed |
| **Turvalisus** | PocketBase API Rules | Kasutaja näeb ja muudab **ainult enda** broneeringuid |
| **Püsivus** | Persistent Volume | `/pb/pb_data` tagab andmete säilimise konteineri taaskäivitusel |

---

## 🌐 Töötavad teenused

| Teenus | URL |
|--------|-----|
| 🖥️ **Frontend rakendus** | [b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io](http://b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io/) |
| 🗄️ **PocketBase Admin UI** | [b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io/_/](http://b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io/_/) |

---

## 🗄️ PocketBase andmemudel ja API reeglid

### Kollektsioon `users` *(Auth collection)*

PocketBase sisseehitatud kasutajahaldus: `email` + `password`.

---

### Kollektsioon `bookings` *(Base collection)*

| Väli | Tüüp | Nõutud | Kirjeldus |
|------|------|:------:|-----------|
| `user` | Relation → `users` | ✅ | Viide broneeringu teinud kasutajale |
| `service` | Text / Select | ✅ | Teenuse kood või nimetus |
| `booking_date` | Text / Date | ✅ | Valitud aeg (nt `2026-09-20 14:00:00`) |
| `car_model` | Text | ✅ | Auto mark ja mudel (nt `Audi A6`) |
| `car_number` | Text | ✅ | Auto registreerimismärk |
| `status` | Select | ✅ | `pending` · `confirmed` · `paid` · `cancelled` |

---

### 🔒 API Reeglid kollektsioonile `bookings`

> **Põhimõte:** tavakasutaja näeb ja muudab **ainult enda** loodud broneeringuid.

| Reegel | Väärtus |
|--------|---------|
| **List / Search** | `@request.auth.id != "" && user = @request.auth.id` |
| **View** | `@request.auth.id != "" && user = @request.auth.id` |
| **Create** | `@request.auth.id != ""` |
| **Update** | `@request.auth.id != "" && user = @request.auth.id` |
| **Delete** | `@request.auth.id != "" && user = @request.auth.id` |

---

## 🚀 Juurutamine Coolify kaudu

### 1️⃣ PocketBase teenuse seadistamine

1. Ava Coolify paneelis → **New Service**
2. Vali build pack: **Dockerfile** (`Dockerfile.pocketbase`)
3. **Ports Exposes:** `8090`
4. Lisa **Persistent Volume:**

   ```
   Source (host path):  pb_data
   Destination:         /pb/pb_data
   ```

   > ⚠️ **Kriitiline!** Ilma selleta kaovad SQLite andmed konteineri taaskäivitumisel!

5. Klõpsa **Deploy**
6. Esimesel sisselogimisel ava `http://<sinu-url>/_/` ja loo administraatori konto.

---

### 2️⃣ Frontendi juurutamine

1. Lisa Coolifys uus teenus GitHubi hoidlast:
   ```
   https://github.com/Terabyte23/broneeri.git
   ```
2. Build pack: **Nixpacks** või **NodeJS / Static**
3. Build command:
   ```bash
   npm run build
   ```
4. Publish directory:
   ```
   dist
   ```
5. Lisa keskkonnamuutuja:
   ```env
   VITE_POCKETBASE_URL=http://<pocketbase-service-url>
   ```

---

## 🔑 Keskkonnamuutujad ja Stripe makselahendus

Loo projekti juurkausta `.env` fail (vt `.env.example`):

```env
# PocketBase URL
VITE_POCKETBASE_URL=http://127.0.0.1:8090

# Stripe Makselink (buy.stripe.com)
VITE_STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_...

# Stripe avalik võti (valikuline)
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

---

### 💳 Kuidas Stripe makselahendus töötab?

#### Variant A — Stripe Payment Link (soovituslik tootmiseks)

1. Stripe Dashboardis (test mode) looge **Toode** ja sellele **Payment Link** (`buy.stripe.com/test_...`).
2. Seadistage Stripe'is pärast makset suunamise aadressiks:
   ```
   http://localhost:5173/?payment=success&booking_id={CHECKOUT_SESSION_ID}
   ```
   *(tootmises kasutage oma Coolify domeeni)*
3. Rakendus võtab `?payment=success` parameetri vastu, märgib broneeringu staatuseks `paid` ja kuvab kinnitusakna.

#### Variant B — Sisseehitatud Stripe Checkout (testrežiim)

Kui `VITE_STRIPE_PAYMENT_LINK` on tühi, avab rakendus **interaktiivse Stripe makseakna** otse brauseris.
Kasutage testkaarti: **`4242 4242 4242 4242`** (mis tahes tuleviku kuupäev ja CVC).

#### Hilisem maksmine

Jaotises **Minu broneeringud** on iga `pending` broneeringu juures nupp **Maksa Stripe'iga** — klient saab tasuda ka hiljem.

---

## 💻 Lokaalne käivitamine arenduseks

```bash
# 1. Klooni kood
git clone https://github.com/Terabyte23/broneeri.git
cd broneeri

# 2. Kopeeri keskkonnamuutujad
cp .env.example .env
# Muuda .env faili vastavalt oma seadistustele

# 3. Käivita PocketBase Dockeriga lokaalselt
docker-compose up -d

# 4. Paigalda sõltuvused ja käivita React frontend
npm install
npm run dev
```

Rakendus avaneb aadressil → [http://localhost:5173](http://localhost:5173)

PocketBase Admin UI → [http://localhost:8090/_/](http://localhost:8090/_/)

---

## 📁 Projekti struktuur

```
broneeri/
├── src/                    # React rakenduse lähtekood
├── public/                 # Staatilised failid
├── dist/                   # Build väljund (genereeritud)
├── Dockerfile              # Frontend Docker image
├── Dockerfile.pocketbase   # PocketBase Docker image
├── docker-compose.yml      # Lokaalne arenduskeskkond
├── nginx.conf              # Nginx seadistus (tootmine)
├── vite.config.js          # Vite seadistus
├── .env.example            # Keskkonnamuutujate näidis
└── README.md
```

---

<p align="center">
  Tehtud ❤️ projektinädala raames &nbsp;·&nbsp;
  <a href="https://github.com/Terabyte23/broneeri">GitHub</a>
</p>
