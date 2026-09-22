export const SERVICES = [
  {
    id: 'diag',
    name: 'Arvutidiagnostika',
    price: 25,
    duration: '45 min',
    desc: 'Mootori ja elektroonika täielik veakoodide analüüs',
    icon: 'Wrench',
    popular: false,
  },
  {
    id: 'oil',
    name: 'Õli ja filtrite vahetus',
    price: 45,
    duration: '60 min',
    desc: 'Mootoriõli ja salongifiltrite professionaalne vahetus',
    icon: 'Droplets',
    popular: true,
  },
  {
    id: 'brakes',
    name: 'Pidurite hooldus',
    price: 60,
    duration: '90 min',
    desc: 'Klotside ja ketaste kulumise kontroll ning vahetus',
    icon: 'Disc',
    popular: false,
  },
  {
    id: 'full',
    name: 'Täielik tehnohooldus',
    price: 120,
    duration: '180 min',
    desc: 'Veermiku, vedelike ja mootori põhjalik ülevaatus',
    icon: 'ShieldCheck',
    popular: false,
  },
];

export const SERVICE_PRICES = {
  diag: 25,
  oil: 45,
  brakes: 60,
  full: 120,
};

export const AVAILABLE_TIME_SLOTS = ['09:00', '11:00', '14:00', '16:00'];
