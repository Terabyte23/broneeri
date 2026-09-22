import { useState, useEffect, useMemo } from 'react';
import pb from './lib/pocketbase';
import PaymentModal from './components/PaymentModal';
import PaymentSuccessModal from './components/PaymentSuccessModal';
import { SERVICES, SERVICE_PRICES, AVAILABLE_TIME_SLOTS } from './constants/services';
import { 
  Wrench, 
  Droplets, 
  Disc, 
  ShieldCheck, 
  CreditCard, 
  AlertCircle, 
  ArrowRight,
  RefreshCw,
  X,
  Trash2,
  CheckCircle2,
  Lock
} from 'lucide-react';

const serviceIcons = {
  diag: Wrench,
  oil: Droplets,
  brakes: Disc,
  full: ShieldCheck,
};

// Helper: Get today's date formatted as YYYY-MM-DD
const getTodayDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  const currentUser = pb.authStore.record || pb.authStore.model;
  const [user, setUser] = useState(currentUser);
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'my-bookings'
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Booking form state
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [service, setService] = useState('oil');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Latest booking confirmation card
  const [lastConfirmedBooking, setLastConfirmedBooking] = useState(null);

  // Bookings list state
  const [myBookings, setMyBookings] = useState([]);
  const [allBookedSlots, setAllBookedSlots] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Payment modals state
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const [paymentSuccessBooking, setPaymentSuccessBooking] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', text: '' }

  const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK || '';

  // Fetch user's own bookings
  const fetchMyBookings = async () => {
    if (!pb.authStore.isValid) return;
    try {
      setLoadingBookings(true);
      const records = await pb.collection('bookings').getFullList({
        sort: '-created',
      });
      setMyBookings(records);
    } catch (err) {
      console.error('Broneeringute laadimine ebaõnnestus:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Fetch all bookings to determine taken slots
  const fetchOccupiedSlots = async () => {
    try {
      const records = await pb.collection('bookings').getFullList({
        fields: 'id,booking_date,status',
      });
      setAllBookedSlots(records.filter((r) => r.status !== 'cancelled'));
    } catch (err) {
      console.error('Aegade kontrolli viga:', err);
    }
  };

  // Occupied slots for the chosen date
  const occupiedSlotsOnSelectedDate = useMemo(() => {
    if (!date) return [];
    return allBookedSlots
      .filter((b) => b.booking_date?.startsWith(date))
      .map((b) => b.booking_date?.split(' ')[1]?.slice(0, 5))
      .filter(Boolean);
  }, [date, allBookedSlots]);

  // Check if slot has already passed today
  const isSlotPastToday = (slot) => {
    if (date !== todayStr) return false;
    const now = new Date();
    const [h, m] = slot.split(':').map(Number);
    const slotDate = new Date();
    slotDate.setHours(h, m, 0, 0);
    return slotDate < now;
  };

  // Check if entire day is fully booked
  const isDayFullyBooked = useMemo(() => {
    if (!date) return false;
    return AVAILABLE_TIME_SLOTS.every((slot) => {
      const isOcc = occupiedSlotsOnSelectedDate.includes(slot);
      let isPast = false;
      if (date === todayStr) {
        const now = new Date();
        const [h, m] = slot.split(':').map(Number);
        const slotDate = new Date();
        slotDate.setHours(h, m, 0, 0);
        isPast = slotDate < now;
      }
      return isOcc || isPast;
    });
  }, [date, occupiedSlotsOnSelectedDate, todayStr]);

  // Select first available slot when date changes
  useEffect(() => {
    if (isDayFullyBooked) {
      setTime('');
      return;
    }

    const isCurrentTimeUnavailable =
      !time ||
      occupiedSlotsOnSelectedDate.includes(time) ||
      (date === todayStr && (() => {
        const now = new Date();
        const [h, m] = time.split(':').map(Number);
        const slotDate = new Date();
        slotDate.setHours(h, m, 0, 0);
        return slotDate < now;
      })());

    if (isCurrentTimeUnavailable) {
      const firstAvailable = AVAILABLE_TIME_SLOTS.find((slot) => {
        if (occupiedSlotsOnSelectedDate.includes(slot)) return false;
        if (date === todayStr) {
          const now = new Date();
          const [h, m] = slot.split(':').map(Number);
          const slotDate = new Date();
          slotDate.setHours(h, m, 0, 0);
          return slotDate >= now;
        }
        return true;
      });
      setTime(firstAvailable || '');
    }
  }, [date, occupiedSlotsOnSelectedDate, isDayFullyBooked, todayStr]);

  useEffect(() => {
    const activeUser = pb.authStore.record || pb.authStore.model;
    setUser(activeUser);
    if (pb.authStore.isValid) {
      fetchMyBookings();
    }
    fetchOccupiedSlots();

    const unsub = pb.authStore.onChange(() => {
      const current = pb.authStore.record || pb.authStore.model;
      setUser(current);
      if (current) {
        fetchMyBookings();
      } else {
        setMyBookings([]);
      }
    });

    // Check payment redirect parameters (?payment=success&booking_id=...)
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const bookingId = params.get('booking_id') || params.get('client_reference_id');
    const sessionId = params.get('session_id');

    if (payment === 'success' || sessionId) {
      const processReturnSuccess = async () => {
        try {
          if (bookingId) {
            const updated = await pb.collection('bookings').update(bookingId, { status: 'paid' });
            setPaymentSuccessBooking(updated);
            setLastConfirmedBooking(updated);
          } else {
            const list = await pb.collection('bookings').getList(1, 1, {
              sort: '-created',
              filter: 'status = "pending"',
            });
            if (list.items.length > 0) {
              const updated = await pb.collection('bookings').update(list.items[0].id, { status: 'paid' });
              setPaymentSuccessBooking(updated);
              setLastConfirmedBooking(updated);
            }
          }
          fetchMyBookings();
          fetchOccupiedSlots();
        } catch (err) {
          console.error('Makse kinnitamise viga:', err);
        }
      };
      processReturnSuccess();

      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (payment === 'cancelled' || payment === 'cancel') {
      setNotification({
        type: 'warning',
        text: 'Makse tühistati. Saate broneeringu eest tasuda oma broneeringute nimekirjas.',
      });
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Realtime subscription: мгновенное обновление статуса при срабатывании вебхука
    let unsubBookings = null;
    pb.collection('bookings').subscribe('*', (e) => {
      fetchMyBookings();
      fetchOccupiedSlots();
      if (e.record && e.record.status === 'paid') {
        setLastConfirmedBooking((prev) => (prev?.id === e.record.id ? e.record : prev));
      }
    }).then((cleanup) => {
      unsubBookings = cleanup;
    }).catch(() => {
      // Игнорируем, если SSE соединение не поддерживается
    });

    return () => {
      unsub();
      if (unsubBookings) {
        unsubBookings();
      } else {
        pb.collection('bookings').unsubscribe('*').catch(() => {});
      }
    };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (isRegister && password.length < 8) {
      setAuthError('Parool peab olema vähemalt 8 tähemärki pikk.');
      return;
    }

    if (isRegister && password !== passwordConfirm) {
      setAuthError('Sisestatud paroolid ei kattu.');
      return;
    }

    setAuthLoading(true);
    try {
      if (isRegister) {
        await pb.collection('users').create({
          email,
          password,
          passwordConfirm,
        });
      }
      await pb.collection('users').authWithPassword(email, password);
      setIsAuthOpen(false);
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      fetchMyBookings();
    } catch (err) {
      console.error('Auth viga:', err);
      let msg = err.message;
      if (msg?.includes('Failed to authenticate')) {
        msg = 'Vale e-post või parool.';
      } else if (msg?.includes('validation_not_unique')) {
        msg = 'Selle e-posti aadressiga konto on juba registreeritud.';
      }
      setAuthError('Viga autoriseerimisel: ' + msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGithubAuth = async () => {
    setAuthError('');
    try {
      await pb.collection('users').authWithOAuth2({ provider: 'github' });
      setIsAuthOpen(false);
      fetchMyBookings();
    } catch (err) {
      console.error('GitHub OAuth viga:', err);
      let msg = err.message || 'Tundmatu viga';
      if (err.status === 404 || String(msg).includes('404')) {
        msg = 'GitHub rakendus on privaatne. GitHubi seadetes tuleb valida "Any account" või luua avalik OAuth App.';
      } else if (String(msg).includes('Missing or invalid provider')) {
        msg = 'GitHub sisselogimine pole PocketBase paneelis aktiveeritud.';
      }
      setAuthError('GitHubi autoriseerimine ebaõnnestus: ' + msg);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setUser(null);
    setMyBookings([]);
    setLastConfirmedBooking(null);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!pb.authStore.isValid) {
      setIsAuthOpen(true);
      return;
    }

    if (!date || date < todayStr) {
      alert('Palun valige kuupäev alates tänasest päevast.');
      return;
    }

    if (!time) {
      alert('Palun valige vaba kellaaeg.');
      return;
    }

    if (occupiedSlotsOnSelectedDate.includes(time) || isSlotPastToday(time)) {
      alert('Valitud kellaaeg on juba broneeritud või möödunud. Palun valige teine aeg.');
      return;
    }

    setBookingLoading(true);

    try {
      const activeUser = pb.authStore.record || pb.authStore.model;

      const bookingData = {
        user: activeUser?.id,
        service,
        booking_date: `${date} ${time}:00`,
        car_model: carModel.trim(),
        car_number: carNumber.trim().toUpperCase(),
        status: 'pending',
      };

      const record = await pb.collection('bookings').create(bookingData);

      // Instantly save to state and show prominent booking card
      setLastConfirmedBooking(record);
      setNotification({
        type: 'success',
        text: `Broneering edukalt kinnitatud kuupäevale ${date} kell ${time}!`,
      });

      // Clear inputs
      setCarModel('');
      setCarNumber('');

      // Refresh data
      await fetchMyBookings();
      await fetchOccupiedSlots();

      // If payment link configured, redirect
      if (paymentLink && !paymentLink.includes('test_...') && !paymentLink.includes('example')) {
        try {
          const checkoutUrl = new URL(paymentLink);
          checkoutUrl.searchParams.set('client_reference_id', record.id);
          if (activeUser?.email) {
            checkoutUrl.searchParams.set('prefilled_email', activeUser.email);
          }
          window.location.href = checkoutUrl.toString();
          return;
        } catch {
          window.location.href = paymentLink;
          return;
        }
      }

      // Open clean card payment modal for convenient payment
      setSelectedBookingForPayment(record);
    } catch (err) {
      alert('Viga broneeringu salvestamisel: ' + err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePayExisting = (booking) => {
    if (paymentLink && !paymentLink.includes('test_...') && !paymentLink.includes('example')) {
      try {
        const checkoutUrl = new URL(paymentLink);
        checkoutUrl.searchParams.set('client_reference_id', booking.id);
        const activeUser = pb.authStore.record || pb.authStore.model;
        if (activeUser?.email) {
          checkoutUrl.searchParams.set('prefilled_email', activeUser.email);
        }
        window.location.href = checkoutUrl.toString();
        return;
      } catch {
        window.location.href = paymentLink;
        return;
      }
    }
    setSelectedBookingForPayment(booking);
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Kas soovite selle broneeringu kindlasti tühistada?')) return;
    try {
      await pb.collection('bookings').delete(bookingId);
      if (lastConfirmedBooking?.id === bookingId) {
        setLastConfirmedBooking(null);
      }
      setNotification({
        type: 'success',
        text: 'Broneering on edukalt tühistatud.',
      });
      fetchMyBookings();
      fetchOccupiedSlots();
    } catch (err) {
      alert('Viga tühistamisel: ' + err.message);
    }
  };

  const selectedService = SERVICES.find((s) => s.id === service) || SERVICES[0];

  return (
    <div className="bg-[#09090b] text-zinc-100 min-h-screen font-sans flex flex-col justify-between">
      <div>
        {/* Minimalist Navigation */}
        <header className="border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
            {/* Brand Logo */}
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-lg text-white tracking-tight">
                Auto<span className="text-amber-400">Pro</span>
              </span>
              <span className="text-zinc-600 text-sm hidden sm:inline">|</span>
              <span className="text-zinc-400 text-xs hidden sm:inline font-normal">
                Autoteenindus
              </span>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 text-xs font-medium">
                    <button
                      onClick={() => setActiveTab('book')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        activeTab === 'book'
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      Uus broneering
                    </button>
                    <button
                      onClick={() => setActiveTab('my-bookings')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'my-bookings'
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      <span>Minu broneeringud</span>
                      {myBookings.length > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                          activeTab === 'my-bookings' ? 'bg-zinc-950 text-amber-400' : 'bg-zinc-800 text-zinc-200'
                        }`}>
                          {myBookings.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="text-xs text-zinc-400 hover:text-white transition px-2.5 py-1.5 rounded-lg border border-transparent hover:border-zinc-800 cursor-pointer"
                  >
                    Välju
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsRegister(false);
                    setIsAuthOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-sm"
                >
                  Sisselogimine
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Global Notification Banner */}
        {notification && (
          <div className="max-w-4xl mx-auto px-5 mt-4">
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/40 border border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{notification.text}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-zinc-400 hover:text-white text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="max-w-4xl mx-auto px-5 py-8">
          
          {/* PROMINENT ACTIVE BOOKING CARD (IF USER JUST BOOKED OR HAS ACTIVE BOOKING) */}
          {lastConfirmedBooking && (
            <div className="mb-8 bg-zinc-900/90 border-2 border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Teie broneering on kinnitatud!
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                      {SERVICES.find((s) => s.id === lastConfirmedBooking.service)?.name || lastConfirmedBooking.service}
                    </h3>
                  </div>
                </div>

                <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                  lastConfirmedBooking.status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {lastConfirmedBooking.status === 'paid' ? '✓ Tasutud' : 'Ootel maksmata'}
                </span>
              </div>

              {/* Booking Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 text-xs sm:text-sm mb-4">
                <div>
                  <span className="text-zinc-400 text-xs block mb-0.5">Aeg ja kuupäev:</span>
                  <strong className="text-white font-semibold">{lastConfirmedBooking.booking_date}</strong>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs block mb-0.5">Sõiduk:</span>
                  <strong className="text-white font-semibold">{lastConfirmedBooking.car_model}</strong>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs block mb-0.5">Registrinumber:</span>
                  <strong className="text-amber-400 font-mono font-semibold">{lastConfirmedBooking.car_number}</strong>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs block mb-0.5">Summa:</span>
                  <strong className="text-white font-bold">{SERVICE_PRICES[lastConfirmedBooking.service] || 45} €</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  Broneeringu kood: <span className="font-mono text-zinc-300">{lastConfirmedBooking.id}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  {lastConfirmedBooking.status !== 'paid' && (
                    <button
                      onClick={() => handlePayExisting(lastConfirmedBooking)}
                      className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow flex items-center gap-1.5"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Maksa kohe ({SERVICE_PRICES[lastConfirmedBooking.service] || 45} €)</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('my-bookings')}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                  >
                    Vaata kõiki broneeringuid
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: BOOKING FORM */}
          {activeTab === 'book' && (
            <div>
              {/* Title Section */}
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Aja broneerimine
                </h1>
                <p className="text-sm text-zinc-300 mt-1">
                  Valige teenus, sobiv kuupäev ja kellaaeg. Broneering kinnitatakse koheselt.
                </p>
              </div>

              {!user ? (
                /* Unauthenticated Callout */
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 text-center my-6">
                  <h2 className="text-lg font-bold text-white mb-2">
                    Broneerimiseks logige sisse
                  </h2>
                  <p className="text-zinc-300 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                    Aja broneerimiseks ja oma autoteeninduse ajaloo vaatamiseks palun logige sisse.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        setIsRegister(false);
                        setIsAuthOpen(true);
                      }}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-sm transition cursor-pointer"
                    >
                      Logi sisse parooliga
                    </button>
                    <button
                      onClick={handleGithubAuth}
                      className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Jätka GitHubiga
                    </button>
                  </div>
                </div>
              ) : (
                /* Booking Form */
                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  
                  {/* Step 1: Services Grid */}
                  <div>
                    <label className="block text-sm font-semibold text-zinc-200 mb-3">
                      1. Vali teenus
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SERVICES.map((s) => {
                        const IconComponent = serviceIcons[s.id] || Wrench;
                        const isSelected = service === s.id;

                        return (
                          <div
                            key={s.id}
                            onClick={() => setService(s.id)}
                            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500 text-white ring-1 ring-amber-500'
                                : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-amber-500 text-zinc-950 font-bold'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-white">{s.name}</div>
                                <div className="text-xs text-zinc-400 mt-0.5">{s.duration} • {s.desc}</div>
                              </div>
                            </div>
                            <div className="text-base font-bold text-amber-400 shrink-0">
                              {s.price} €
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Date & Time Slots */}
                  <div>
                    <label className="block text-sm font-semibold text-zinc-200 mb-3">
                      2. Vali kuupäev ja kellaaeg
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                      {/* Date Picker */}
                      <div className="sm:col-span-5">
                        <span className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Kuupäev (alates tänasest)
                        </span>
                        <input
                          type="date"
                          min={todayStr}
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none transition cursor-pointer"
                        />
                      </div>

                      {/* Time Slots */}
                      <div className="sm:col-span-7">
                        <span className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Kellaaeg
                        </span>

                        {isDayFullyBooked ? (
                          <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>Kõik ajad kuupäeval <strong>{date}</strong> on hõivatud. Palun valige teine päev.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {AVAILABLE_TIME_SLOTS.map((slot) => {
                              const isOccupied = occupiedSlotsOnSelectedDate.includes(slot);
                              const isPast = isSlotPastToday(slot);
                              const isUnavailable = isOccupied || isPast;
                              const isSelected = time === slot;

                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={isUnavailable}
                                  onClick={() => setTime(slot)}
                                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500 text-zinc-950 font-extrabold shadow ring-2 ring-amber-400'
                                      : isUnavailable
                                      ? 'bg-zinc-950/90 border border-zinc-900 text-zinc-600 line-through cursor-not-allowed opacity-40'
                                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:border-zinc-600'
                                  }`}
                                >
                                  <span className="text-sm">{slot}</span>
                                  <span className="text-[10px] font-normal mt-0.5">
                                    {isOccupied ? 'Hõivatud' : isPast ? 'Möödunud' : 'Vaba'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Vehicle Data */}
                  <div>
                    <label className="block text-sm font-semibold text-zinc-200 mb-3">
                      3. Sõiduki andmed
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <span className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Auto mark ja mudel
                        </span>
                        <input
                          type="text"
                          placeholder="nt Audi A6 3.0 TDI"
                          value={carModel}
                          onChange={(e) => setCarModel(e.target.value)}
                          required
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none transition"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Registrinumber
                        </span>
                        <input
                          type="text"
                          placeholder="123 ABC"
                          value={carNumber}
                          onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
                          required
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none transition uppercase font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary & Submit */}
                  <div className="pt-2">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between mb-4">
                      <div>
                        <span className="text-xs text-zinc-400 block">Kokkuvõte:</span>
                        <span className="text-sm font-semibold text-white">
                          {selectedService.name} • {date} kell {time || '—'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-400 block">Hind:</span>
                        <span className="text-xl font-bold text-amber-400">{selectedService.price} €</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={bookingLoading || isDayFullyBooked || !time}
                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold py-3.5 rounded-xl transition cursor-pointer text-sm shadow flex items-center justify-center gap-2"
                    >
                      {bookingLoading ? (
                        <span>Salvestamine...</span>
                      ) : isDayFullyBooked ? (
                        <span>Kuupäev on täis — Vali teine päev</span>
                      ) : !time ? (
                        <span>Vali kellaaeg</span>
                      ) : (
                        <>
                          <span>Kinnita broneering ({selectedService.price} €)</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: MY BOOKINGS */}
          {activeTab === 'my-bookings' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Minu broneeringud
                  </h1>
                  <p className="text-sm text-zinc-300 mt-1">
                    Teie aktiivsed ja varasemad broneeringud
                  </p>
                </div>
                <button
                  onClick={() => {
                    fetchMyBookings();
                    fetchOccupiedSlots();
                  }}
                  className="text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Värskenda</span>
                </button>
              </div>

              {loadingBookings ? (
                <div className="text-center py-12 text-zinc-400 text-sm">Laadimine...</div>
              ) : myBookings.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                  <p className="text-zinc-300 text-sm mb-4">Teil pole veel ühtegi broneeringut.</p>
                  <button
                    onClick={() => setActiveTab('book')}
                    className="px-4 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Broneeri aeg kohe
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myBookings.map((b) => {
                    const sInfo = SERVICES.find((s) => s.id === b.service);
                    const sPrice = sInfo?.price || SERVICE_PRICES[b.service] || 45;
                    const sName = sInfo?.name || b.service;

                    return (
                      <div
                        key={b.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-zinc-700"
                      >
                        <div>
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="font-bold text-white text-base">
                              {sName}
                            </span>
                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                              {sPrice} €
                            </span>
                          </div>
                          <div className="text-sm text-zinc-300 flex flex-wrap items-center gap-2">
                            <span>Aeg: <strong>{b.booking_date}</strong></span>
                            <span className="text-zinc-600">•</span>
                            <span>Sõiduk: <strong>{b.car_model}</strong> ({b.car_number})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span
                            className={`text-xs px-3 py-1 rounded-full font-bold ${
                              b.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : b.status === 'confirmed'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {b.status === 'paid'
                              ? '✓ Tasutud'
                              : b.status === 'confirmed'
                              ? 'Kinnitatud'
                              : 'Ootel maksmata'}
                          </span>

                          {b.status === 'pending' && (
                            <button
                              onClick={() => handlePayExisting(b)}
                              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Maksa ({sPrice} €)</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            title="Tühista broneering"
                            className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Clean Footer */}
      <footer className="border-t border-zinc-900 bg-[#09090b] py-6 text-center text-xs text-zinc-400">
        <div className="max-w-4xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 AutoPro • Autoteeninduse broneerimine</span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Turvaline broneering ja makse</span>
          </span>
        </div>
      </footer>

      {/* Payment Modal */}
      {selectedBookingForPayment && (
        <PaymentModal
          booking={selectedBookingForPayment}
          paymentLink={paymentLink}
          onClose={() => setSelectedBookingForPayment(null)}
          onSuccess={(updatedBooking) => {
            setSelectedBookingForPayment(null);
            setPaymentSuccessBooking(updatedBooking);
            setLastConfirmedBooking(updatedBooking);
            fetchMyBookings();
            fetchOccupiedSlots();
          }}
        />
      )}

      {/* Payment Success Receipt Modal */}
      {paymentSuccessBooking && (
        <PaymentSuccessModal
          booking={paymentSuccessBooking}
          onClose={() => setPaymentSuccessBooking(null)}
        />
      )}

      {/* Auth Modal Window */}
      {isAuthOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setIsAuthOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-1 text-white">
              {isRegister ? 'Loo konto' : 'Logi sisse'}
            </h3>
            <p className="text-xs text-zinc-300 mb-5">
              {isRegister
                ? 'Sisestage andmed uue konto loomiseks'
                : 'Sisestage oma e-post ja parool'}
            </p>

            {authError && (
              <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs p-3 rounded-xl mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              onClick={handleGithubAuth}
              type="button"
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-semibold py-2.5 rounded-xl transition mb-4 flex items-center justify-center gap-2.5 border border-zinc-800 cursor-pointer text-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Jätka GitHubiga
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-zinc-800 w-full"></div>
              <span className="bg-zinc-950 px-3 text-xs text-zinc-400 uppercase">
                või e-postiga
              </span>
              <div className="border-t border-zinc-800 w-full"></div>
            </div>

            <form onSubmit={handleAuth} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">E-post</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="kasutaja@example.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-200 mb-1">
                  Parool {isRegister && <span className="text-zinc-400 font-normal">(vähemalt 8 tähte)</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>

              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-200 mb-1">
                    Kinnita parool
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none transition"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-2.5 rounded-xl transition mt-1 cursor-pointer text-sm"
              >
                {authLoading ? 'Palun oodake...' : isRegister ? 'Loo konto' : 'Logi sisse'}
              </button>
            </form>

            <div className="mt-5 text-center border-t border-zinc-900 pt-3">
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setAuthError('');
                  setPasswordConfirm('');
                }}
                className="text-xs text-amber-400 hover:underline cursor-pointer"
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
