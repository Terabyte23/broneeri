/**
 * PocketBase JS Hook: Stripe Webhook Handler
 * 
 * Обрабатывает входящие вебхуки от Stripe:
 * - checkout.session.completed (оплата через Payment Link или Stripe Checkout)
 * - checkout.session.async_payment_succeeded (успешная отложенная оплата)
 * - payment_intent.succeeded (успешный прямой платеж)
 * 
 * Маршруты:
 * - POST /api/stripe-webhook (основной)
 * - POST /webhook
 * - POST / (подстраховка на случай, если в Stripe указали только корень домена)
 */

function handleStripeWebhook(e) {
    try {
        const info = e.requestInfo();
        const data = info.body;

        if (!data || !data.type) {
            return e.json(400, { 
                error: "Некорректное тело запроса: отсутствует поле 'type'" 
            });
        }

        // Опциональная проверка секретного токена
        const configuredSecret = $os.getenv("STRIPE_WEBHOOK_SECRET");
        if (configuredSecret) {
            const querySecret = info.query?.secret;
            const headerSecret = info.headers?.["x-webhook-secret"];
            if (querySecret !== configuredSecret && headerSecret !== configuredSecret) {
                console.warn("[Stripe Webhook] Запрос отклонен: не совпадает секретный токен");
                return e.json(401, { error: "Неавторизованный доступ: неверный секретный ключ" });
            }
        }

        const eventType = data.type;
        console.log(`[Stripe Webhook] >>> Входящее событие: ${eventType} (ID: ${data.id})`);

        let bookingId = null;
        let paymentStatus = null;

        // 1. Оплата через Checkout / Payment Link
        if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
            const session = data.data?.object;
            bookingId = session?.client_reference_id 
                     || session?.metadata?.booking_id 
                     || session?.metadata?.bookingId;
            paymentStatus = session?.payment_status;

            console.log(`[Stripe Webhook] Checkout Session ID: ${session?.id}, Booking ID: ${bookingId}, Status: ${paymentStatus}`);
        }

        // 2. Прямой Payment Intent
        if (eventType === "payment_intent.succeeded") {
            const pi = data.data?.object;
            bookingId = pi?.metadata?.booking_id 
                     || pi?.metadata?.bookingId 
                     || pi?.metadata?.client_reference_id;
            paymentStatus = pi?.status;

            console.log(`[Stripe Webhook] PaymentIntent ID: ${pi?.id}, Booking ID: ${bookingId}, Status: ${paymentStatus}`);
        }

        // 3. Возврат средств (refund)
        if (eventType === "charge.refunded") {
            const charge = data.data?.object;
            console.log(`[Stripe Webhook] Возврат средств для Charge ID: ${charge?.id}`);
        }

        // Если нашли ID бронирования — обновляем запись в PocketBase
        if (bookingId) {
            try {
                const record = $app.findRecordById("bookings", bookingId);
                if (record) {
                    const oldStatus = record.get("status");
                    record.set("status", "paid");
                    $app.save(record);
                    console.log(`[Stripe Webhook] ✓ Бронирование ${bookingId} успешно обновлено: [${oldStatus}] -> [paid]`);
                } else {
                    console.warn(`[Stripe Webhook] ! Запись с ID ${bookingId} не найдена в коллекции 'bookings'`);
                }
            } catch (dbErr) {
                console.error(`[Stripe Webhook] ✗ Ошибка обновления бронирования ${bookingId}:`, dbErr);
            }
        } else if (eventType.startsWith("checkout.") || eventType.startsWith("payment_intent.")) {
            console.warn(`[Stripe Webhook] ! В событии ${eventType} не найден bookingId (client_reference_id или metadata)`);
        }

        // Всегда возвращаем HTTP 200 Stripe, чтобы он не слал повторные запросы
        return e.json(200, { 
            received: true, 
            event: eventType,
            bookingId: bookingId || null
        });

    } catch (err) {
        console.error("[Stripe Webhook] Критическая ошибка обработчика:", err);
        return e.json(500, { error: err.message || "Internal Server Error" });
    }
}

// Регистрируем на все возможные варианты пути:
routerAdd("POST", "/api/stripe-webhook", handleStripeWebhook);
routerAdd("POST", "/webhook", handleStripeWebhook);
routerAdd("POST", "/", handleStripeWebhook);
