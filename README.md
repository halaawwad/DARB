# درب (Darb)

منصة SaaS لشركات التوزيع في فلسطين (مبيعات ميدانية + توصيل). لكل شركة بياناتها المعزولة (`companyId` على كل سجل).
هذا المستودع حالياً هو **الأساس (skeleton) لتطبيق الموبايل** فقط: Expo + expo-router، بالعربية فقط ومن اليمين لليسار، وكل البيانات وهمية (mock). لا يوجد خادم ولا تسجيل دخول حقيقي ولا استدعاءات ذكاء اصطناعي.

## التشغيل

```bash
npm install
npx expo start          # Android / iOS (Expo Go أو dev build)
npx expo start --web    # المتصفح — الخريطة عبر Leaflet
npm run typecheck       # tsc --noEmit
```

- انسخ `.env.example` إلى `.env` عند الحاجة. `EXPO_PUBLIC_API_BASE_URL` غير مستخدم بعد.
- **الخريطة على Android** تحتاج مفتاح Google Maps في dev build خاص بكم؛ في Expo Go قد لا تظهر البلاطات. على الويب لا حاجة لأي مفتاح (Esri).
- **التعرّف على الصوت** (`expo-speech-recognition`) غير موجود في Expo Go. شاشة الطلبية الصوتية تعمل رغم ذلك عبر زر «تجربة» الذي يملأ نصاً تجريبياً. على الويب تعمل في Chrome.
- الأيقونات وشاشة البداية: حالياً بلون الكحلي `#0F1C36` فقط بدون صور — أضيفوا `assets/` لاحقاً واربطوها في `app.json`.

## الأدوار

اختيار الدور في شاشة `app/role.tsx` يحل محل تسجيل الدخول مؤقتاً (يُحفظ في `preferencesStore`). التبويبات حسب الدور معرّفة في `src/components/navigation/roleTabs.ts`:

| الدور | التبويبات |
|---|---|
| مندوب مبيعات | الخريطة، الزبائن، الطلبيات، حسابي |
| مندوب توصيل | الخريطة، توصيلات اليوم، حسابي |
| مدير | الخريطة، الزبائن، الطلبيات، حسابي (+ بطاقة «لوحة الإدارة — قريباً») |
| محاسب | الزبائن، الطلبيات، حسابي |

## هيكل المشروع

```
app/                         الشاشات (expo-router، توجيه حسب الملفات)
  _layout.tsx                الخطوط + المزوّدات (Query, Theme) + Stack
  index.tsx                  تحويل: لا يوجد دور → /role، وإلا تبويب الدور الأول
  role.tsx                   «اختر دورك»
  (tabs)/                    map · customers · orders · profile
  customer/[id].tsx          ملف الزبون: المعلومات / الطلبيات / كشف الحساب / تحليل الذكاء
  voice-order.tsx            طلبية بالصوت (نافذة)
src/
  theme/                     الألوان (كحلي + بيج)، الخطوط، المسافات… لا ألوان hex داخل الشاشات
  i18n/ar.ts                 كل النصوص الظاهرة — لا نصوص عربية داخل الشاشات، استخدموا t()
  hooks/useLocale.ts         t() و row / textAlign / dir للاتجاه من اليمين لليسار
  hooks/queries.ts           كل استعلامات React Query ومفاتيحها
  components/ui/             مكوّنات الواجهة المشتركة
  components/map/            MapSurface (native: react-native-maps، web: Leaflet) + العلامات
  components/navigation/     TabBar + تبويبات كل دور
  services/                  طبقة الخدمات: types.ts (الواجهات) + mock/ + http/apiClient.ts
  data/mock/                 البيانات الوهمية (زبائن، طلبيات، منتجات، كشوفات، حواجز…)
  store/                     zustand (التفضيلات: اللغة، المظهر، الدور)
  types/                     أنواع TypeScript للمجال
  utils/                     تنسيق المبالغ والتواريخ، الصوت، محلّل الطلبية الصوتية المؤقت
  features/                  مجلدات أعضاء الفريق (انظر أدناه)
```

### قواعد

1. الشاشات تستدعي `services` عبر hooks في `hooks/queries.ts` — لا تستوردوا ملفات `data/mock` مباشرة في الشاشات.
2. لربط الخادم لاحقاً: اكتبوا تنفيذاً لنفس الواجهات في `src/services/http/` باستخدام `api()` من `apiClient.ts` وبدّلوه في `src/services/index.ts` فقط.
3. كل نص ظاهر في `src/i18n/ar.ts`، وكل لون من `src/theme/colors.ts`.
4. للاتجاه استخدموا `row` و`textAlign` و`alignStart/alignEnd` و`dir` من `useLocale()` بدل `'row'` و`'left'`.
5. المبالغ بـ ₪ وبأرقام لاتينية عبر `formatMoney()`.

## أين يضيف كل عضو ميزته

| العضو | المجال | المجلد |
|---|---|---|
| يزيد | الذكاء الاصطناعي (تحليل الطلبيات الصوتية، تحليل الزبائن) | `src/features/ai` |
| حلا | الزبائن | `src/features/customers` |
| فوزية | الطرق والحواجز | `src/features/roads` |
| بلسم | التوصيل | `src/features/delivery` |
| نور | المالية والمحاسبة | `src/features/finance` |
| محمد | لوحة الإدارة | `src/features/admin` |

ضعوا مكوّنات ومنطق ميزتكم داخل مجلدها، وأبقوا الشاشات في `app/` رفيعة تستدعي مكوّنات الميزة.

## لاحقاً

- `server/` — Node + Socket.IO + PostgreSQL/PostGIS + Redis عبر docker-compose.
- `web-dashboard/` — لوحة ويب (React) للمدير والمحاسب.

التطبيق حالياً في جذر المستودع؛ عند إضافة هذين المجلدين قد ننقله إلى `mobile/`.

---

## English (short)

Darb is a multi-tenant SaaS for Palestinian distribution companies (field sales + delivery). This repo is the **mobile app skeleton**: Expo SDK 57 + expo-router, React Native 0.86, React 19, strict TypeScript, Arabic-only RTL UI, mock data only (no backend, auth or AI calls).

- Run: `npm install && npx expo start` (add `--web` for the browser/Leaflet map). Typecheck: `npm run typecheck`.
- Screens in `app/`; shared UI, map, theme, i18n, services and mock data in `src/`. Screens read data through React Query hooks (`src/hooks/queries.ts`) backed by the typed `services` object; swap mock → HTTP in `src/services/index.ts`.
- Role picker replaces login for now; tabs per role live in `src/components/navigation/roleTabs.ts`.
- Team feature folders: `src/features/{ai,customers,roads,delivery,finance,admin}`.
- Coming later: `server/` (Node + Socket.IO + PostgreSQL/PostGIS + Redis via docker-compose) and `web-dashboard/` (React).
- Visual reference and stack versions come from the ParkFlow project; no ParkFlow branding or parking code is included.
