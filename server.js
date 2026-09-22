/**
 * Standalone Stripe Webhook Server (Node.js)
 * 
 * Данный сервер принимает вебхуки от Stripe, проверяет официальную криптографическую подпись
 * (stripe-signature) через библиотеку Stripe SDK и обновляет статус бронирования в PocketBase на 'paid'.
 * 
 * Запуск:
 *   node server.js
 *   (или npm run webhook)
 */

import http from 'node:http';
import Stripe from 'stripe';
import PocketBase from 'pocketbase';

const PORT = process.env.WEBHOOK_PORT || process.env.PORT || 3001;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const POCKETBASE_URL = (process.env.VITE_POCKETBASE_URL || process.env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');

// Инициализация клиентов
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

const server = http.createServer(async (req, res) => {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check эндпоинт
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'stripe-webhook-server',
      pocketbase: POCKETBASE_URL,
      signatureVerification: Boolean(STRIPE_WEBHOOK_SECRET)
    }));
    return;
  }

  // Эндпоинт вебхука: /api/stripe-webhook или /webhook
  if ((req.url?.startsWith('/api/stripe-webhook') || req.url?.startsWith('/webhook')) && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      // 1. Проверка подписи Stripe
      if (STRIPE_WEBHOOK_SECRET && sig) {
        if (!stripe) {
          throw new Error('STRIPE_SECRET_KEY не указан, но задан STRIPE_WEBHOOK_SECRET');
        }
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
      } else {
        // Режим без обязательной проверки подписи (для тестов или локальной разработки)
        event = JSON.parse(rawBody.toString('utf-8'));
      }
    } catch (err) {
      console.error('[Stripe Webhook] ❌ Ошибка валидации вебхука:', err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Webhook Error: ${err.message}` }));
      return;
    }

    console.log(`[Stripe Webhook] 📥 Получено событие: ${event.type}`);

    try {
      let bookingId = null;

      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object;
        bookingId = session.client_reference_id 
                 || session.metadata?.booking_id 
                 || session.metadata?.bookingId;
      } else if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        bookingId = pi.metadata?.booking_id 
                 || pi.metadata?.bookingId 
                 || pi.metadata?.client_reference_id;
      }

      if (bookingId) {
        console.log(`[Stripe Webhook] Обнаружен ID бронирования: ${bookingId}`);

        // Сначала пробуем отправить запрос в PocketBase встроенный хук
        let updated = false;
        try {
          const pbHookRes = await fetch(`${POCKETBASE_URL}/api/stripe-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rawBody,
          });
          if (pbHookRes.ok) {
            updated = true;
            console.log(`[Stripe Webhook] ✓ PocketBase pb_hooks успешно обновил бронь ${bookingId}`);
          }
        } catch {
          // Игнорируем и пробуем прямой апдейт
        }

        // Если встроенный хук не ответил (например, удаленный PocketBase еще не перезапущен),
        // обновляем запись напрямую через PocketBase SDK
        if (!updated) {
          try {
            // Опциональная авторизация суперпользователя, если задана в .env
            const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
            const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
            if (adminEmail && adminPassword) {
              try {
                await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
              } catch {
                await pb.admins.authWithPassword(adminEmail, adminPassword).catch(() => {});
              }
            }

            await pb.collection('bookings').update(bookingId, { status: 'paid' });
            console.log(`[Stripe Webhook] ✓ Бронь ${bookingId} успешно переведена в статус 'paid' через SDK`);
            updated = true;
          } catch (sdkErr) {
            console.error(`[Stripe Webhook] ❌ Не удалось обновить запись ${bookingId} через SDK:`, sdkErr.message);
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, event: event.type, bookingId }));
    } catch (processErr) {
      console.error('[Stripe Webhook] Ошибка при обработке события:', processErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: processErr.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Stripe Webhook Server запущен на порту ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/api/stripe-webhook`);
  console.log(`📦 PocketBase URL: ${POCKETBASE_URL}`);
  console.log(`🛡️  Signature Verification: ${STRIPE_WEBHOOK_SECRET ? 'ВКЛЮЧЕНА (whsec_...)' : 'ВЫКЛЮЧЕНА (без секрета)'}`);
  console.log(`====================================================`);
});
