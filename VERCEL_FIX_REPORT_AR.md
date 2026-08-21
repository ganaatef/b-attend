# تقرير إصلاح رفض Vercel

## السبب المؤكد

فشل نشر commit `c8ea8bb` بعد نجاح Next.js في التجميع وTypeScript وتوليد الصفحات، ثم فشل Vercel في مرحلة `onBuildComplete` عند محاولة قراءة:

```text
/vercel/path0/.next/next-server.js.nft.json
```

الخطأ ليس من صفحة أو استعلام قاعدة بيانات. اللوج يوضح أن الفشل حدث بعد اكتمال build في بيئة Vercel، مع Next.js `16.3.2` و`output: "standalone"` ووجود convention قديم باسم `middleware.ts`.

## الإصلاح

تم تنفيذ إصلاحين متوافقين مع Vercel وNext.js 16:

| التغيير | النتيجة |
|---|---|
| تغيير `src/middleware.ts` إلى `src/proxy.ts` وتغيير `middleware()` إلى `proxy()` | إزالة convention deprecated في Next.js 16 |
| جعل `output: "standalone"` يعمل فقط خارج Vercel عبر `process.env.VERCEL` | ترك Vercel يعبئ native Next.js output بدل محاولة تغليف standalone/NFT مرة ثانية |
| إبقاء standalone في التشغيل الذاتي | لا يتأثر Docker/Node self-hosting المحلي |
| إبقاء `postbuild.js` | يتخطى النسخ تلقائيًا على Vercel عندما لا يوجد `.next/standalone` |

## التحقق

نجحت الفحوصات التالية بعد الإصلاح:

```text
npm run typecheck   PASS
npm run lint        PASS
npm run build       PASS
VERCEL=1 npm run build   PASS
```

في محاكاة Vercel، ظهر `ƒ Proxy (Middleware)` ولم يظهر `Build error` أو `ENOENT`، وظهر بدلًا منه:

```text
[postbuild] No standalone output found, skipping copy.
```

تم دفع الإصلاح إلى GitHub في commit:

```text
b0d60d3 Fix Vercel Next 16 build packaging
```

## الإجراء المطلوب في Vercel

أعد deployment من آخر commit `b0d60d3`. لا تحتاج إلى تغيير Build Command؛ اتركه `npm run build`. إذا ظل Vercel يستخدم build cache قديمًا، استخدم خيار Redeploy مع Clear build cache مرة واحدة. لا تضف `next-server.js.nft.json` يدويًا ولا تُرجع Next.js إلى إصدار أقدم.

## ملاحظة

تحذيرات `npm warn allow-scripts` في اللوج ليست سبب الرفض الحالي؛ build وصل إلى نهاية Next.js بنجاح قبل فشل packaging. كما أن قاعدة البيانات أو متغيرات الإنتاج ليست سبب هذا الخطأ المحدد.

## مراجع

[1]: https://community.vercel.com/t/next-js-16-3-1-preview-packaging-fails-in-onbuildcomplete-with-missing-next-server-js-nft-json/48121 "Vercel Community: Next.js 16.3.1 packaging failure"

[2]: https://nextjs.org/docs/messages/middleware-to-proxy "Next.js: Renaming Middleware to Proxy"

[3]: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output "Next.js: output and standalone documentation"
