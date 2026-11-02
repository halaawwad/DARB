import type { Checkpoint, RoadReport } from '@/types';
import { minutesAgo } from './dates';

/** Locations from ParkFlow's ramallah_checkpoints.json (GeoMOLG source). Statuses are mock. */
export const CHECKPOINTS: Checkpoint[] = [
  { id: 'cp_qalandiya', name: 'حاجز قلنديا', location: { latitude: 31.8627132, longitude: 35.228312 }, status: 'crowded', updatedAt: minutesAgo(12) },
  { id: 'cp_beituniya', name: 'حاجز بيتونيا', location: { latitude: 31.8829431, longitude: 35.1778557 }, status: 'open', updatedAt: minutesAgo(35) },
  { id: 'cp_dco', name: 'حاجز بيت إيل (DCO)', location: { latitude: 31.9243231, longitude: 35.2265157 }, status: 'closed', updatedAt: minutesAgo(8) },
  { id: 'cp_beitel_west', name: 'بوابة بيت إيل الغربية', location: { latitude: 31.9339342, longitude: 35.2211377 }, status: 'open', updatedAt: minutesAgo(64) },
  { id: 'cp_atara', name: 'حاجز عطارة', location: { latitude: 31.9831242, longitude: 35.2012386 }, status: 'crowded', updatedAt: minutesAgo(20) },
];

export const ROAD_REPORTS: RoadReport[] = [
  { id: 'rr_1', type: 'accident', location: { latitude: 31.9105, longitude: 35.215 }, note: 'حادث بسيط قرب البالوع، المسرب الأيمن مغلق.', createdAt: minutesAgo(15) },
  { id: 'rr_2', type: 'construction', location: { latitude: 31.9075, longitude: 35.201 }, note: 'أعمال حفر في شارع الإرسال.', createdAt: minutesAgo(140) },
  { id: 'rr_3', type: 'traffic', location: { latitude: 31.876, longitude: 35.219 }, note: 'أزمة خانقة على مدخل كفر عقب.', createdAt: minutesAgo(25) },
];
