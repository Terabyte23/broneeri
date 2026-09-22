import PocketBase from 'pocketbase';

// URL võetakse keskkonnamuutujast (.env / Coolify), või dev-režiimis lokaalsest PocketBase pordist 8090
const getDefaultUrl = () => {
  if (typeof window !== 'undefined') {
    const isDev = window.location.port === '5173' || window.location.port === '3000';
    if (isDev) {
      return 'http://127.0.0.1:8090';
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:8090';
};

const pbUrl = (import.meta.env.VITE_POCKETBASE_URL || getDefaultUrl()).replace(/\/$/, '');
const pb = new PocketBase(pbUrl);
pb.autoCancellation(false);

export default pb;