import PocketBase from 'pocketbase';

// URL võetakse keskkonnamuutujast (Coolify / .env)
const pbUrl = (import.meta.env.VITE_POCKETBASE_URL || window.location.origin).replace(/\/$/, '');
const pb = new PocketBase(pbUrl);

export default pb;