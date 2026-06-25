# Bito ERP + Telegram Web App — to'liq qo'llanma

Bu loyiha sizga **mustaqil** (dasturchisiz) Telegram Web App bot yaratish va uni
to'g'ridan-to'g'ri Bito'ning rasmiy REST API'siga (`docs.bito.uz`) ulash imkonini beradi.

---

## NIMA TAYYORLANGAN?

```
bito_bot/
  ├── bot.js              ← asosiy server + bot kodi
  ├── bito-client.js      ← Bito API bilan gaplashish moduli
  ├── package.json        ← kerakli kutubxonalar ro'yxati
  ├── .env.example         ← sozlamalar namunasi
  └── public/
      ├── index.html      ← Web App sahifasi
      ├── style.css       ← dizayn
      └── app.js          ← Web App mantiqi (frontend)
```

---

## QADAM 1: Kerakli dasturlarni o'rnatish

Agar kompyuteringizda **Node.js** bo'lmasa:
- https://nodejs.org/ saytidan **LTS** versiyani yuklab oling va o'rnating

Tekshirish (terminal/cmd'da):
```bash
node --version
npm --version
```

---

## QADAM 2: Telegram bot yaratish (token olish)

1. Telegram'da **@BotFather**'ni toping
2. `/newbot` buyrug'ini yuboring
3. Bot nomi va username so'raydi (username `bot` bilan tugashi shart)
4. Sizga uzun **token** beriladi — saqlab qo'ying (masalan: `7123456789:AAHk3jXX...`)

---

## QADAM 3: Bito API kalitini olish

1. Bito admin panelingizga kiring
2. **Integratsiya** bo'limini toping
3. **API Key yaratish** (yoki shunga o'xshash) tugmasini bosing
4. Kalitni saqlab qo'ying

Shu yerda, agar imkon bo'lsa, quyidagilarni ham **alohida** yozib oling — ular kerak bo'ladi:
- **`organization_id`** — sizning tashkilotingiz ID'si (agar bitta filial bo'lsa, Bito panelida "Tashkilot" bo'limida ko'rinadi)
- **`warehouse_id`** — asosiy ombor ID'si
- **`responsible_id`** — buyurtmalar uchun mas'ul xodim (menejer) ID'si

> Agar bu ID'larni qayerdan topishni bilmasangiz, Bito qo'llab-quvvatlashidan so'rang: *"Integration API orqali buyurtma yaratish uchun menga organization_id, warehouse_id va bironta xodimning (responsible) ID'sini bering."*

---

## QADAM 4: Loyihani sozlash

1. `bito_bot` papkasini kompyuteringizga ko'chiring
2. Terminalda shu papkaga kiring:
   ```bash
   cd bito_bot
   npm install
   ```
3. `.env.example` faylidan nusxa oling va nomini `.env` ga o'zgartiring
4. `.env` faylini ochib, **haqiqiy qiymatlarni** kiriting:
   ```
   BOT_TOKEN=sizning_bot_tokeningiz
   BITO_API_KEY=sizning_bito_kalitingiz
   BITO_ORGANIZATION_ID=...
   BITO_WAREHOUSE_ID=...
   BITO_RESPONSIBLE_ID=...
   WEBAPP_URL=https://sizning-domeningiz.uz
   ```

---

## QADAM 5: Web App'ni internetga joylashtirish (hosting)

Web App **HTTPS** orqali ochiq turishi kerak. Eng oson variantlar:

### A) Agar sizda VPS/server bo'lsa
- Loyihani serverga yuklang
- `npm install && node bot.js` orqali ishga tushiring
- Doimiy ishlashi uchun **PM2** ishlatish tavsiya etiladi:
  ```bash
  npm install -g pm2
  pm2 start bot.js --name bito-bot
  pm2 save
  ```
- Domeningizga SSL o'rnatilganini tekshiring (Let's Encrypt — bepul)

### B) Agar serveringiz bo'lmasa — tezkor variant
**Railway.app** yoki **Render.com** kabi xizmatlar orqali bepul/arzon joylashtirish mumkin:
1. Loyihani GitHub'ga yuklang
2. Railway/Render'da "New Project" → GitHub repo'ni tanlang
3. Environment Variables bo'limida `.env` dagi barcha qiymatlarni kiritasiz
4. Deploy qilingandan keyin sizga avtomatik HTTPS domen beriladi (masalan `bito-bot.up.railway.app`)
5. Shu domenni `.env` dagi `WEBAPP_URL`ga yozib, qayta deploy qilasiz

---

## QADAM 6: Botni ishga tushirish

Lokal test uchun:
```bash
node bot.js
```//
Agar muvaffaqiyatli bo'lsa, terminalda shunday yozuv chiqadi:
```
Server 3000 portda ishga tushdi
Bot ishga tushdi (polling rejimida)
```

---

## QADAM 7: BotFather'da Menu Button'ni tekshirish

Kod ichida bot avtomatik ravishda Menu Button'ni sozlaydi, lekin tekshirib qo'yish mumkin:

1. @BotFather → `/mybots` → botingizni tanlang
2. **Bot Settings → Menu Button**
3. URL sizning `WEBAPP_URL` qiymatingiz bilan bir xil bo'lishi kerak

---

## QADAM 8: Telegram'da sinab ko'rish

1. Telegram **mobil ilovasi** orqali botingizni oching (brauzerda WebApp ishlamaydi!)
2. `/start` buyrug'ini yuboring
3. "Do'konni ochish" tugmasini bosing
4. Birinchi marta telefon raqamingizni tasdiqlash so'raladi — bu orqali siz Bito'dagi mijoz hisobingizga bog'lanasiz
5. Mahsulotlar, balans, buyurtma berish ishlashini tekshiring

---

## MUHIM ESLATMALAR

### 1. Mijozni bog'lash haqida
Kod hozircha foydalanuvchi-mijoz bog'lanishini **xotirada** (server ishga tushgancha) saqlaydi. Agar server qayta ishga tushsa, foydalanuvchilar telefon raqamini qaytadan tasdiqlashi kerak bo'ladi. Buni doimiy qilish uchun (tavsiya etiladi) oddiy bazaga (SQLite yoki shunga o'xshash) yozish kerak — bu keyingi bosqichda qo'shilishi mumkin.

### 2. Narx va `organization_id` haqida
Agar sizda bir nechta filial/do'kon (`organization`) bo'lsa, `bito-client.js` faylida `ORGANIZATION_ID`ni har bir foydalanuvchi uchun moslab o'zgartirish kerak bo'ladi. Hozirgi kod faqat **bitta** tashkilot uchun ishlaydi.

### 3. Xato bo'lsa
Agar biror endpoint kutilganidek ishlamasa (masalan Bito javobi formati biroz boshqacha bo'lsa), terminaldagi konsol xabarlarini (`console.error`) ko'rib, qaysi joyda nima noto'g'ri ekanini topish mumkin. Shu xabarni menga yuborsangiz, kodni moslashtirib beraman.

### 4. Test qilish tartibi
Tavsiya etiladi:
1. Avval **yangi test bot** (ikkinchi token) bilan sinab ko'ring
2. Faqat mahsulotlar ro'yxati ishlayotganini tekshiring
3. Keyin balans, keyin buyurtma berishni sinang
4. Hammasi ishlagandan keyin asosiy botga o'tkazing (yoki shu botni asosiy qilib qoldiring)
