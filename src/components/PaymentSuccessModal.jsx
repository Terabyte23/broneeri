import { CheckCircle2, Calendar, Car, Tag, Receipt } from 'lucide-react';

export default function PaymentSuccessModal({ booking, onClose }) {
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

  const serviceName = serviceNameMap[booking.service] || booking.service;
  const price = priceMap[booking.service] || 45;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-center p-8 relative">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none"></div>

        {/* Icon */}
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <span className="text-[11px] uppercase tracking-widest font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          Broneering kinnitatud ja tasutud
        </span>

        <h3 className="text-2xl font-black text-white mt-3 mb-1.5 tracking-tight">
          Makse edukalt sooritatud!
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          Teie aeg autoteeninduses on garanteeritud. Ootame teid kokkulepitud ajal.
        </p>

        {/* Digital Voucher Receipt */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 text-left space-y-2.5 mb-6 text-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-500" />
              <span>Teenus:</span>
            </span>
            <span className="text-zinc-100 font-semibold">{serviceName}</span>
          </div>

          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>Aeg:</span>
            </span>
            <span className="text-zinc-100 font-semibold">{booking.booking_date}</span>
          </div>

          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-zinc-500" />
              <span>Sõiduk:</span>
            </span>
            <span className="text-zinc-100 font-semibold">{booking.car_model} ({booking.car_number})</span>
          </div>

          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-zinc-500" />
              <span>Kood:</span>
            </span>
            <span className="text-zinc-300 font-mono">{booking.id}</span>
          </div>

          <div className="border-t border-zinc-800/80 pt-2.5 flex justify-between items-center text-sm font-bold">
            <span className="text-zinc-300">Tasutud:</span>
            <span className="text-emerald-400 text-base">{price}.00 €</span>
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer text-sm"
        >
          Sulge ja vaata broneeringuid
        </button>
      </div>
    </div>
  );
}
