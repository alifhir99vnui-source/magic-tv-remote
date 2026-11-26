# سينما العقابي · Al-Uqabi Cinema

تطبيق **Native Android** احترافي مبني بـ **Kotlin + Jetpack Compose + Media3 (ExoPlayer)** لمشاهدة الأفلام والمسلسلات وقنوات البث المباشر بتصميم داكن مستوحى من Netflix، مع دعم كامل للغة العربية (**RTL**) والإنجليزية (**LTR**).

## المميزات الرئيسية

- **هوية مرنة بدون أيقونة مخصصة:** يستخدم التطبيق الأيقونة الافتراضية القياسية لنظام أندرويد في `AndroidManifest.xml` لتتمكن من إضافة الشعار الخاص بك (`ic_launcher`) لاحقاً.
- **حسابات Supabase سحابية:**
  - تسجيل الدخول وإنشاء حساب بالبريد الإلكتروني وكلمة المرور.
  - تسجيل سريع عبر Google ID Token و Facebook OAuth (App ID `1695851235579606`، مشروع `lsqpmchchaujrjoldbyl`).
  - جلسات Supabase محفوظة محلياً عبر DataStore مع تحديث تلقائي للرموز وتسجيل خروج آمن.
  - العودة من Facebook OAuth عبر `cinealuqabi://auth-callback`؛ لا تُخزّن أسرار Facebook داخل التطبيق.
  - أُزيلت مسارات X/Twitter وتسجيل الدخول برقم الهاتف/OTP.
  - أيقونة **☰** في الشريط العلوي تفتح شاشة **الملف الشخصي** المنفصلة عن الإعدادات (تعديل البيانات، المفضلة، سجل المشاهدة، تسجيل الخروج).
- **5 أقسام رئيسية في الشريط السفلي:** الرئيسية، أفلام، مسلسلات، بث مباشر، الإعدادات.
- **مصادر مرنة وربط تلقائي مع TMDB:**
  - جلب البوسترات والتقييمات والتفاصيل والمواسم والحلقات من **TMDB API** (مفتاح v3 أو Bearer Token من الإعدادات).
  - إضافة وتعديل ومزامنة قوائم **M3U / IPTV**، وملفات **JSON**، والروابط المباشرة (`MP4` / `M3U8`) من الإعدادات أو من ذاكرة الجهاز.
  - مطابقة تلقائية بين أعمال TMDB ومصادرك عبر `tmdb_id` أو الاسم، مع إمكانية لصق رابط مباشر لأي فيلم أو حلقة.
- **مشغّل Media3 / ExoPlayer داخلي 100% بمواصفات احترافية:**
  - واجهة بدون أي إيموجي (أيقونات Vector فقط) مع إخفاء تلقائي بعد 3 ثوانٍ.
  - أزرار تقديم وتأخير **±10 ثوانٍ** + النقر المزدوج (Double-Tap) مع حركة انسيابية.
  - **إيماءات السحب على الأطراف:** الطرف الأيمن للتحكم بالصوت والطرف الأيسر للتحكم بالإضاءة مع مؤشر HUD عمودي.
  - **Pinch-to-Zoom** بإصبعين + زر تبديل أبعاد الشاشة (**Fit / Fill / Zoom / Stretch**).
  - اختيار جودة الفيديو والمسار الصوتي (الدبلجة).
  - إدارة الترجمة الكاملة (**SRT / VTT** من الهاتف أو رابط أو مدمجة) مع تغيير حجم الخط، لون النص، لون الخلفية، وتوقيت الترجمة (**±ms**).
  - قفل الشاشة، سرعة التشغيل (`0.5x` إلى `2.0x`)، تدوير الشاشة، صورة داخل صورة (**PiP**)، قائمة الحلقات وزر **الحلقة التالية**، وحفظ آخر موضع للمشاهدة تلقائياً.

## صيغة ملف JSON المدعومة للمصادر

```json
{
  "movies": [
    {
      "tmdb_id": 550,
      "title": "Fight Club",
      "title_ar": "نادي القتال",
      "year": "1999",
      "rating": 8.4,
      "qualities": [
        { "label": "1080p", "url": "https://example.com/movie-1080.mp4" },
        { "label": "720p", "url": "https://example.com/movie-720.mp4" }
      ],
      "subtitles": [
        { "label": "العربية", "language": "ar", "url": "https://example.com/movie-ar.srt" }
      ]
    }
  ],
  "series": [
    {
      "tmdb_id": 1396,
      "title": "Breaking Bad",
      "seasons": [
        {
          "season_number": 1,
          "episodes": [
            {
              "episode_number": 1,
              "title": "Pilot",
              "stream_url": "https://example.com/s1e1.m3u8"
            }
          ]
        }
      ]
    }
  ],
  "channels": [
    {
      "name": "Baghdad TV",
      "group": "Iraq",
      "logo": "https://example.com/logo.png",
      "stream_url": "https://example.com/live.m3u8"
    }
  ]
}
```

## بناء ملف APK وتثبيته

### GitHub Actions (الطريقة الموصى بها خارج أجهزة aarch64)

أضف في إعدادات المستودع → Secrets and variables → Actions هذه القيم:

- `SUPABASE_URL` و `SUPABASE_ANON_KEY` (مطلوبان).
- `GOOGLE_WEB_CLIENT_ID` و `TMDB_API_KEY` (اختياريان).

يعمل سير `.github/workflows/android.yml` على `ubuntu-latest`، ويثبّت Android SDK 35، ويشغّل الاختبارات، وينتج `app-debug.apk` و `app-release.apk` كمرفقات (Artifacts). بعد التنزيل ثبّت على الجهاز:

```bash
adb install -r app-debug.apk
```

### بناء محلي على x86_64

المتطلبات: JDK 17، Android SDK 35، Gradle 8.11.1، و`adb` للتثبيت. أنشئ ملف `local.properties` غير المُودع في Git:

```properties
sdk.dir=/path/to/Android/Sdk
SUPABASE_URL=https://lsqpmchchaujrjoldbyl.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
GOOGLE_WEB_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
```

ثم شغّل:

```bash
bash scripts/build-apk.sh
bash scripts/build-apk.sh --install
```

السكربت يفشل بوضوح على `aarch64`/`arm64` لأن AAPT2 المرفق بـ Android Gradle Plugin يعمل على x86-64 فقط؛ استخدم GitHub Actions أو جهاز x86_64 في هذه الحالة. لا تضف `local.properties` أو أي مفاتيح إلى Git.

### إعداد Supabase يدوياً

فعّل مزوّدي Email و Google و Facebook في لوحة Supabase، واضبط Facebook App Secret داخل اللوحة فقط، وأضف `https://lsqpmchchaujrjoldbyl.supabase.co/auth/v1/callback` إلى Redirect URIs في تطبيق Facebook، وأضف `cinealuqabi://auth-callback` إلى Redirect URLs في Supabase، ثم نفّذ `supabase_setup.sql` في SQL Editor.
