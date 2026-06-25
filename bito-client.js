// bito-client.js
// Bito ERP "Integration API"siga so'rov yuborish uchun yordamchi modul.
// Hujjat: https://docs.bito.uz/  (swagger.json asosida)

const axios = require('axios');

const BITO_API_BASE = process.env.BITO_API_BASE || 'https://api.bito.uz/integration-api/integration/api/v2';
const BITO_API_KEY = process.env.BITO_API_KEY;
const ORGANIZATION_ID = process.env.BITO_ORGANIZATION_ID;
const WAREHOUSE_ID = process.env.BITO_WAREHOUSE_ID;

if (!BITO_API_KEY) {
  console.warn('OGOHLANTIRISH: BITO_API_KEY .env faylida topilmadi!');
}

// Har bir so'rovda shu header avtomatik qo'shiladi
const client = axios.create({
  baseURL: BITO_API_BASE,
  headers: {
    'api-key': BITO_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Bito javoblari har doim { code, message, status_code, data, ... } ko'rinishida keladi.
// Shu yordamchi funksiya faqat "data" qismini ajratib beradi va xatolarni o'qiladigan qiladi.
async function call(method, path, payload) {
  try {
    const res = await client.request({
      method,
      url: path,
      data: method.toLowerCase() === 'get' ? undefined : payload,
      params: method.toLowerCase() === 'get' ? payload : undefined
    });
    return res.data.data;
  } catch (err) {
    if (err.response) {
      console.error(`Bito API xatosi [${path}]:`, err.response.status, JSON.stringify(err.response.data));
      throw new Error(err.response.data?.message || 'Bito API xatosi');
    }
    console.error(`Bito API ulanish xatosi [${path}]:`, err.message);
    throw err;
  }
}

// ============================================
// 1. MAHSULOTLAR
// ============================================
async function getProducts({ page = 1, limit = 50, category_id, search } = {}) {
  const payload = {
    page,
    limit,
    organization_id: ORGANIZATION_ID,
    is_available_for_sale: true
  };
  if (category_id) payload.category_id = category_id;

  const result = await call('post', '/product/get-paging', payload);
  // result = { total, data: [...] }
  return result;
}

// ============================================
// 2. KATEGORIYALAR
// ============================================
async function getCategories({ page = 1, limit = 100 } = {}) {
  const result = await call('post', '/category/get-paging', {
    page,
    limit,
    organization_id: ORGANIZATION_ID
  });
  return result;
}

// ============================================
// 3. MIJOZNI TELEFON RAQAM ORQALI TOPISH
// ============================================
async function getCustomerByPhone(phoneNumber) {
  try {
    return await call('get', '/customer/get-by-phone-number', { phone_number: phoneNumber });
  } catch (err) {
    // Agar mijoz topilmasa, Bito xato qaytarishi mumkin - shu holatda null qaytaramiz
    return null;
  }
}

// ============================================
// 4. ASOSIY VALYUTANI OLISH
// ============================================
let _mainCurrencyCache = null;
async function getMainCurrency() {
  if (_mainCurrencyCache) return _mainCurrencyCache;
  const result = await call('get', '/currency/get-main', {});
  _mainCurrencyCache = result;
  return result;
}

// ============================================
// 5. MIJOZ BALANSI
// ============================================
async function getCustomerBalance(customerId) {
  const currency = await getMainCurrency();
  const result = await call('get', '/balance/get-by-customer', {
    customer_id: customerId,
    currency_id: currency._id
  });
  return result; // { customer_id, currency_id, balance }
}

// ============================================
// 6. BUYURTMA YARATISH
// ============================================
async function createSaleOrder({ customerId, products, responsibleId, priceId }) {
  const currency = await getMainCurrency();

  const payload = {
    state: 'new',
    organization_id: ORGANIZATION_ID,
    customer_id: customerId,
    responsible_id: responsibleId, // sotuvchi/menejer id - .env yoki sozlamadan olinadi
    currency_id: currency._id,
    date: new Date().toISOString(),
    discounts: [],
    products: products.map(p => ({
      product_id: p.productId,
      amount: p.qty,
      price: p.price,
      price_id: priceId,
      warehouse_id: WAREHOUSE_ID
    }))
  };

  return await call('post', '/sale-order/create', payload);
}

// ============================================
// 7. MIJOZNING BUYURTMALAR TARIXI (bot uchun maxsus)
// ============================================
async function getOrdersByCustomer(customerId, { page = 1, limit = 20 } = {}) {
  const result = await call('post', '/sale-order/get-by-customer/for-bot', {
    page,
    limit,
    customer_id: customerId
  });
  return result; // { list: [...], total }
}

// ============================================
// 8. NARXLAR RO'YXATI (kerak bo'lganda price_id olish uchun)
// ============================================
async function getPrices() {
  return await call('get', '/price/get-all', { type: 'sale', status: 'active' });
}

module.exports = {
  getProducts,
  getCategories,
  getCustomerByPhone,
  getMainCurrency,
  getCustomerBalance,
  createSaleOrder,
  getOrdersByCustomer,
  getPrices
};
