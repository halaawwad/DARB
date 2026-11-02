# الطرق والحواجز — فوزية

- طبقتا «الحواجز» و«بلاغات الطريق» على الخريطة: `app/(tabs)/map.tsx`.
- العلامات: `src/components/map/CheckpointMarker.tsx` و `RoadReportMarker.tsx`، البيانات: `src/data/mock/roads.ts` عبر `services.roads`.
- أفكار: إرسال بلاغ جديد، تحديث حالة حاجز، تحديثات مباشرة عبر Socket.IO لاحقاً.
