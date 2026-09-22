import { useState } from 'react';
import pb from '../lib/pocketbase';
import { Lock, ShieldCheck, CreditCard, X, Check } from 'lucide-react';

export default function PaymentModal({ booking, onClose, onSuccess, paymentLink }) {
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [cardName, setCardName] = useState('Aleksandr Gritsenko');

  if (!booking) return null;

  const priceMap = {
    diag: 25,
    oil: 45,
    brakes: 60,
    full: 120,
  };

  const serviceNameMap = {
    diag: 'Arvutidiagnostika',
    oil: 'Õli ja filtrite vahetus',
    brakes: 'Pidurite hooldus',
    full: 'Täielik tehnohooldus',
  };

  const servicePrice = priceMap[booking.service] || 45;
  const serviceName = serviceNameMap[booking.service] || booking.service;

  // External payment link redirect if configured
  const handleExternalRedirect = () => {
    if (!paymentLink) return;
    try {
      const checkoutUrl = new URL(paymentLink);
      checkoutUrl.searchParams.set('client_reference_id', booking.id);
      const user = pb.authStore.record || pb.authStore.model;
      if (user?.email) {
        checkoutUrl.searchParams.set('prefilled_email', user.email);
      }
      window.location.href = checkoutUrl.toString();
    } catch {
      window.location.href = paymentLink;
    }
  };

  const handleSimulatedPayment = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 900));

      const updated = await pb.collection('bookings').update(booking.id, {
        status: 'paid',
      });

      if (onSuccess) {
        onSuccess(updated);
      }
    } catch (err) {
      alert('Viga makse sooritamisel: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Turvaline kaardimakse</h3>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>SSL 256-bit turvatud ühendus</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Summary */}
        <div className="px-6 py-4 bg-zinc-900/40 border-b border-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-white text-sm">{serviceName}</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {booking.car_model} ({booking.car_number}) • {booking.booking_date}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-amber-400">{servicePrice} €</div>
              <div className="text-[10px] text-zinc-500 uppercase font-medium">Koos KM-ga</div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSimulatedPayment} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Kaardiomaniku nimi
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none transition"
              placeholder="Eesnimi Perekonnanimi"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Kaardinumber</span>
              <span className="text-[11px] text-amber-400/80 font-mono">Testkaart aktiivne</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono focus:border-amber-500 focus:outline-none transition"
                placeholder="4242 4242 4242 4242"
              />
              <CreditCard className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Kehtivus (KK/AA)</label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                required
                placeholder="MM/YY"
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-amber-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">CVC turvakood</label>
              <input
                type="password"
                maxLength={4}
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value)}
                required
                placeholder="•••"
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-amber-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-zinc-950" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Makse töötlemine...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Kinnita ja maksa {servicePrice}.00 €</span>
                </>
              )}
            </button>

            {paymentLink && (
              <button
                type="button"
                onClick={handleExternalRedirect}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs py-2.5 rounded-xl border border-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Mine välisele makselehele</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-center text-zinc-400 pt-1">
            🔒 Kaardimakset kaitseb pangataseme krüpteering. Andmeid ei talletata.
          </p>
        </form>
      </div>
    </div>
  );
}
