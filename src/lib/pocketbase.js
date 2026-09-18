import PocketBase from 'pocketbase';

// Берем URL из ENV (никогда не хардкодим!)
const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);

export default pb;