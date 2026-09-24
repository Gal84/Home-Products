import type { ApartmentProfile, AptType, BedroomUse, Priority } from '../types';

/** One planned product. `p` is a mid-tier unit price in ₪ (Israeli retail, 2026). */
export interface ItemTpl {
  k: string;
  n: string;
  p: number;
  q?: number;
  pr?: Priority;
  note?: string;
}

export interface CategoryTpl {
  key: string;
  name: string;
  note?: string;
  color: string;
  items: ItemTpl[];
}

export const PALETTE = [
  '#B5522B', // terracotta
  '#6B6B3A', // olive
  '#C08A2E', // ochre
  '#46607A', // slate
  '#9A5B45', // clay
  '#7E8C6A', // sage
  '#6E4A5E', // plum
  '#8C7A5B', // sand
  '#2F6B66', // teal
  '#5A5048', // umber
];

const color = (i: number) => PALETTE[i % PALETTE.length];

export const BEDROOM_LABEL: Record<BedroomUse, string> = {
  master: 'חדר שינה הורים',
  kids: 'חדר ילדים',
  office: 'חדר עבודה',
  guest: 'חדר אורחים',
};

export const APT_TYPE_LABEL: Record<AptType, string> = {
  regular: 'דירה רגילה',
  garden: 'דירת גן',
  penthouse: 'פנטהאוז',
};

export function defaultBedrooms(rooms: number): BedroomUse[] {
  const n = Math.max(0, rooms - 1);
  const uses: BedroomUse[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) uses.push('master');
    else if (i === n - 1 && n >= 3) uses.push('office');
    else uses.push('kids');
  }
  return uses;
}

// Defaults follow the owner's plan: Damri "Afek", Kiryat Bialik, building 3, floor 19, type A.
export const DEFAULT_PROFILE: ApartmentProfile = {
  name: 'הדירה החדשה',
  rooms: 5,
  aptType: 'regular',
  floor: 19,
  gardenArea: 0,
  roofArea: 0,
  duplex: false,
  bedrooms: defaultBedrooms(5),
  bedroomSizes: ['3.71×3.37', '3.61×4.05', '2.87×3.35', '2.95×3.60'],
  mamad: 3,
  toilets: 3,
  showers: 1,
  bathtubs: 1,
  balconyArea: 20,
  balconyCovered: 10,
  balconyEnclosure: 13,
  kitchenIsland: { length: 150, depth: 90 },
  storageArea: 4,
  parking: 2,
  parkingCovered: true,
  evChargers: 1,
  acType: 'central',
  cats: 3,
  dogs: 0,
  smartHome: true,
  works: true,
  tier: 'mid',
};

/** Fills fields added after a profile was saved, so older apartments keep working in the planner. */
export function withDefaults(p: Partial<ApartmentProfile>): ApartmentProfile {
  // A saved profile with the default room layout was built from DEFAULT_PROFILE, so its room
  // sizes, safe room and floor still apply; any other layout starts those fields empty.
  const sameLayout = p.bedrooms?.join() === DEFAULT_PROFILE.bedrooms.join();
  return {
    ...DEFAULT_PROFILE,
    evChargers: Math.min(1, p.parking ?? DEFAULT_PROFILE.parking),
    acType: 'split',
    cats: 0,
    dogs: 0,
    aptType: 'regular',
    floor: sameLayout ? DEFAULT_PROFILE.floor : 1,
    bedroomSizes: sameLayout ? DEFAULT_PROFILE.bedroomSizes : [],
    mamad: sameLayout ? DEFAULT_PROFILE.mamad : null,
    ...p,
  };
}

