# تقييم الجاهزية للتوسع والاشتراكات

## الحكم الحالي

B-Attend أصبح أقوى من النسخة السابقة، لكنه **ليس جاهزًا بعد لاستقبال إطلاق عام واسع دون بيئة staging بقاعدة PostgreSQL فعلية**. الكود الحالي مناسب لإطلاق Pilot مضبوط بعد إكمال PostgreSQL وRedis والبريد والدفع والمراقبة. لا يمكن إثبات تحمل عدد كبير من الموظفين من بيئة لا تحتوي قاعدة بيانات فعلية؛ أي رقم throughput للصفحات العامة في هذه البيئة يقيس مسار fallback والـ rendering أكثر مما يقيس استعلامات الشركة الحقيقية.

## ما كشفه التدقيق

| المجال | الدليل | أثره على الجاهزية |
|---|---|---|
| Rate limiting | كان العداد داخل `Map` في ذاكرة نسخة الخادم، لذلك لا تتشارك النسخ المتعددة العدادات | حماية غير كافية عند التوسع الأفقي |
| الاشتراكات | دوال `requireActiveSubscription` و`canUseFeature` و`checkPlanLimit` كانت stubs تعيد السماح دائمًا | خطر تشغيل حسابات غير نشطة وتجاوز حدود الباقة |
| الموظفون | صفحة الموظفين كانت تجلب كل السجلات بلا `take` أو pagination | استجابة وذاكرة غير قابلة للتوقع عند آلاف الموظفين |
| الرواتب | إعادة الحساب كانت تنفذ loop تسلسليًا على كل سطر راتب | زمن طلب مرتفع واحتمال timeout عند الشركات الكبيرة |
| API الخطط | `/api/public/plans` كان يعيد 500 عند غياب قاعدة البيانات رغم وجود fallback في صفحات التسويق | فشل في مسار التسجيل/الاختيارات |
| build | إعداد Next كان يتجاهل أخطاء TypeScript أثناء build | خطر نشر bundle غير سليم رغم وجود فحص منفصل |
| الاعتمادات | `npm audit` الأول أظهر 16 ثغرة؛ الإصلاح الآمن وترقية Next وإزالة حزم مباشرة غير مستخدمة خفضت السطح إلى 5 نتائج، بينها عناصر تحتاج ترقيات breaking | لا يُسمح بتجاهل النتيجة قبل مراجعة الترقيات المتبقية |

## ما تم تنفيذه

تم تغيير rate limiter ليستخدم Upstash Redis REST عند ضبط `UPSTASH_REDIS_REST_URL` و`UPSTASH_REDIS_REST_TOKEN`، مع fallback محلي عند التطوير أو تعطل Redis. تمت إضافة وضع benchmark محمي لا يعمل إلا عندما تكون `ALLOW_LOAD_TEST_BYPASS=true` و`APP_ENV` ليست production، مع رمز `x-load-test-token`.

تم تفعيل منطق فعلي لحالات الاشتراك `TRIALING` و`ACTIVE` و`GRACE_PERIOD`، وفترات الانتهاء، وحالات الشركة المحظورة. كما أصبحت إنشاءات الفروع والموظفين تستخدم فحص حدود الباقة داخل transaction بمستوى `Serializable` لتقليل خطر تجاوز الحد بسبب طلبين متزامنين.

تمت إضافة pagination لصفحة الموظفين بحجم 50 سجلًا، وتحويل إعادة حساب الرواتب إلى دفعات متوازية محدودة افتراضيًا إلى 10 ويمكن ضبطها حتى 25 عبر `PAYROLL_RECALC_CONCURRENCY`. كما أصبح pool Prisma قابلًا للضبط عبر `DB_CONNECTION_LIMIT` و`DB_POOL_TIMEOUT_SEC`، وأصبح build يرفض أخطاء TypeScript بدل تجاهلها. وتم إصلاح API الخطط العامة لاستخدام fallback نفسه.

## نتيجة benchmark المحلي

تم تشغيل نسخة standalone محلية بقاعدة بيانات غير متاحة، مع bypass staging فقط لقياس rendering ومسارات fallback. باستخدام 20 اتصالًا لمدة 3 ثوانٍ لكل اختبار، كانت النتائج التالية:

