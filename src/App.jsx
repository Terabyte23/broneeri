import { useState, useEffect } from 'react';
import pb from './lib/pocketbase';

export default function App() {
  const [user, setUser] = useState(pb.authStore.model);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Booking state
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [carModel, setCarModel] = useState('');
  const [carNumber, setCarNumber] = useState('');

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setUser(pb.authStore.model);
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegister) {
        await pb.collection('users').create({
          email,
          password,
          passwordConfirm: password,
        });
      }
      await pb.collection('users').authWithPassword(email, password);
      setIsAuthOpen(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError('Viga autoriseerimisel: ' + err.message);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!pb.authStore.isValid) {
      setIsAuthOpen(true);
      return;
    }

    try {
      const bookingData = {
        user: pb.authStore.model.id,
        service,
        booking_date: `${date} ${time}:00`,
        car_model: carModel,
        car_number: carNumber,
        status: 'pending'
      };

      const record = await pb.collection('bookings').create(bookingData);
      
      // Stripe Test Payment Link
      window.location.href = `https://buy.stripe.com/test_link_example?client_reference_id=${record.id}`;
    } catch (err) {
      alert('Viga broneeringu loomisel: ' + err.message);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen font-sans antialiased">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-amber-500/20">⚙️</div>
            <span className="font-bold text-xl tracking-wide">AutoService<span className="text-amber-500">Pro</span></span>
          </div>
          
          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-300 hidden sm:inline">{user.email}</span>
                <button onClick={handleLogout} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition">
                  Logi välja
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setIsRegister(false); setIsAuthOpen(true); }} 
                className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition shadow-lg shadow-amber-500/20"
              >
                Sisselogimine / Registreerumine
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <span className="text-amber-500 font-bold text-xs uppercase tracking-widest bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          Veebibroneering 24/7
        </span>
        <h1 className="text-4xl md:text-5xl font-black mt-6 mb-4 leading-tight">
          Teie auto hooldus <br/><span className="text-amber-500">ilma järjekordadeta</span>
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto">
          Valige teenus, sobiv aeg ja kinnitage broneering vaid mõne klikiga.
        </p>
      </section>

      {/* Booking Form Section */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div className="bg-slate-800/50 border border-slate-700/60 p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur">
          <h2 className="text-2xl font-bold mb-6 border-b border-slate-700/80 pb-4">Aja broneerimine</h2>

          {!user ? (
            /* Блок призыва к авторизации для гостей */
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-8 text-center my-4">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-xl font-bold mb-2">Broneerimiseks logi sisse</h3>
              <p className="text-slate-400 text-sm mb-6">
                Aja broneerimiseks peate olema süsteemi sisse logitud või looma uue konto.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  onClick={() => { setIsRegister(false); setIsAuthOpen(true); }}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
                >
                  Logi sisse
                </button>
                <button 
                  onClick={() => { setIsRegister(true); setIsAuthOpen(true); }}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition"
                >
                  Loo konto
                </button>
              </div>
            </div>
          ) : (
            /* Форма бронирования доступная только авторизованным */
            <form onSubmit={handleBooking} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Teenus</label>
                <select 
                  value={service} 
                  onChange={(e) => setService(e.target.value)}
                  required 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:border-amber-500 focus:outline-none transition"
                >
                  <option value="">Valige teenus...</option>
                  <option value="diag">Arvutidiagnostika — 25 €</option>
                  <option value="oil">Õli ja filtrite vahetus — 45 €</option>
                  <option value="brakes">Pidurite hooldus — 60 €</option>
                  <option value="full">Täielik tehnohooldus — 120 €</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Kuupäev</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    required 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:border-amber-500 focus:outline-none transition" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Aeg</label>
                  <select 
                    value={time} 
                    onChange={(e) => setTime(e.target.value)}
                    required 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:border-amber-500 focus:outline-none transition"
                  >
                    <option value="09:00">09:00</option>
                    <option value="11:00">11:00</option>
                    <option value="14:00">14:00</option>
                    <option value="16:00">16:00</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Auto mark ja mudel</label>
                  <input 
                    type="text" 
                    placeholder="nt Audi A6" 
                    value={carModel} 
                    onChange={(e) => setCarModel(e.target.value)}
                    required 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:border-amber-500 focus:outline-none transition" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Registreerimisnumber</label>
                  <input 
                    type="text" 
                    placeholder="nt 777 ABC" 
                    value={carNumber} 
                    onChange={(e) => setCarNumber(e.target.value)}
                    required 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:border-amber-500 focus:outline-none transition" 
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 rounded-xl transition shadow-xl shadow-amber-500/20 mt-4">
                Maksma (Stripe)
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Auth Modal Window */}
      {isAuthOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setIsAuthOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
            <h3 className="text-2xl font-bold mb-6 text-white">
              {isRegister ? 'Konto loomine' : 'Sisselogimine'}
            </h3>
            
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-lg mb-4">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">E-post</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Parool</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none" 
                />
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-lg transition mt-2">
                {isRegister ? 'Registreeru' : 'Logi sisse'}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-800 pt-4">
              <button 
                onClick={() => { setIsRegister(!isRegister); setAuthError(''); }} 
                className="text-xs text-amber-500 hover:underline"
              >
                {isRegister ? 'On juba konto? Logi sisse' : 'Puudub konto? Registreeru'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}