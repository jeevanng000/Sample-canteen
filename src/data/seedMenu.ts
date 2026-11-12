import type { CanteenSettings, MenuItem } from '../utils/canteenLogic';

function makeSquareDishPhotoUri(
  bgStart: string,
  bgEnd: string,
  accentColor: string,
  plateRimColor: string,
  illustrationSvg: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="46%" r="54%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.34" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#15803d" />
        <stop offset="50%" stop-color="#166534" />
        <stop offset="100%" stop-color="#14532d" />
      </linearGradient>
    </defs>
    <rect width="320" height="320" rx="36" fill="url(#bg)" />
    <rect width="320" height="320" rx="36" fill="url(#glow)" />
    <!-- Subtle ambient table highlights -->
    <circle cx="270" cy="48" r="56" fill="${accentColor}" opacity="0.1" />
    <circle cx="46" cy="264" r="48" fill="#ffffff" opacity="0.06" />
    <!-- Plate drop shadow -->
    <circle cx="160" cy="162" r="118" fill="#000000" opacity="0.32" />
    <!-- Ceramic/Steel Darshini Platter -->
    <circle cx="160" cy="154" r="114" fill="${plateRimColor}" stroke="${accentColor}" stroke-width="2.5" stroke-opacity="0.5" />
    <circle cx="160" cy="154" r="102" fill="#f8fafc" opacity="0.94" />
    <!-- Fresh Banana Leaf Liner -->
    <circle cx="160" cy="154" r="92" fill="url(#leaf)" />
    <line x1="74" y1="154" x2="246" y2="154" stroke="#4ade80" stroke-width="1.4" opacity="0.32" />
    <!-- Gentle Steam Wisps -->
    <path d="M126 52 Q120 36 128 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.3" />
    <path d="M160 46 Q154 30 162 18" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.36" />
    <path d="M194 52 Q188 36 196 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.28" />
    <!-- Dish Illustration -->
    ${illustrationSvg}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_CANTEEN_SETTINGS: CanteenSettings = {
  isOpen: true,
  openTime: '08:00',
  closeTime: '22:00',
  ordersPerSlot: 4,
  noShowMinutes: 20,
  quietSlotDiscount: 3,
  testMode: true,
  rateLimitWindowMinutes: 60,
  maxOrdersPerWindow: 30,
};

export const SEED_SOUTH_INDIAN_MENU: MenuItem[] = [
  {
    id: 'item_masala_dosa',
    name: 'Benne Masala Dosa',
    price: 55,
    category: 'Dosa & Idli',
    isVeg: true,
    dietaryBadge: 'Spicy',
    prepTimeMinutes: 8,
    available: true,
    description:
      'Crispy golden Bengaluru dosa roasted with fresh white butter (benne), spicy red chutney, and potato palya, served with coconut chutney & sambar.',
    photo: makeSquareDishPhotoUri(
      '#78350f',
      '#451a03',
      '#fbbf24',
      '#fef3c7',
      `<!-- Chutney & Bengaluru Dip Katoris -->
       <circle cx="116" cy="106" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="116" cy="106" r="16" fill="#f1f5f9"/>
       <circle cx="116" cy="106" r="3" fill="#15803d"/>
       <circle cx="164" cy="96" r="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="164" cy="96" r="18" fill="#16a34a" opacity="0.28"/>
       <circle cx="164" cy="96" r="14" fill="#dcfce7"/>
       <circle cx="210" cy="110" r="21" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="210" cy="110" r="15" fill="#dc2626"/>
       <!-- Crispy Golden Benne Masala Dosa Fold -->
       <path d="M72 192 Q160 124 248 164 L236 208 Q158 176 82 216 Z" fill="#d97706" stroke="#fef08a" stroke-width="3"/>
       <path d="M88 194 Q160 146 234 176" fill="none" stroke="#92400e" stroke-width="2.5" stroke-dasharray="6 4"/>
       <!-- Melting White Benne (Butter) Dollop on Top -->
       <ellipse cx="162" cy="168" rx="18" ry="11" fill="#fffbeb" opacity="0.95"/>
       <circle cx="162" cy="166" r="7" fill="#ffffff"/>
       <!-- Potato Palya Peek -->
       <circle cx="240" cy="184" r="11" fill="#facc15"/>
       <circle cx="242" cy="182" r="2.5" fill="#15803d"/>`
    ),
  },
  {
    id: 'item_idli_sambar',
    name: 'Thatte Idli with Benne & Podi',
    price: 35,
    category: 'Dosa & Idli',
    isVeg: true,
    dietaryBadge: 'High Protein',
    prepTimeMinutes: 5,
    available: true,
    description:
      'Soft plate-steamed local Thatte Idli topped with fresh white butter (benne) and roasted chutney podi, served piping hot with coconut chutney & sambar.',
    photo: makeSquareDishPhotoUri(
      '#065f46',
      '#064e3b',
      '#34d399',
      '#ecfdf5',
      `<!-- Sambar & Coconut Chutney Bowls -->
       <circle cx="118" cy="98" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="118" cy="98" r="16" fill="#ea580c"/>
       <circle cx="202" cy="98" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="202" cy="98" r="16" fill="#f8fafc"/>
       <!-- Large Round Plate-Sized Thatte Idli -->
       <circle cx="160" cy="174" r="56" fill="#ffffff" stroke="#e2e8f0" stroke-width="4"/>
       <circle cx="160" cy="174" r="46" fill="#f8fafc"/>
       <!-- Generous Chutney Podi & White Benne Cube -->
       <circle cx="160" cy="174" r="32" fill="#ea580c" opacity="0.45"/>
       <circle cx="144" cy="164" r="5" fill="#dc2626" opacity="0.7"/>
       <circle cx="176" cy="182" r="5" fill="#dc2626" opacity="0.7"/>
       <rect x="148" y="162" width="24" height="20" rx="6" fill="#fffbeb" stroke="#fde68a" stroke-width="2"/>`
    ),
  },
  {
    id: 'item_onion_uttapam',
    name: 'Akki Rotti & Kempu Chutney',
    price: 50,
    category: 'Dosa & Idli',
    isVeg: true,
    dietaryBadge: 'Spicy',
    prepTimeMinutes: 8,
    available: true,
    description:
      'Homestyle Bengaluru spiced rice-flour flatbread griddled crisp with fresh dill leaves (sabsige soppu), chopped onions, grated carrot, cumin & red garlic chutney.',
    photo: makeSquareDishPhotoUri(
      '#1e40af',
      '#172554',
      '#60a5fa',
      '#eff6ff',
      `<!-- Crisp Spiced Akki Rotti Disc -->
       <circle cx="160" cy="162" r="66" fill="#fef3c7" stroke="#d97706" stroke-width="5"/>
       <circle cx="160" cy="162" r="54" fill="#fde68a"/>
       <!-- Center Rotti Dimple & Butter -->
       <circle cx="160" cy="162" r="10" fill="#ffffff"/>
       <!-- Dill Leaves (Sabsige), Carrot & Shallots -->
       <circle cx="136" cy="142" r="5.5" fill="#15803d"/>
       <circle cx="178" cy="138" r="5.5" fill="#ea580c"/>
       <circle cx="138" cy="178" r="5.5" fill="#ea580c"/>
       <circle cx="182" cy="174" r="5.5" fill="#15803d"/>
       <circle cx="152" cy="136" r="4.5" fill="#db2777"/>
       <circle cx="172" cy="184" r="4.5" fill="#db2777"/>
       <!-- Red Kempu Chutney Bowl -->
       <circle cx="214" cy="104" r="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="214" cy="104" r="14" fill="#dc2626"/>`
    ),
  },
  {
    id: 'item_medu_vada',
    name: 'Crispy Maddur Vada (2 Pcs)',
    price: 35,
    category: 'Snacks & Vada',
    isVeg: true,
    dietaryBadge: 'Vegan',
    prepTimeMinutes: 6,
    available: true,
    description:
      'Local favorite crispy onion, semolina, and rice-flour patties seasoned with curry leaves, crushed pepper & toasted sesame, served with fresh coconut chutney.',
    photo: makeSquareDishPhotoUri(
      '#9a3412',
      '#7c2d12',
      '#fb923c',
      '#ffedd5',
      `<!-- Fresh Coconut Chutney Katori -->
       <circle cx="160" cy="100" r="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="160" cy="100" r="18" fill="#f8fafc"/>
       <circle cx="160" cy="100" r="3.5" fill="#15803d"/>
       <!-- Two Golden Crispy Flat Maddur Vada Discs -->
       <circle cx="122" cy="176" r="38" fill="#b45309" stroke="#f59e0b" stroke-width="4"/>
       <circle cx="122" cy="176" r="28" fill="#d97706"/>
       <circle cx="198" cy="176" r="38" fill="#92400e" stroke="#f59e0b" stroke-width="4"/>
       <circle cx="198" cy="176" r="28" fill="#b45309"/>
       <!-- Onion, Sesame & Curry Leaf Flecks -->
       <circle cx="112" cy="166" r="3.5" fill="#fef3c7"/>
       <circle cx="132" cy="184" r="3.5" fill="#14532d"/>
       <circle cx="188" cy="166" r="3.5" fill="#fef3c7"/>
       <circle cx="206" cy="184" r="3.5" fill="#14532d"/>`
    ),
  },
  {
    id: 'item_chow_chow_bath',
    name: 'Chow Chow Bath (Khara & Kesari)',
    price: 50,
    category: 'Snacks & Vada',
    isVeg: true,
    dietaryBadge: 'Spicy',
    prepTimeMinutes: 6,
    available: true,
    description:
      'Classic Bengaluru canteen combo: savory spiced vegetable rava Khara Bath served side-by-side with sweet saffron Kesari Bath and coconut chutney.',
    photo: makeSquareDishPhotoUri(
      '#7c2d12',
      '#431407',
      '#fbbf24',
      '#fef3c7',
      `<!-- Coconut Chutney Top Scoop -->
       <circle cx="160" cy="102" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="160" cy="102" r="16" fill="#f8fafc"/>
       <!-- Left Scoop: Savory Khara Bath -->
       <circle cx="118" cy="174" r="40" fill="#fde047" stroke="#eab308" stroke-width="3.5"/>
       <circle cx="108" cy="166" r="5" fill="#16a34a"/>
       <circle cx="126" cy="180" r="5" fill="#dc2626"/>
       <!-- Right Scoop: Saffron Kesari Bath -->
       <circle cx="202" cy="174" r="40" fill="#f97316" stroke="#ea580c" stroke-width="3.5"/>
       <circle cx="196" cy="166" r="5" fill="#fef08a"/>
       <circle cx="210" cy="180" r="5" fill="#fef08a"/>`
    ),
  },
  {
    id: 'item_veg_biryani',
    name: 'Bisi Bele Bath & Kara Boondi',
    price: 55,
    category: 'Rice & Meals',
    isVeg: true,
    dietaryBadge: 'High Protein',
    prepTimeMinutes: 8,
    available: true,
    description:
      'Hot Karnataka lentil-rice medley slow-simmered with tamarind, garden vegetables & roasted spice blend, topped with crunchy Kara Boondi and ghee.',
    photo: makeSquareDishPhotoUri(
      '#854d0e',
      '#422006',
      '#facc15',
      '#fef9c3',
      `<!-- Kara Boondi & Raita Side Bowl -->
       <circle cx="216" cy="104" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="216" cy="104" r="16" fill="#facc15"/>
       <!-- Rich Bisi Bele Bath Mound -->
       <ellipse cx="152" cy="168" rx="68" ry="54" fill="#c2410c" stroke="#9a3412" stroke-width="4"/>
       <ellipse cx="152" cy="162" rx="54" ry="40" fill="#ea580c"/>
       <!-- Crunchy Golden Kara Boondi & Cashews on Top -->
       <circle cx="134" cy="152" r="6.5" fill="#facc15"/>
       <circle cx="152" cy="148" r="6.5" fill="#facc15"/>
       <circle cx="168" cy="154" r="6.5" fill="#facc15"/>
       <circle cx="144" cy="168" r="6.5" fill="#facc15"/>
       <circle cx="162" cy="172" r="6.5" fill="#fef08a"/>
       <circle cx="128" cy="170" r="5.5" fill="#16a34a"/>`
    ),
  },
  {
    id: 'item_chicken_biryani',
    name: 'Donne Chicken Biryani',
    price: 110,
    category: 'Rice & Meals',
    isVeg: false,
    dietaryBadge: 'High Protein',
    prepTimeMinutes: 12,
    available: true,
    description:
      'Local Bengaluru style short-grain Jeera Samba rice cooked in fresh mint, coriander & green-chilli masala with tender chicken & boiled egg in a palm-leaf donne.',
    photo: makeSquareDishPhotoUri(
      '#14532d',
      '#052e16',
      '#4ade80',
      '#dcfce7',
      `<!-- Eco Palm-Leaf Donne Bowl & Green Herb Jeera Samba Rice -->
       <ellipse cx="156" cy="166" rx="72" ry="56" fill="#78350f" stroke="#451a03" stroke-width="5"/>
       <ellipse cx="156" cy="160" rx="60" ry="44" fill="#15803d"/>
       <ellipse cx="156" cy="158" rx="50" ry="36" fill="#16a34a"/>
       <!-- Spiced Chicken Pieces -->
       <circle cx="128" cy="154" r="15" fill="#9a3412" stroke="#fef08a" stroke-width="2"/>
       <circle cx="160" cy="146" r="15" fill="#9a3412" stroke="#fef08a" stroke-width="2"/>
       <circle cx="144" cy="176" r="14" fill="#9a3412" stroke="#fef08a" stroke-width="2"/>
       <!-- Halved Boiled Egg -->
       <ellipse cx="192" cy="168" rx="18" ry="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
       <circle cx="192" cy="168" r="8" fill="#facc15"/>`
    ),
  },
  {
    id: 'item_ven_pongal',
    name: 'Lemon Chitranna (Peanut Rice)',
    price: 45,
    category: 'Rice & Meals',
    isVeg: true,
    dietaryBadge: 'Vegan',
    prepTimeMinutes: 6,
    available: true,
    description:
      'Tangy turmeric-tempered rice tossed with crunchy roasted groundnuts, chana dal, curry leaves, green chillies, fresh grated coconut & a squeeze of lime.',
    photo: makeSquareDishPhotoUri(
      '#3f6212',
      '#1a2e05',
      '#a3e635',
      '#f7fee7',
      `<!-- Coconut Chutney Side -->
       <circle cx="212" cy="104" r="21" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
       <circle cx="212" cy="104" r="15" fill="#f8fafc"/>
       <!-- Bright Golden Chitranna Mound -->
       <circle cx="152" cy="166" r="56" fill="#facc15" stroke="#eab308" stroke-width="4"/>
       <circle cx="152" cy="162" r="44" fill="#fde047"/>
       <!-- Roasted Peanuts, Curry Leaves & Grated Coconut -->
       <ellipse cx="136" cy="148" rx="7" ry="4.5" fill="#9a3412"/>
       <ellipse cx="168" cy="154" rx="7" ry="4.5" fill="#9a3412"/>
       <ellipse cx="150" cy="176" rx="7" ry="4.5" fill="#9a3412"/>
       <circle cx="142" cy="164" r="4" fill="#15803d"/>
       <circle cx="164" cy="170" r="4" fill="#15803d"/>`
    ),
  },
  {
    id: 'item_curd_rice',
    name: 'Mosaranna (Tempered Curd Rice)',
    price: 40,
    category: 'Rice & Meals',
    isVeg: true,
    dietaryBadge: 'High Protein',
    prepTimeMinutes: 5,
    available: true,
    description:
      'Chilled creamy curd rice tempered with mustard seeds, ginger, curry leaves, fresh pomegranate pearls, coriander & spicy mango pickle.',
    photo: makeSquareDishPhotoUri(
      '#0f172a',
      '#1e293b',
      '#38bdf8',
      '#f1f5f9',
      `<!-- Mango Pickle Side -->
       <circle cx="216" cy="112" r="18" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
       <!-- Creamy White Mosaranna Mound -->
       <circle cx="152" cy="164" r="58" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
       <circle cx="152" cy="160" r="46" fill="#f8fafc"/>
       <!-- Ruby Pomegranate Pearls & Curry Leaves -->
       <circle cx="136" cy="148" r="5.5" fill="#e11d48"/>
       <circle cx="164" cy="146" r="5.5" fill="#e11d48"/>
       <circle cx="152" cy="164" r="5.5" fill="#e11d48"/>
       <circle cx="138" cy="176" r="5.5" fill="#e11d48"/>
       <circle cx="168" cy="172" r="5.5" fill="#e11d48"/>
       <circle cx="152" cy="148" r="4" fill="#15803d"/>`
    ),
  },
  {
    id: 'item_mysore_bonda',
    name: 'Mangalore Buns (2 Pcs)',
    price: 40,
    category: 'Snacks & Vada',
    isVeg: true,
    dietaryBadge: 'Vegan',
    prepTimeMinutes: 8,
    available: false,
    description:
      'Fluffy, mildly sweet golden banana pooris served with spiced coconut chutney and sagu. (Currently Sold Out for this batch).',
    photo: makeSquareDishPhotoUri(
      '#334155',
      '#0f172a',
      '#94a3b8',
      '#e2e8f0',
      `<!-- Two Fluffy Golden Mangalore Buns -->
       <ellipse cx="132" cy="162" rx="36" ry="30" fill="#d97706" stroke="#b45309" stroke-width="3"/>
       <ellipse cx="188" cy="168" rx="36" ry="30" fill="#b45309" stroke="#92400e" stroke-width="3"/>`
    ),
  },
  {
    id: 'item_filter_coffee',
    name: 'Filter Kaapi',
    price: 20,
    category: 'Beverages',
    isVeg: true,
    dietaryBadge: 'High Protein',
    prepTimeMinutes: 3,
    available: true,
    description:
      'Freshly brewed South Indian filter coffee frothed high with hot boiled milk in a traditional brass davara-tumbler.',
    photo: makeSquareDishPhotoUri(
      '#451a03',
      '#271001',
      '#fbbf24',
      '#fef3c7',
      `<!-- Brass Davara Saucer -->
       <ellipse cx="160" cy="196" rx="64" ry="24" fill="#eab308" stroke="#a16207" stroke-width="4"/>
       <ellipse cx="160" cy="192" rx="52" ry="16" fill="#ca8a04"/>
       <!-- Brass Tumbler -->
       <rect x="126" y="114" width="68" height="76" rx="10" fill="#facc15" stroke="#a16207" stroke-width="4"/>
       <!-- Rich Kaapi & Frothy White Foam Crown -->
       <ellipse cx="160" cy="116" rx="34" ry="12" fill="#78350f" stroke="#a16207" stroke-width="2"/>
       <ellipse cx="160" cy="114" rx="28" ry="9" fill="#ffffff"/>
       <circle cx="150" cy="113" r="4" fill="#fef3c7"/>
       <circle cx="168" cy="115" r="3.5" fill="#fef3c7"/>`
    ),
  },
  {
    id: 'item_badam_milk',
    name: 'Hot Badam Milk',
    price: 30,
    category: 'Beverages',
    isVeg: true,
    dietaryBadge: 'High Protein',
    prepTimeMinutes: 4,
    available: true,
    description:
      'Comforting warm milk slow-simmered with crushed almonds, green cardamom, and saffron strands.',
    photo: makeSquareDishPhotoUri(
      '#713f12',
      '#3b1d06',
      '#fde047',
      '#fef9c3',
      `<!-- Traditional Cup of Golden Saffron Badam Milk -->
       <ellipse cx="160" cy="196" rx="58" ry="20" fill="#fde047" stroke="#ca8a04" stroke-width="3"/>
       <rect x="124" y="110" width="72" height="82" rx="14" fill="#fef08a" stroke="#eab308" stroke-width="4"/>
       <ellipse cx="160" cy="114" rx="34" ry="11" fill="#fde047" stroke="#ca8a04" stroke-width="2"/>
       <!-- Saffron Strands & Sliced Almonds -->
       <line x1="148" y1="112" x2="156" y2="116" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
       <line x1="164" y1="115" x2="172" y2="111" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
       <ellipse cx="146" cy="116" rx="5" ry="2.5" fill="#d97706"/>
       <ellipse cx="168" cy="116" rx="5" ry="2.5" fill="#d97706"/>`
    ),
  },
];

export const LAST_7_DAYS_SALES_SEED = [
  { day: 'Fri', date: 'Oct 17', orders: 64, revenue: 4280 },
  { day: 'Sat', date: 'Oct 18', orders: 52, revenue: 3510 },
  { day: 'Sun', date: 'Oct 19', orders: 38, revenue: 2490 },
  { day: 'Mon', date: 'Oct 20', orders: 89, revenue: 5940 },
  { day: 'Tue', date: 'Oct 21', orders: 94, revenue: 6320 },
  { day: 'Wed', date: 'Oct 22', orders: 82, revenue: 5480 },
  { day: 'Thu (Today)', date: 'Oct 23', orders: 18, revenue: 1245 },
];
