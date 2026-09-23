export type Priority = 'must' | 'important' | 'later';
export type BudgetTier = 'saver' | 'mid' | 'premium';
export type BedroomUse = 'master' | 'kids' | 'office' | 'guest';
export type AcType = 'central' | 'split';

export interface Category {
  id: string;
  name: string;
  /** Short catalogue label shown next to the name, e.g. "מטבח". */
  note?: string;
  color: string;
  order: number;
  /** Planner template key, used to avoid duplicates when re-running the planner. */
  key?: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  qty: number;
  unitPrice: number;
  /** What was actually paid for the whole line, when it differs from qty × unitPrice. */
  actualPrice?: number | null;
  priority: Priority;
  purchased: boolean;
  store?: string;
  link?: string;
  notes?: string;
  key?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface ApartmentProfile {
  name: string;
  rooms: number;
  bedrooms: BedroomUse[];
  toilets: number;
  showers: number;
  bathtubs: number;
  balconyArea: number;
  balconyCovered: number;
  balconyEnclosure: number;
  kitchenIsland: { length: number; depth: number } | null;
  storageArea: number;
  parking: number;
  parkingCovered: boolean;
  evChargers: number;
  /** Whole-home ducted mini-central unit, or a wall unit per bedroom. */
  acType: AcType;
  cats: number;
  dogs: number;
  smartHome: boolean;
  works: boolean;
  tier: BudgetTier;
}

export interface HomeData {
  schema: 1;
  profile: ApartmentProfile;
  budget: number | null;
  categories: Category[];
  items: Item[];
  /** Last change to profile/budget (categories and items carry their own timestamps). */
  updatedAt: number;
}
