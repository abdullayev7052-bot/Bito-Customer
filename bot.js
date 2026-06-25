// bot.js
// Telegram Web App bot — Bito ERP integratsiyasi bilan.
//
// Ishga tushirish:
//   1. npm install
//   2. .env.example faylidan nusxa olib .env yaratish va to'ldirish
//   3. node bot.js

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const bito = require('./bito-client');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('XATO: BOT_TOKEN .env faylida ko\'rsatilmagan!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// TELEGRAM WEB APP "initData" NI TASDIQLASH
// ============================================
// Bu funksiya WebApp'dan kelgan so'rovning rostdan Telegram orqali
// kelganini va kim yuborganini tasdiqlaydi. Bito API kalitidan FARQLI -
// bu Telegram bilan bog'liq, xavfsizlik uchun shart.
function validateInitData(initData) {
  if (!initData) return null;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const dataCheckString = [...urlParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) return null;

  const userJson = urlParams.get('user');
  return userJson ? JSON.parse(userJson) : null;
}

function telegramAuthMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  const tgUser = validateInitData(initData);

  if (!tgUser) {
    return res.status(401).json({ error: 'Foydalanuvchi tasdiqlanmadi' });
  }

  req.tgUser = tgUser; // { id, first_name, username, ... }
  next();
}

// ============================================
// MIJOZNI BITO'DA TOPISH / BOG'LASH
// ============================================
// Eslatma: Bito mijozlarni telefon raqami orqali aniqlaydi.
// Birinchi marta WebApp ochilganda, foydalanuvchidan telefon raqamini
// so'raymiz (Telegram'ning o'z "contact share" funksiyasi orqali) va
// shu raqam orqali Bito'dagi customer_id'ni topib, eslab qolamiz.
//
// Oddiy variant uchun: xotirada (in-memory) saqlaymiz.
// Productionda buni albatta bazaga (masalan SQLite, Postgres) yozish kerak,
// aks holda server qayta ishga tushganda bog'lanish yo'qoladi.
const telegramToCustomerMap = new Map(); // telegram_user_id -> bito_customer_id

app.use('/api', telegramAuthMiddleware);

// Foydalanuvchini Bito mijoziga bog'lash (telefon raqami orqali)
app.post('/api/link-customer', async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'Telefon raqami kerak' });
    }

    const customer = await bito.getCustomerByPhone(phone_number);
    if (!customer) {
      return res.status(404).json({ error: 'Bu raqam bo\'yicha mijoz topilmadi. Avval do\'kondan ro\'yxatdan o\'ting.' });
    }

    telegramToCustomerMap.set(req.tgUser.id, customer._id);
    res.json({ success: true, customer_id: customer._id, name: customer.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Joriy foydalanuvchi mijoz sifatida bog'langanmi, tekshirish
function requireLinkedCustomer(req, res, next) {
  const customerId = telegramToCustomerMap.get(req.tgUser.id);
  if (!customerId) {
    return res.status(403).json({ error: 'NOT_LINKED', message: 'Avval telefon raqamingizni tasdiqlang' });
  }
  req.customerId = customerId;
  next();
}

// ============================================
// API: MAHSULOTLAR
// ============================================
app.get('/api/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const category_id = req.query.category_id || undefined;

    const result = await bito.getProducts({ page, limit: 50, category_id });

    // Bito javobini Web App kutgan sodda formatga keltiramiz
    const mapped = result.data.map(p => {
      // Narxni organizations[].prices[] ichidan topamiz (birinchi mosini olamiz)
      let price = 0;
      if (p.organizations && p.organizations.length) {
        const org = p.organizations[0];
        if (org.prices && org.prices.length) {
          price = org.prices[0].amount;
        }
      }
      return {
        id: p._id,
        name: p.name,
        price,
        image: p.image || null
      };
    });

    res.json({ total: result.total, products: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mahsulotlarni olishda xatolik' });
  }
});

// ============================================
// API: KATEGORIYALAR
// ============================================
app.get('/api/categories', async (req, res) => {
  try {
    const result = await bito.getCategories({});
    const mapped = result.data.map(c => ({ id: c._id, name: c.name }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategoriyalarni olishda xatolik' });
  }
});

// ============================================
// API: BALANS
// ============================================
app.get('/api/balance', requireLinkedCustomer, async (req, res) => {
  try {
    const result = await bito.getCustomerBalance(req.customerId);
    res.json({ balance: result.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Balansni olishda xatolik' });
  }
});

// ============================================
// API: BUYURTMALAR TARIXI
// ============================================
app.get('/api/orders', requireLinkedCustomer, async (req, res) => {
  try {
    const result = await bito.getOrdersByCustomer(req.customerId, { page: 1, limit: 30 });
    const mapped = result.list.map(o => ({
      id: o.number || o._id,
      total: o.total_to_pay || o.total_price || 0,
      status: o.state,
      date: o.date
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Buyurtmalarni olishda xatolik' });
  }
});

// ============================================
// API: YANGI BUYURTMA YARATISH
// ============================================
app.post('/api/orders', requireLinkedCustomer, async (req, res) => {
  try {
    const { items } = req.body; // [{ productId, qty, price }]
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Savatcha bo\'sh' });
    }

    const prices = await bito.getPrices();
    const defaultPriceId = prices && prices[0] ? prices[0]._id : undefined;

    const order = await bito.createSaleOrder({
      customerId: req.customerId,
      products: items,
      responsibleId: process.env.BITO_RESPONSIBLE_ID, // sotuvchi/menejer ID, .env'ga qo'shing
      priceId: defaultPriceId
    });

    res.json({ success: true, order_id: order._id, number: order.number });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Buyurtma yaratishda xatolik: ' + err.message });
  }
});

// ============================================
// BOT: /start KOMANDASI
// ============================================
bot.command('start', (ctx) => {
  ctx.reply(
    'Xush kelibsiz! Do\'konni ochish uchun tugmani bosing 👇',
    Markup.inlineKeyboard([
      Markup.button.webApp('🛍 Do\'konni ochish', WEBAPP_URL)
    ])
  );
});

// Doimiy "Menu Button" - chap pastdagi tugma orqali ham ochiladi
bot.telegram.setChatMenuButton({
  menu_button: {
    type: 'web_app',
    text: 'Do\'kon',
    web_app: { url: WEBAPP_URL }
  }
}).catch(err => console.error('Menu button sozlashda xatolik:', err.message));

// ============================================
// ISHGA TUSHIRISH
// ============================================
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishga tushdi`);
});

bot.launch().then(() => {
  console.log('Bot ishga tushdi (polling rejimida)');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