function bedroomItems(use: BedroomUse): ItemTpl[] {
  switch (use) {
    case 'master':
      return [
        { k: 'bed', n: 'מיטה זוגית 160×200 עם ארגז מצעים', p: 4500, pr: 'must' },
        { k: 'mattress', n: 'מזרן זוגי אורתופדי', p: 5000, pr: 'must' },
        { k: 'wardrobe', n: 'ארון הזזה 3 דלתות (בהתאמה אישית)', p: 8500, pr: 'must' },
        { k: 'nightstands', n: 'שידות לילה', p: 700, q: 2, pr: 'important' },
        { k: 'dresser', n: 'קומודה עם מגירות', p: 2200, pr: 'important' },
        { k: 'mirror', n: 'מראת גוף', p: 550, pr: 'later' },
        { k: 'bedding', n: 'סט מצעים זוגי סאטן', p: 450, q: 2, pr: 'must' },
        { k: 'duvet', n: 'שמיכת פוך + כריות שינה', p: 1300, pr: 'must' },
        { k: 'lamps', n: 'מנורות לילה', p: 250, q: 2, pr: 'important' },
        { k: 'rug', n: 'שטיח ליד המיטה', p: 700, pr: 'later' },
        { k: 'tv', n: 'טלוויזיה 50״ לחדר', p: 2200, pr: 'later' },
      ];
    case 'kids':
      return [
        { k: 'bed', n: 'מיטת נוער 120×190 עם מגירות', p: 2200, pr: 'must' },
        { k: 'mattress', n: 'מזרן נוער', p: 1800, pr: 'must' },
        { k: 'wardrobe', n: 'ארון בגדים 2–3 דלתות', p: 3500, pr: 'must' },
        { k: 'desk', n: 'שולחן כתיבה', p: 900, pr: 'important' },
        { k: 'chair', n: 'כיסא כתיבה ארגונומי', p: 700, pr: 'important' },
        { k: 'shelves', n: 'ספרייה / מדפי קיר', p: 650, pr: 'important' },
        { k: 'toys', n: 'אחסון צעצועים וארגזים', p: 400, pr: 'later' },
        { k: 'rug', n: 'שטיח לחדר', p: 500, pr: 'later' },
        { k: 'bedding', n: 'סט מצעים יחיד/וחצי', p: 280, q: 2, pr: 'must' },
        { k: 'duvet', n: 'שמיכה + כרית', p: 600, pr: 'must' },
        { k: 'lamp', n: 'מנורת שולחן', p: 220, pr: 'important' },
      ];
    case 'office':
      return [
        { k: 'desk', n: 'שולחן עבודה חשמלי מתכוונן', p: 2500, pr: 'must' },
        { k: 'chair', n: 'כיסא משרדי ארגונומי', p: 2000, pr: 'must' },
        { k: 'monitor', n: 'מסך 27״ + זרוע', p: 1500, pr: 'important' },
        { k: 'storage', n: 'ארון מסמכים / ספרייה', p: 1600, pr: 'important' },
        { k: 'sofa', n: 'ספה נפתחת לאורחים', p: 3500, pr: 'later', note: 'אם זה הממ״ד — כדאי ספה נפתחת' },
        { k: 'lamp', n: 'מנורת שולחן', p: 300, pr: 'important' },
        { k: 'printer', n: 'מדפסת משולבת', p: 700, pr: 'later' },
        { k: 'rug', n: 'שטיח', p: 500, pr: 'later' },
      ];
    case 'guest':
      return [
        { k: 'bed', n: 'מיטה / ספה נפתחת', p: 3500, pr: 'must' },
        { k: 'mattress', n: 'מזרן', p: 1800, pr: 'important' },
        { k: 'wardrobe', n: 'ארון בגדים', p: 3000, pr: 'important' },
        { k: 'bedding', n: 'סט מצעים', p: 350, q: 2, pr: 'important' },
        { k: 'lamp', n: 'מנורת לילה', p: 250, pr: 'later' },
      ];
  }
}

