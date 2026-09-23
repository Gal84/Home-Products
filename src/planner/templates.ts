import type { ApartmentProfile, BedroomUse, Priority } from '../types';

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

export const DEFAULT_PROFILE: ApartmentProfile = {
  name: 'הדירה החדשה',
  rooms: 5,
  bedrooms: defaultBedrooms(5),
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
  smartHome: true,
  works: true,
  tier: 'mid',
};

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
export function buildTemplates(p: ApartmentProfile): CategoryTpl[] {
  const cats: CategoryTpl[] = [];
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
    items: [
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
      { k: 'robot', n: 'שואב אבק רובוטי שוטף', p: 2200, pr: 'important' },
      { k: 'vacuum', n: 'שואב אבק אלחוטי', p: 1500, pr: 'must' },
      { k: 'iron', n: 'מגהץ קיטור / קולב אדים', p: 500, pr: 'later' },
      { k: 'hairdryer', n: 'מייבש שיער', p: 350, pr: 'important' },
    ],
  });

  add({
    key: 'living',
    name: 'סלון',
    items: [
      { k: 'sofa', n: 'ספה פינתית בד', p: 9000, pr: 'must' },
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
    add({ key: `bedroom-${i + 1}`, name: label, items: bedroomItems(use) });
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
                note: 'לבדוק היתר ואישור נציגות הבית לפני הזמנה',
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

  add({
    key: 'lighting',
    name: 'תאורה',
    items: [
      { k: 'living', n: 'פסי תאורה / ספוטים לסלון', p: 2500, pr: 'important' },
      { k: 'bedrooms', n: 'גוף תאורה תקרתי לחדר', p: 600, q: bedrooms, pr: 'must' },
      { k: 'hall', n: 'תאורה למסדרון ולכניסה', p: 900, pr: 'important' },
      { k: 'floor', n: 'מנורה עומדת לסלון', p: 800, pr: 'later' },
      { k: 'wet', n: 'גופי תאורה לחדרים הרטובים', p: 350, q: p.toilets || wet, pr: 'must' },
    ],
  });

  add({
    key: 'curtains',
    name: 'וילונות ותריסים',
    items: [
      { k: 'living', n: 'וילון בד לסלון (כולל מסילה)', p: 3500, pr: 'important' },
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
        { k: 'ac-ctrl', n: 'שלט מזגן חכם (Wi-Fi)', p: 250, q: bedrooms, pr: 'later' },
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
        { k: 'ev', n: 'עמדת טעינה לרכב חשמלי כולל התקנה', p: 5500, pr: 'important', note: 'לתאם עם חברת הניהול והחשמלאי של הבניין' },
        { k: 'bumpers', n: 'מגיני קיר / פגושי ספוג', p: 150, q: p.parking, pr: 'later' },
        { k: 'lock', n: 'מחסום חניה מתקפל', p: 450, q: p.parking, pr: 'later' },
        { k: 'sign', n: 'שלט מספר דירה לחניה', p: 120, q: p.parking, pr: 'later' },
      ],
    });
  }

  return cats;
}
