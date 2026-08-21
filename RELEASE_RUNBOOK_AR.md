# Runbook إطلاق B-Attend

## الحكم

الإصدار الحالي مناسب لـ **Pilot مدفوع محدود** بعد تجهيز الخدمات الخارجية. الإطلاق العام للاشتراكات لا يبدأ قبل نجاح preflight واختبار PostgreSQL وRedis الحقيقيين.

## ما يجهزه مالك المنتج

| المطلوب | الغرض | الحالة المطلوبة |
|---|---|---|
| PostgreSQL مُدارة | بيانات الشركات والموظفين والحضور والرواتب | رابط `DATABASE_URL` و`DIRECT_URL` مع TLS |
| Upstash Redis | Rate limiting موحّد بين نسخ الخادم | `UPSTASH_REDIS_REST_URL` و`UPSTASH_REDIS_REST_TOKEN` |
| SMTP | رسائل التسجيل والتفعيل والدعم | `SMTP_HOST` و`SMTP_USER` و`SMTP_PASS` و`EMAIL_FROM` |
| بوابة دفع | بيع الاشتراكات آليًا | مزود مدعوم فعليًا، webhook موقّع، وسر `PAYMENT_WEBHOOK_SECRET` |
| نطاق HTTPS | جلسات آمنة ورسائل موثوقة | `APP_URL` نهائي على HTTPS |
| أسرار الجلسة | منع تزوير الجلسات | `SESSION_SECRET` عشوائي لا يقل عن 32 حرفًا |
| النسخ الاحتياطي | استعادة بيانات العملاء | backup يومي وPITR مع تجربة استعادة |

## خطوات التشغيل

نفّذ الخطوات التالية في بيئة staging أولًا، وليس على قاعدة بيانات العملاء مباشرة:

```bash
npm ci --omit=dev --no-audit
npx prisma generate
npm run db:migrate:deploy
npm run preflight:production
npm run build
npm run start
```

يجب أن ينتهي `preflight:production` بحالة `PASS`. في الوضع الحالي، سيُظهر `FAIL` عمدًا لأن بيئة التدقيق لا تحتوي أسرار الإنتاج ولا قواعد البيانات الخارجية.

## اختبار القبول

بعد تشغيل staging، شغّل اختبار الحمل من جهاز منفصل أو runner مخصص:

```bash
TEST_URL=https://staging.example.com \
LOAD_TEST_DURATION=30 \
LOAD_TEST_CONNECTIONS=50 \
LOAD_TEST_BURST_CONNECTIONS=100 \
npm run test:load
```

قبل اختبار الحمل، استخدم رمز bypass staging المخصص فقط إن كان مطلوبًا، ولا تضبط `ALLOW_LOAD_TEST_BYPASS=true` على الإنتاج. يجب أن تكون كل الأكواد غير المتوقعة صفرًا، وألا توجد 5xx، وألا يتجاوز P99 حدودًا تقبلها الشركة لكل مسار.

## سيناريوهات يجب اختبارها يدويًا

يجب إنشاء شركتين منفصلتين، ثم التأكد أن مستخدم الشركة الأولى لا يستطيع رؤية أو تعديل أي موظف أو فرع أو تقرير للشركة الثانية. اختبر كذلك تجاوز حد الموظفين والفروع، إيقاف الاشتراك، انتهاء التجربة، انتهاء فترة السماح، إعادة التفعيل، تسجيل الدخول، استعادة كلمة المرور إن كانت مفعلة، تصدير Excel، إنشاء payroll run، وإعادة حسابه مع 1,000 موظف تجريبي في staging.

## سياسة الإطلاق

ابدأ بثلاث إلى خمس شركات Pilot، مع تفعيل يدوي ومراقبة يومية لمدة أسبوع. لا تُفعّل checkout عامًا إلا بعد نجاح preflight، webhook الدفع، النسخ الاحتياطي والاستعادة، وtenant-isolation test. احتفظ بخطة rollback للـ commit السابق، ولا تستخدم `DEMO_SEED_CONFIRM=true` في أي بيئة إنتاجية.