/** Builds the category templates for an apartment. Prices are mid-tier; generate.ts applies the tier. */
export function buildTemplates(profile: ApartmentProfile): CategoryTpl[] {
  const p = withDefaults(profile);
  const cats: CategoryTpl[] = [];
  const pets = p.cats + p.dogs;
  const high = p.aptType !== 'garden' && p.floor >= 8;
  const bedrooms = p.bedrooms.length;
  const wet = p.showers + p.bathtubs;
  const add = (c: Omit<CategoryTpl, 'color'>) => cats.push({ ...c, color: color(cats.length) });

  // Kitchen & island
  const island = p.kitchenIsland;
  const stools = island ? Math.max(2, Math.floor(island.length / 50)) : 0;
  add({
    key: 'kitchen',
    name: 'מטבח',
    note: island ? `כולל אי ${island.length}×${island.depth}` : undefined,
    items: [
      ...(island
        ? [
            { k: 'island', n: `אי מטבח ${island.length}×${island.depth} ס״מ — גוף ארונות`, p: 9500, pr: 'must' as Priority },
            { k: 'island-top', n: 'משטח קוורץ לאי כולל מפל צד', p: 5500, pr: 'must' as Priority },
            { k: 'stools', n: 'כיסאות בר לאי', p: 650, q: stools, pr: 'important' as Priority },
            { k: 'island-light', n: 'גופי תאורה תלויים מעל האי', p: 700, q: 2, pr: 'important' as Priority },
          ]
        : []),
      { k: 'sink-tap', n: 'ברז מטבח נשלף', p: 1200, pr: 'must' },
      { k: 'water', n: 'בר מים / מערכת סינון', p: 2800, pr: 'important' },
      { k: 'organizers', n: 'מסדרי מגירות ופח נשלף למחזור', p: 1100, pr: 'important' },
      { k: 'backsplash', n: 'שדרוג חיפוי קיר (בקספלאש)', p: 3500, pr: 'later', note: 'לתאם מול הקבלן לפני מסירה' },
      { k: 'pots', n: 'סט סירים ומחבתות', p: 1500, pr: 'must' },
      { k: 'knives', n: 'סכינים, קרשי חיתוך וכלי עבודה', p: 800, pr: 'must' },
      { k: 'dishes', n: 'סט כלי אוכל ל-12', p: 1200, pr: 'must' },
      { k: 'cutlery', n: 'סט סכו״ם ל-12', p: 550, pr: 'must' },
      { k: 'glasses', n: 'כוסות, ספלים וכלי הגשה', p: 700, pr: 'important' },
      { k: 'pantry', n: 'קופסאות אחסון למזווה', p: 400, pr: 'later' },
    ],
  });

  add({
    key: 'appliances',
    name: 'מוצרי חשמל גדולים',
    items: [
      { k: 'fridge', n: 'מקרר 4 דלתות', p: 9000, pr: 'must' },
      { k: 'oven', n: 'תנור בנוי פירוליטי', p: 3800, pr: 'must' },
      { k: 'hob', n: island ? 'כיריים אינדוקציה (באי)' : 'כיריים אינדוקציה', p: 3200, pr: 'must' },
      { k: 'hood', n: island ? 'קולט אדים לאי / קולט שקוע בכיריים' : 'קולט אדים', p: island ? 4500 : 2500, pr: 'must' },
      { k: 'dishwasher', n: 'מדיח כלים אינטגרלי', p: 3200, pr: 'must' },
      { k: 'microwave', n: 'מיקרוגל', p: 800, pr: 'important' },
      { k: 'washer', n: 'מכונת כביסה 9 ק״ג', p: 2900, pr: 'must' },
      { k: 'dryer', n: 'מייבש כביסה משאבת חום', p: 3500, pr: 'important' },
      { k: 'freezer', n: 'מקפיא נוסף (למחסן / מרפסת שירות)', p: 2500, pr: 'later' },
    ],
  });

  add({
    key: 'ac',
    name: 'מיזוג אוויר',
    note: p.acType === 'central' ? 'מיני-מרכזי לכל הבית' : 'מזגן לכל חדר',
    items:
      p.acType === 'central'
        ? [
            {
              k: 'central',
              n: 'מזגן מיני-מרכזי לכל הבית כולל התקנה ותעלות',
              p: 16000 + 3000 * bedrooms,
              pr: 'must',
              note: 'לבדוק מול הקבלן את הכנת התעלות והניקוז',
            },
            { k: 'zoning', n: 'מערכת אזורים (דמפרים) — שליטה נפרדת בכל חדר', p: 1100, q: bedrooms + 1, pr: 'important' },
            { k: 'thermostat', n: 'בקר Wi-Fi / תרמוסטט חכם למיני-מרכזי', p: 900, pr: 'important' },
            { k: 'fans', n: 'מאוורר תקרה שקט', p: 750, q: bedrooms, pr: 'later' },
          ]
        : [
            { k: 'living', n: 'מזגן מיני-מרכזי לסלון ולמטבח כולל התקנה', p: 15000, pr: 'must' },
            { k: 'bedrooms', n: 'מזגן עילי לחדר שינה כולל התקנה', p: 3200, q: bedrooms, pr: 'must' },
            { k: 'fans', n: 'מאוורר תקרה שקט', p: 750, q: bedrooms, pr: 'later' },
          ],
  });

  add({
    key: 'small',
    name: 'מוצרי חשמל קטנים',
    items: [
      { k: 'coffee', n: 'מכונת קפה', p: 1800, pr: 'important' },
      { k: 'kettle', n: 'קומקום חשמלי', p: 250, pr: 'must' },
      { k: 'toaster', n: 'טוסטר / טוסטר-אובן', p: 450, pr: 'important' },
      { k: 'airfryer', n: 'סיר טיגון באוויר', p: 650, pr: 'important' },
      { k: 'blender', n: 'בלנדר / מעבד מזון', p: 900, pr: 'later' },
      {
        k: 'robot',
        n: 'שואב אבק רובוטי שוטף',
        p: 2200,
        pr: 'important',
        note: pets ? 'לבחור דגם עם מברשת גומי לשיער חיות' : undefined,
      },
      { k: 'vacuum', n: 'שואב אבק אלחוטי', p: 1500, pr: 'must' },
      { k: 'iron', n: 'מגהץ קיטור / קולב אדים', p: 500, pr: 'later' },
      { k: 'hairdryer', n: 'מייבש שיער', p: 350, pr: 'important' },
    ],
  });

  add({
    key: 'living',
    name: 'סלון',
    items: [
      {
        k: 'sofa',
        n: 'ספה פינתית בד',
        p: 9000,
        pr: 'must',
        note: p.cats ? 'בד עמיד לשריטות (מיקרופייבר / Performance)' : undefined,
      },
      { k: 'armchair', n: 'כורסת קריאה', p: 2500, pr: 'later' },
      { k: 'table', n: 'שולחן סלון', p: 1500, pr: 'important' },
      { k: 'tv', n: 'טלוויזיה 65״', p: 4500, pr: 'important' },
      { k: 'console', n: 'מזנון טלוויזיה', p: 2500, pr: 'important' },
      { k: 'soundbar', n: 'מקרן קול (סאונדבר)', p: 1500, pr: 'later' },
      { k: 'rug', n: 'שטיח גדול 200×300', p: 1800, pr: 'important' },
      { k: 'shelves', n: 'ספרייה / מדפים', p: 1500, pr: 'later' },
      { k: 'textiles', n: 'כריות נוי ושמיכת ספה', p: 500, pr: 'later' },
      { k: 'art', n: 'תמונות והדפסים לקיר', p: 1500, pr: 'later' },
      { k: 'plants', n: 'צמחי בית ועציצים', p: 800, pr: 'later' },
    ],
  });

  add({
    key: 'dining',
    name: 'פינת אוכל',
    items: [
      { k: 'table', n: 'שולחן אוכל נפתח', p: 4000, pr: 'must' },
      { k: 'chairs', n: 'כיסאות אוכל', p: 450, q: 6, pr: 'must' },
      { k: 'pendant', n: 'מנורה תלויה מעל השולחן', p: 1200, pr: 'important' },
      { k: 'buffet', n: 'מזנון / ויטרינה', p: 3000, pr: 'later' },
    ],
  });

  const kidsCount = p.bedrooms.filter((u) => u === 'kids').length;
  let kidsIdx = 0;
  p.bedrooms.forEach((use, i) => {
    const label = use === 'kids' && kidsCount > 1 ? `${BEDROOM_LABEL[use]} ${++kidsIdx}` : BEDROOM_LABEL[use];
    const isMamad = p.mamad === i;
    const note = [p.bedroomSizes[i]?.trim(), isMamad && 'ממ״ד'].filter(Boolean).join(' · ') || undefined;
    add({
      key: `bedroom-${i + 1}`,
      name: label,
      note,
      items: [
        ...bedroomItems(use),
        ...(isMamad
          ? [
              { k: 'emergency', n: 'ערכת חירום לממ״ד (מים, פנס, סוללות, רדיו)', p: 350, pr: 'must' as Priority },
              { k: 'mats', n: 'מזרנים מתקפלים לשהייה בממ״ד', p: 220, q: 2, pr: 'later' as Priority },
            ]
          : []),
      ],
    });
  });

  for (let i = 0; i < p.showers; i++) {
    add({
      key: `shower-${i + 1}`,
      name: p.showers > 1 ? `חדר מקלחת ${i + 1}` : 'חדר מקלחת',
      items: [
        { k: 'screen', n: 'מקלחון זכוכית מחוסמת', p: 2600, pr: 'must' },
        { k: 'mirror', n: 'ארון מראה עם תאורת LED', p: 950, pr: 'important' },
        { k: 'accessories', n: 'סט אביזרים (מתלים, מדפים, סבוניה)', p: 650, pr: 'must' },
        { k: 'towels', n: 'מגבות רחצה', p: 120, q: 6, pr: 'must' },
        { k: 'mat', n: 'שטיחון אמבטיה', p: 150, pr: 'important' },
        { k: 'rail', n: 'מתלה מגבות חשמלי', p: 700, pr: 'later' },
        { k: 'hamper', n: 'סל כביסה', p: 150, pr: 'important' },
      ],
    });
  }
  for (let i = 0; i < p.bathtubs; i++) {
    add({
      key: `bath-${i + 1}`,
      name: p.bathtubs > 1 ? `חדר אמבטיה ${i + 1}` : 'חדר אמבטיה',
      items: [
        { k: 'screen', n: 'אמבטיון — מחיצת זכוכית לאמבטיה', p: 1400, pr: 'must' },
        { k: 'mirror', n: 'ארון מראה עם תאורת LED', p: 950, pr: 'important' },
        { k: 'accessories', n: 'סט אביזרים (מתלים, מדפים, סבוניה)', p: 650, pr: 'must' },
        { k: 'towels', n: 'מגבות רחצה', p: 120, q: 6, pr: 'must' },
        { k: 'mat', n: 'שטיחון אמבטיה', p: 150, pr: 'important' },
        { k: 'kids', n: 'מדרגה ומושב אמבטיה לילדים', p: 180, pr: 'later' },
        { k: 'hamper', n: 'סל כביסה', p: 150, pr: 'important' },
      ],
    });
  }

  if (p.toilets > 0) {
    const guest = Math.max(0, p.toilets - wet);
    add({
      key: 'toilets',
      name: 'שירותים',
      note: `${p.toilets} חדרי שירותים`,
      items: [
        { k: 'seat', n: 'מושב אסלה בטריקה שקטה', p: 280, q: p.toilets, pr: 'must' },
        { k: 'bidet', n: 'מקלחון בידה', p: 220, q: p.toilets, pr: 'important' },
        { k: 'holder', n: 'מחזיק נייר + מברשת אסלה', p: 180, q: p.toilets, pr: 'must' },
        { k: 'bin', n: 'פח קטן עם מכסה', p: 90, q: p.toilets, pr: 'must' },
        ...(guest > 0
          ? [{ k: 'guest-mirror', n: 'מראה ומגבת ידיים לשירותי אורחים', p: 450, q: guest, pr: 'important' as Priority }]
          : []),
      ],
    });
  }

  if (p.balconyArea > 0) {
    const open = Math.max(0, p.balconyArea - Math.max(p.balconyCovered, p.balconyEnclosure));
    add({
      key: 'balcony',
      name: 'מרפסת',
      note: `${p.balconyArea} מ״ר`,
      items: [
        ...(p.balconyEnclosure > 0
          ? [
              {
                k: 'enclosure',
                n: 'סגירת מרפסת — אלומיניום וזכוכית (למ״ר)',
                p: 1300,
                q: p.balconyEnclosure,
                pr: 'must' as Priority,
                note: high
                  ? `לבדוק היתר ואישור נציגות. קומה ${p.floor} — זכוכית מחוסמת ופרופיל לעומסי רוח`
                  : 'לבדוק היתר ואישור נציגות הבית לפני הזמנה',
              },
              { k: 'nets', n: 'רשתות נגד יתושים לסגירה', p: 1200, pr: 'important' as Priority },
            ]
          : []),
        ...(open > 0
          ? [{ k: 'pergola', n: 'פרגולת אלומיניום / הצללה לחלק הפתוח (למ״ר)', p: 900, q: open, pr: 'important' as Priority }]
          : []),
        { k: 'lounge', n: 'פינת ישיבה לחוץ', p: 4500, pr: 'important' },
        { k: 'dining', n: 'שולחן + 4 כיסאות חוץ', p: 2500, pr: 'later' },
        { k: 'deck', n: 'דק / דשא סינטטי (למ״ר)', p: 180, q: open || Math.round(p.balconyArea / 2), pr: 'later' },
        { k: 'plants', n: 'אדניות, עציצים וצמחייה', p: 1500, pr: 'later' },
        { k: 'light', n: 'תאורת חוץ ושרשראות אור', p: 600, pr: 'later' },
        { k: 'grill', n: 'גריל גז', p: 2500, pr: 'later' },
        { k: 'drying', n: 'מתקן ייבוש כביסה', p: 400, pr: 'must' },
      ],
    });
  }

  if (p.aptType === 'garden' && p.gardenArea > 0) {
    const g = p.gardenArea;
    add({
      key: 'garden',
      name: 'גינה',
      note: `${g} מ״ר`,
      items: [
        { k: 'drainage', n: 'בדיקת שיפועים וניקוז לפני עבודות', p: 1500, pr: 'must', note: 'לפני ריצוף או דשא' },
        { k: 'irrigation', n: 'מערכת השקיה בטפטוף + מחשב השקיה', p: 2500, pr: 'must' },
        { k: 'lawn', n: 'דשא (טבעי או סינטטי) — למ״ר', p: 150, q: Math.round(g * 0.55), pr: 'important' },
        { k: 'paving', n: 'ריצוף / דק לפינת ישיבה — למ״ר', p: 350, q: Math.round(g * 0.3), pr: 'important' },
        { k: 'plants', n: 'עצים, שיחים ושתילים', p: 3000, pr: 'important' },
        { k: 'fence', n: 'גדר / מחיצת פרטיות וגדר חיה', p: 6000, pr: 'important' },
        { k: 'pergola', n: 'פרגולה — למ״ר', p: 900, q: Math.min(24, Math.round(g * 0.25)), pr: 'important' },
        { k: 'lounge', n: 'פינת ישיבה לגינה', p: 6000, pr: 'important' },
        { k: 'dining', n: 'שולחן + 6 כיסאות גן', p: 3500, pr: 'later' },
        { k: 'light', n: 'תאורת גינה ושבילים', p: 1500, pr: 'important' },
        { k: 'tap', n: 'ברז גינה, צינור ועגלת צינור', p: 350, pr: 'must' },
        { k: 'shed', n: 'מחסן גינה', p: 2500, pr: 'later' },
        { k: 'grill', n: 'גריל / מטבח חוץ', p: 4000, pr: 'later' },
        { k: 'alarm', n: 'מערכת אזעקה עם חיישני פתיחה', p: 2500, pr: 'important', note: 'קומת קרקע' },
        { k: 'bars', n: 'סורגים / סורגי אקורדיון לחלונות', p: 700, q: bedrooms + 1, pr: 'important' },
        ...(p.cats > 0
          ? [{ k: 'cat-fence', n: 'גידור בטיחות לחתולים בגינה', p: 3000, pr: 'must' as Priority }]
          : []),
      ],
    });
  }

  if (p.aptType === 'penthouse' && p.roofArea > 0) {
    const r = p.roofArea;
    add({
      key: 'roof',
      name: 'מרפסת גג',
      note: `${r} מ״ר`,
      items: [
        { k: 'waterproof', n: 'בדיקת איטום של מומחה', p: 2000, pr: 'must', note: 'לפני הנחת דק ואדניות' },
        { k: 'pergola', n: 'פרגולה / הצללה מתכווננת — למ״ר', p: 1100, q: Math.round(r * 0.35), pr: 'must' },
        { k: 'deck', n: 'דק / ריצוף חוץ — למ״ר', p: 350, q: Math.round(r * 0.5), pr: 'important' },
        { k: 'planters', n: 'אדניות גדולות וצמחייה', p: 4000, pr: 'important' },
        { k: 'irrigation', n: 'השקיה בטפטוף לאדניות', p: 1800, pr: 'important' },
        { k: 'lounge', n: 'פינת ישיבה גדולה לחוץ', p: 8000, pr: 'important' },
        { k: 'dining', n: 'פינת אוכל חוץ ל-8', p: 5000, pr: 'important' },
        { k: 'kitchen', n: 'מטבח חוץ / עמדת גריל', p: 9000, pr: 'later' },
        { k: 'light', n: 'תאורת חוץ ואווירה', p: 2500, pr: 'important' },
        { k: 'sails', n: 'מפרשי צל / שמשייה גדולה', p: 2500, pr: 'later' },
        { k: 'shower', n: 'מקלחת חוץ', p: 1500, pr: 'later' },
        { k: 'spa', n: "ג'קוזי / ספא", p: 25000, pr: 'later', note: 'לבדוק עומס תקרה עם קונסטרוקטור' },
        ...(p.cats > 0
          ? [{ k: 'cat-net', n: 'רשת בטיחות לחתולים לאורך המעקה', p: 3500, pr: 'must' as Priority }]
          : []),
      ],
    });
  }

  add({
    key: 'lighting',
    name: 'תאורה',
    items: [
      { k: 'living', n: 'פסי תאורה / ספוטים לסלון', p: 2500, pr: 'important' },
      { k: 'bedrooms', n: 'גוף תאורה תקרתי לחדר', p: 600, q: bedrooms, pr: 'must' },
      { k: 'hall', n: 'תאורה למסדרון ולכניסה', p: 900, pr: 'important' },
      { k: 'floor', n: 'מנורה עומדת לסלון', p: 800, pr: 'later' },
      { k: 'wet', n: 'גופי תאורה לחדרים הרטובים', p: 350, q: p.toilets || wet, pr: 'must' },
      ...(p.duplex ? [{ k: 'stairs', n: 'תאורת מדרגות LED', p: 1800, pr: 'important' as Priority }] : []),
    ],
  });

  add({
    key: 'curtains',
    name: 'וילונות ותריסים',
    items: [
      {
        k: 'living',
        n: 'וילון בד לסלון (כולל מסילה)',
        p: p.aptType === 'penthouse' ? 5500 : 3500,
        pr: 'important',
        note: p.aptType === 'penthouse' ? 'חלונות גבוהים — למדוד גובה תקרה' : undefined,
      },
      { k: 'bedrooms', n: 'וילון האפלה לחדר שינה', p: 1400, q: bedrooms, pr: 'must' },
      { k: 'install', n: 'מסילות והתקנה', p: 1200, pr: 'must' },
    ],
  });

  if (p.works) {
    add({
      key: 'works',
      name: 'עבודות ושדרוגים',
      items: [
        { k: 'inspection', n: 'בדק בית — מהנדס לפני קבלת מפתח', p: 2500, pr: 'must' },
        { k: 'cleaning', n: 'ניקיון יסודי אחרי קבלן', p: 1500, pr: 'must' },
        { k: 'electric', n: 'חשמלאי — נקודות ושקעים נוספים', p: 3500, pr: 'important' },
        { k: 'shutters', n: 'חשמול תריסים', p: 1800, q: bedrooms + 1, pr: 'important' },
        { k: 'handyman', n: 'הנדימן — תליית מדפים, תמונות ווילונות', p: 1500, pr: 'important' },
        ...(p.duplex
          ? [{ k: 'stairs', n: 'שערי בטיחות ופסים נגד החלקה למדרגות', p: 900, pr: 'important' as Priority }]
          : []),
        { k: 'paint', n: 'קיר דקורטיבי / צבע בגוון', p: 2500, pr: 'later' },
        { k: 'filter', n: 'מסנן מים ראשי לכל הבית', p: 3200, pr: 'later' },
        { k: 'movers', n: 'הובלה', p: 3500, pr: 'must' },
      ],
    });
  }

  if (p.smartHome) {
    add({
      key: 'smart',
      name: 'בית חכם ואבטחה',
      items: [
        { k: 'mesh', n: 'רשת Wi-Fi Mesh (3 יחידות)', p: 1300, pr: 'must' },
        { k: 'lock', n: 'מנעול חכם לדלת הכניסה', p: 1600, pr: 'important' },
        { k: 'cameras', n: 'מצלמות אבטחה', p: 450, q: 2, pr: 'important' },
        { k: 'boiler', n: 'בקר דוד חכם', p: 450, pr: 'important' },
        { k: 'leak', n: 'חיישני הצפה', p: 130, q: wet + 1, pr: 'important' },
        { k: 'plugs', n: 'מתגים ושקעים חכמים', p: 160, q: 6, pr: 'later' },
        ...(p.acType === 'split'
          ? [{ k: 'ac-ctrl', n: 'שלט מזגן חכם (Wi-Fi)', p: 250, q: bedrooms, pr: 'later' as Priority }]
          : []),
        ...(pets ? [{ k: 'pet-cam', n: 'מצלמת פנים לצפייה בחיות', p: 250, pr: 'later' as Priority }] : []),
        { k: 'smoke', n: 'גלאי עשן', p: 150, q: 2, pr: 'must' },
        { k: 'fire', n: 'מטף + שמיכת כיבוי למטבח', p: 350, pr: 'must' },
        { k: 'speaker', n: 'רמקול / עוזר קולי', p: 450, pr: 'later' },
      ],
    });
  }

  add({
    key: 'entry',
    name: 'כניסה, כביסה וכלי בית',
    items: [
      { k: 'shoes', n: 'ארון נעליים לכניסה', p: 900, pr: 'important' },
      { k: 'coat', n: 'מתלה מעילים + מראה בכניסה', p: 800, pr: 'later' },
      { k: 'doormat', n: 'שטיח כניסה', p: 150, pr: 'must' },
      { k: 'hangers', n: 'קולבים (סט גדול)', p: 300, pr: 'must' },
      { k: 'board', n: 'קרש גיהוץ', p: 250, pr: 'later' },
      { k: 'firstaid', n: 'ערכת עזרה ראשונה', p: 150, pr: 'must' },
      { k: 'cleaning', n: 'ציוד ניקיון התחלתי (מגב, דלי, מטאטא, חומרים)', p: 600, pr: 'must' },
    ],
  });

  if (pets > 0) {
    const petNote = [p.cats && `${p.cats} חתולים`, p.dogs && `${p.dogs === 1 ? 'כלב' : `${p.dogs} כלבים`}`].filter(Boolean).join(' · ');
    add({
      key: 'pets',
      name: 'חיות מחמד',
      note: petNote,
      items: [
        ...(p.cats > 0
          ? [
              { k: 'litter', n: 'ארגז חול סגור עם מסנן', p: 250, q: p.cats, pr: 'must' as Priority, note: 'כלל אצבע: ארגז לכל חתול' },
              { k: 'litter-mat', n: 'שטיחון לכידת חול', p: 80, q: p.cats, pr: 'important' as Priority },
              { k: 'tree', n: 'עץ חתולים גבוה (עד התקרה)', p: 900, q: Math.ceil(p.cats / 2), pr: 'must' as Priority },
              { k: 'scratchers', n: 'משטחי גירוד לקיר ולרצפה', p: 120, q: p.cats + 1, pr: 'important' as Priority },
              { k: 'wall', n: 'מדפי טיפוס וגשרים לקיר', p: 650, pr: 'later' as Priority },
              { k: 'fountain', n: 'מזרקת מים לחתולים', p: 250, pr: 'must' as Priority },
              { k: 'cat-bowls', n: 'קערות אוכל ומים (קרמיקה / נירוסטה)', p: 60, q: p.cats, pr: 'must' as Priority },
              { k: 'feeder', n: 'מזין אוטומטי', p: 450, pr: 'later' as Priority },
              { k: 'cat-beds', n: 'מיטות / מערות לחתולים', p: 150, q: p.cats, pr: 'later' as Priority },
              { k: 'carrier', n: 'מנשא לנסיעה לווטרינר', p: 180, q: p.cats, pr: 'important' as Priority },
              {
                k: 'window-nets',
                n: 'רשתות בטיחות לחתולים לחלונות',
                p: 350,
                q: bedrooms + 2,
                pr: 'must' as Priority,
                note: high ? `קומה ${p.floor} — חובה לפני שהחתולים נכנסים` : 'חובה לפני שהחתולים נכנסים לדירה',
              },
              ...(p.balconyArea > 0
                ? [
                    {
                      k: 'balcony-net',
                      n: 'רשת בטיחות לחתולים במרפסת (החלק הפתוח)',
                      p: 1800,
                      pr: 'must' as Priority,
                      note: 'גם אם יש סגירה — לחלון שנשאר פתוח',
                    },
                  ]
                : []),
            ]
          : []),
        ...(p.dogs > 0
          ? [
              { k: 'dog-bed', n: 'מיטת כלב', p: 350, q: p.dogs, pr: 'must' as Priority },
              { k: 'dog-bowls', n: 'קערות אוכל ומים', p: 90, q: p.dogs, pr: 'must' as Priority },
              { k: 'leash', n: 'רצועה ורתמה', p: 180, q: p.dogs, pr: 'must' as Priority },
              { k: 'crate', n: 'כלוב / מלונה פנימית', p: 450, q: p.dogs, pr: 'later' as Priority },
            ]
          : []),
        { k: 'purifier', n: 'מטהר אוויר עם מסנן HEPA', p: 1200, pr: 'later' },
        { k: 'lint', n: 'רולרים ומברשת להסרת שיער', p: 120, pr: 'important' },
      ],
    });
  }

  if (p.storageArea > 0) {
    add({
      key: 'storage',
      name: 'מחסן',
      note: `${p.storageArea} מ״ר`,
      items: [
        { k: 'shelves', n: 'מדפי מתכת 180 ס״מ', p: 450, q: Math.max(1, Math.ceil(p.storageArea / 1.5)), pr: 'must' },
        { k: 'boxes', n: 'ארגזי אחסון שקופים עם מכסה', p: 55, q: 10, pr: 'important' },
        { k: 'light', n: 'תאורת LED עם חיישן תנועה', p: 250, pr: 'important' },
        { k: 'wall', n: 'לוח כלים / מתלה קיר', p: 400, pr: 'later' },
        { k: 'tools', n: 'מקדחה + ארגז כלים בסיסי', p: 900, pr: 'important' },
        { k: 'ladder', n: 'סולם אלומיניום', p: 400, pr: 'important' },
        { k: 'dehumid', n: 'מסיר לחות', p: 900, pr: 'later' },
      ],
    });
  }

  if (p.parking > 0) {
    add({
      key: 'parking',
      name: p.parking > 1 ? 'חניות' : 'חניה',
      note: `${p.parking}${p.parkingCovered ? ' מקורות' : ''}`,
      items: [
        ...(p.evChargers > 0
          ? [
              {
                k: 'ev',
                n: 'עמדת טעינה לרכב חשמלי כולל התקנה',
                p: 5500,
                q: p.evChargers,
                pr: 'important' as Priority,
                note: 'לתאם עם חברת הניהול והחשמלאי של הבניין',
              },
            ]
          : []),
        { k: 'bumpers', n: 'מגיני קיר / פגושי ספוג', p: 150, q: p.parking, pr: 'later' },
        { k: 'lock', n: 'מחסום חניה מתקפל', p: 450, q: p.parking, pr: 'later' },
        { k: 'sign', n: 'שלט מספר דירה לחניה', p: 120, q: p.parking, pr: 'later' },
      ],
    });
  }

  return cats;
}
