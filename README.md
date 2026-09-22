# AutoServicePro — SaaS Broneerimissüsteem

Veebipõhine autoteeninduse broneerimisplatvorm, mis on loodud projektinädala raames kasutades **React**, **Vite**, **PocketBase** ja **Coolify** platvormi.

---

## 1. Projekti kirjeldus
AutoServicePro võimaldab autoteeninduse klientidel:
- Registreeruda ja sisse logida e-posti ning parooliga.
- Valida sobiva teenuse (õlivahetus, diagnostika, pidurite remont jne), kuupäeva ja kellaaja.
- Sisestada sõiduki andmed (mark, mudel, registrinumber).
- Salvestada broneering turvaliselt PocketBase andmebaasi.
- Suunata kasutaja Stripe makselingile broneeringu eest tasumiseks.
- Vaadata oma isiklikke aktiivseid ja varasemaid broneeringuid ning nende staatust (*Minu broneeringud*).

---

## 2. Arhitektuur ja tehniline valik
- **Frontend:** React 19 + Vite + Tailwind CSS. Kiire, kergekaaluline ja kaasaegne kasutajaliides.
- **Backend / Database:** PocketBase (isehostitav Go baasil SQLite andmebaas, REST API, Auth ja failihaldus ühes).
- **PaaS / Hosting:** Coolify (isehostitav PaaS lahendus VPS serveril).
- **Turvalisus:** PocketBase API Rules kontrollivad, et tavakasutaja näeb ja muudab ainult enda loodud broneeringuid (@request.auth.id != "" && user = @request.auth.id).
- **Püsivus (Persistent Volumes):** PocketBase konteinerile on määratud püsiv ketas /pb/pb_data, mis tagab andmete säilimise taaskäivituste ja uuesti juurutamiste ajal.

---

## 3. Lingid töötavatele teenustele
- **Frontend rakendus:** [Coolify Frontend URL](http://b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io) *(või määratud domeen)*
- **PocketBase Admin UI:** http://b1uhomgy9jvqvani7dpxev4h.176.112.158.15.sslip.io/_/

---

## 4. PocketBase andmemudel (Collections) ja API reeglid

### Kollektsioon users (PocketBase auth collection)
- Sisseehitatud kasutajahaldus (email, password).

### Kollektsioon ookings (Base collection)
| Väli | Tüüp | Nõutud | Kirjeldus |
| :--- | :--- | :--- | :--- |
| user | Relation -> users | Jah | Viide broneeringu teinud kasutajale |
| service | Text / Select | Jah | Teenuse kood või nimetus |
| ooking_date | Text / Date | Jah | Valitud aeg (nt 2026-09-20 14:00:00) |
| car_model | Text | Jah | Auto mark ja mudel (nt Audi A6) |
| car_number | Text | Jah | Auto registreerimismärk |
| status | Select | Jah | pending, confirmed, paid, cancelled |

### API Reeglid (API Rules) kollektsioonile ookings:
- **List / Search Rule:** @request.auth.id != "" && user = @request.auth.id *(Kasutaja näeb ainult oma broneeringuid!)*
- **View Rule:** @request.auth.id != "" && user = @request.auth.id
- **Create Rule:** @request.auth.id != "" *(Ainult sisse logitud kasutaja saab luua)*
- **Update Rule:** @request.auth.id != "" && user = @request.auth.id
- **Delete Rule:** @request.auth.id != "" && user = @request.auth.id

---

## 5. Juurutamine Coolify kaudu

### PocketBase teenuse seadistamine Coolifys:
1. Ava Coolify paneelis oma rakendus.
2. Vali build packiks **Dockerfile**.
3. **PORDID (Ports Exposes):** Määra 8090 (PocketBase vaikimisi port).
4. **PERSISTENT VOLUME (Kriitiline!):**
   - Suuna maht: pb_data -> /pb/pb_data
   - *Ilma selleta kaovad SQLite andmed konteineri taaskäivitumisel!*
5. Käivita (**Deploy**).
6. Ava esmakordsel sisenemisel http://<sinu-url>/_/ ja loo esimene administraatori konto.

### Frontendi juurutamine Coolifys:
1. Lisa Coolifysse uus teenus GitHubi hoidlast https://github.com/Terabyte23/broneeri.git.
2. Build pack: **Nixpacks** või **NodeJS / Static**.
3. Build command: 
pm run build
4. Publish directory: dist
5. Lisa keskkonnamuutuja:
   `env
   VITE_POCKETBASE_URL=http://<pocketbase-service-url>
   `

---

## 6. Keskkonnamuutujad (Environment Variables) ja Stripe Makselahendus

Frontend vajab järgmisi muutujaid (vt ka `.env.example`):
```env
# PocketBase URL
VITE_POCKETBASE_URL=http://127.0.0.1:8090

# Stripe Makselink (buy.stripe.com)
VITE_STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_...

# Stripe avalik võti (valikuline)
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

### Kuidas Stripe makselahendus töötab:
1. **Stripe Payment Link (Tootmises ja testis):**
   - Stripe Dashboardis (`test mode`) looge toode ja sellele **Payment Link** (`buy.stripe.com/test_...`).
   - Seadistage Stripe'is pärast makset suunamise aadressiks (*Confirmation page -> Redirect customers to your website*):
     `http://localhost:5173/?payment=success&booking_id={CHECKOUT_SESSION_ID}` (või teie Coolify domeen).
   - Rakendus võtab tagasisuunamisel automaatselt vastu parameetri `?payment=success`, märgib broneeringu staatuseks `paid` ning kuvab kliendile eduka makse kinnitusakna.
2. **Sisseehitatud Stripe Checkout Testrežiim:**
   - Kui `VITE_STRIPE_PAYMENT_LINK` on tühi või testrežiimis, avab rakendus broneerimisel otse interaktiivse Stripe makseakna, kus saab testkaardiga (`4242 4242 4242 4242`) simuleerida makset ning broneering märgitakse PocketBase'is staatusele `paid`.
3. **Tasumata broneeringute maksmine:**
   - Jaotises *Minu broneeringud* on iga ootel (`pending`) broneeringu juures nupp **Maksa Stripe'iga**, mis võimaldab kliendil mugavalt tasuda ka hiljem.

---

## 7. Lokaalne käivitamine arenduseks

`ash
# 1. Klooni kood
git clone https://github.com/Terabyte23/broneeri.git
cd broneeri

# 2. Käivita PocketBase Dockeriga lokaalselt
docker-compose up -d

# 3. Paigalda sõltuvused ja käivita React frontend
npm install
npm run dev
`
Rakendus avaneb aadressil http://localhost:5173.