| المسار | RPS | متوسط latency | P99 | HTTP غير متوقع |
|---|---:|---:|---:|---:|
| `/` | 99 | 196 ms | 605 ms | 0 |
| `/pricing` | 99 | 196 ms | 531 ms | 0 |
| `/api/public/plans` | 680 | 29 ms | 39 ms | 0 |
| `/dashboard` redirect | 2,387 | 8 ms | 14 ms | 0؛ كل الردود 307 متوقعة |
| `/signup` | 100 | 192 ms | 507 ms | 0 |
| `/api/public/plans` burst | 980 | 40 ms | 101 ms | 0 |

هذه **ليست شهادة تحمل للإنتاج**؛ قاعدة البيانات غير متاحة، لذلك يجب إعادة الاختبار على staging ببيانات PostgreSQL واقعية، وبجلسات متعددة، وشركات بأحجام مختلفة. كما أن الـ benchmark السابق كان يعلن نجاحًا رغم 429/500؛ تم تصحيح السكربت ليحسب status codes غير المتوقعة كأخطاء حقيقية ويقبل redirect 307 المتوقع لمسار dashboard.

## بوابة الإطلاق المطلوبة

| المرحلة | شرط المرور |
|---|---|
| Staging | PostgreSQL managed حقيقي، migrations، seed غير تجريبي، Redis موزع، SMTP، وlogs قابلة للبحث |
| Load test | 50 شركة صغيرة، 10 شركات متوسطة، وشركة كبيرة بآلاف الموظفين؛ قياس p95/p99 للـ dashboard، الحضور، التقارير، Excel، والرواتب |
| Security | تدقيق كل Server Action، اختبار tenant isolation، اختبار صلاحيات الأدوار الأربعة، وتثبيت secrets خارج Git |
| Billing | webhook موقّع، transitions للاشتراك، enforcement على كل mutation وfeature gate، واختبار إيقاف/إعادة التفعيل |
| Recovery | backup يومي وPITR واستعادة تجريبية موثقة، مع تخزين ملفات مع backup منفصل |
| Launch | Pilot محدود، مراقبة 7 أيام، ثم رفع الحمل تدريجيًا بعد عدم وجود 5xx أو cross-tenant leakage |

## ملاحظات تشغيلية

استخدام Redis الموزع ليس رفاهية عند تشغيل أكثر من نسخة؛ بدون المتغيرات الخاصة به سيعمل fallback المحلي، وهو مناسب للتطوير لكنه لا يضمن حدًا موحدًا عبر النسخ. يجب استخدام token كتابي server-side فقط. وفق توثيق Upstash الرسمي، REST API يستخدم `Authorization: Bearer`، ويدعم endpoint `/pipeline` لإرسال أوامر Redis مجمعة، بينما pipeline ليست atomic؛ لذلك استُخدمت أوامر `INCR` و`EXPIRE` فقط لعداد النافذة، وليست لعملية مالية أو حجز مورد [1].

## المراجع

[1]: https://upstash.com/docs/redis/features/restapi "Upstash Redis REST API — official documentation"

[2]: https://upstash.com/docs/redis/sdks/ts/pipelining/pipeline-transaction "Upstash Redis pipeline and transaction documentation"

[3]: https://github.com/ganaatef/b-attend "B-Attend source repository"

## فحص preflight للإنتاج

أُضيف الأمر `npm run preflight:production`. تشغيله داخل بيئة التدقيق أعاد فشلًا مقصودًا بسبب غياب `DATABASE_URL` و`DIRECT_URL` و`APP_URL` و`SESSION_SECRET` وSMTP وRedis ومزود دفع حقيقي. هذا يمنع نشر نسخة ناقصة بالخطأ. تفاصيل الخطوات المختصرة موجودة في `RELEASE_RUNBOOK_AR.md`.

## ما بقي خارج الكود

لا يمكن إنشاء قاعدة PostgreSQL أو حساب Redis أو SMTP أو بوابة دفع حقيقية دون حسابات وبيانات يملكها صاحب المنتج. بعد توفيرها، يجب تشغيل migrations وpreflight وload test على staging، ثم Pilot محدود قبل فتح الاشتراكات العامة.
