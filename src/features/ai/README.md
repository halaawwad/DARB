# الذكاء الاصطناعي — يزيد

- استبدال المحلّل المؤقت `src/utils/voiceOrder.ts` (`parseVoiceOrder`) بتحليل حقيقي للطلبيات الصوتية باللهجة الفلسطينية.
- تحليل الزبون في تبويب «تحليل الذكاء» (`CustomerInsight` في `src/types/customer.ts`، حالياً من `src/data/mock/insights.ts`).
- استدعاءات النموذج تمر عبر الخادم لاحقاً — لا مفاتيح API داخل التطبيق.
