# 💳 Stripe To'lov Tizimini Sozlash

## 1-qadam: Stripe hisobi

1. [dashboard.stripe.com](https://dashboard.stripe.com/register) da ro'yxatdan o'ting
2. Biznesingizni tasdiqlang (bank hisobi yoki karta kerak)

---

## 2-qadam: API kalitlari

**Dashboard → Developers → API Keys:**

```
STRIPE_SECRET_KEY     = sk_live_xxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY = pk_live_xxxxxxxxxxxx
```

> Test uchun `sk_test_` va `pk_test_` kalitlarini ishlatishingiz mumkin.

---

## 3-qadam: Mahsulotlar va narxlar yaratish

**Dashboard → Products → Add product:**

| Mahsulot | Narx | Interval |
|----------|------|----------|
| NovaMind Pro | $9.99 | Monthly (oylik) |
| NovaMind Premium | $19.99 | Monthly (oylik) |
| NovaMind Ultra | $39.99 | Monthly (oylik) |

Har bir mahsulot yaratgandan so'ng **Price ID** ni nusxa oling (`price_1AbcDef...`):

```
STRIPE_PRICE_PRO     = price_xxxxx
STRIPE_PRICE_PREMIUM = price_xxxxx
STRIPE_PRICE_ULTRA   = price_xxxxx
```

---

## 4-qadam: Webhook sozlash

**Dashboard → Developers → Webhooks → Add endpoint:**

- **Endpoint URL:** `https://your-domain.com/webhook/stripe`
- **Events to listen:**
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`
  - `customer.subscription.updated`

**Signing secret** ni nusxa oling:
```
STRIPE_WEBHOOK_SECRET = whsec_xxxxx
```

> **Lokal test uchun:** [Stripe CLI](https://stripe.com/docs/stripe-cli) ishlatib webhook forward qiling:
> ```bash
> stripe listen --forward-to localhost:5000/webhook/stripe
> ```

---

## 5-qadam: Billing Portal sozlash

**Dashboard → Settings → Billing → Customer portal:**
- "Subscriptions" → Allow customers to cancel → **ON**
- "Subscriptions" → Allow customers to update → **ON**
- Saqlang

---

## 6-qadam: .env fayl

Loyiha papkasida `.env` fayl yarating:

```env
GROQ_API_KEY=gsk_your_key
SECRET_KEY=your-random-secret-key-32chars

STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

STRIPE_PRICE_PRO=price_xxxx
STRIPE_PRICE_PREMIUM=price_xxxx
STRIPE_PRICE_ULTRA=price_xxxx

APP_URL=https://your-domain.com
```

---

## 7-qadam: Serverni ishga tushirish

```bash
pip install -r requirements.txt
python app.py
```

---

## Test kartalar (test rejimida)

| Karta | Natija |
|-------|--------|
| `4242 4242 4242 4242` | Muvaffaqiyatli to'lov |
| `4000 0000 0000 0002` | Rad etildi |
| `4000 0025 0000 3155` | 3D Secure talab qiladi |

> Muddati: istalgan kelajak sana, CVV: istalgan 3 raqam

---

## Qo'llab-quvvatlash

Muammo yuzaga kelsa: [Stripe Docs](https://stripe.com/docs)
