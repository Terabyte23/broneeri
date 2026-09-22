import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pbUrl = (env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'stripe-webhook-dev-handler',
        configureServer(server) {
          server.middlewares.use('/api/stripe-webhook', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            try {
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              const rawBody = Buffer.concat(chunks);

              // 1. Пересылаем вебхук в PocketBase
              const targetUrl = `${pbUrl}/api/stripe-webhook`;
              console.log(`[Vite Dev Server] Пересылка Stripe вебхука на ${targetUrl}`);

              const headers = { 'Content-Type': 'application/json' };
              if (req.headers['stripe-signature']) {
                headers['stripe-signature'] = req.headers['stripe-signature'];
              }

              let pbResponse = null;
              try {
                pbResponse = await fetch(targetUrl, {
                  method: 'POST',
                  headers,
                  body: rawBody,
                });
              } catch (fetchErr) {
                console.warn(`[Vite Dev Server] PocketBase недоступен по адресу ${targetUrl}:`, fetchErr.message);
              }

              if (pbResponse && pbResponse.ok) {
                const text = await pbResponse.text();
                res.statusCode = pbResponse.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(text);
                return;
              }

              // 2. Если PocketBase вернул 404 (например, еще не обновили образ на сервере) или оффлайн
              const data = JSON.parse(rawBody.toString('utf-8'));
              const bookingId = data?.data?.object?.client_reference_id;
              console.log(`[Vite Dev Server] Вебхук принят: ${data?.type}, bookingId: ${bookingId}`);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ received: true, event: data?.type, note: 'Processed by Vite Dev Handler' }));
            } catch (err) {
              console.error('[Vite Dev Server Webhook Error]:', err);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        },
      },
    ],
  };
});