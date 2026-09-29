# منصة HAJIB-EVENTS لإدارة الفعاليات والكوادر المستقلة (Freelancers)

نظام متكامل لتنظيم الفعاليات، توظيف الكوادر بنظام العمل المرن (Part-time)، وإدارة الحضور والانصراف الميداني باستخدام النطاق الجغرافي الذكي (Geofencing).

## المميزات التقنية
1. **Vanilla JavaScript**: بناء خفيف فائق السرعة بدون أطر عمل خارجية ثقيلة.
2. **Supabase Cloud Backend**: مصادقة آمنة، قاعدة بيانات علاقات PostgreSQL، ونظام تخزين المستندات (Storage).
3. **Smart Geofence Clock-in**: حساب دقيق للمسافة الجغرافية بين إحداثيات الفريلانسر وموقع الفعالية عبر معادلة Haversine للتأكد من وجوده الميداني.
4. **Zero-Emoji Architecture**: تصميم مؤسسي احترافي خالٍ تماماً من الرموز التعبيرية مع واجهة مستخدم RTL كاملة.
5. **جدولة ومزامنة التواريخ**: دعم الفعاليات اليومية، الأسبوعية، والشهرية وعرض الفعالية الحالية آلياً.

## متطلبات التشغيل والرفع السريع على GitHub

1. **إعداد Supabase**:
   - أنشئ مشروعاً جديداً في [Supabase](https://supabase.com).
   - انتقل إلى `SQL Editor` وقم بتشغيل ملف `schema.sql`.
   - انتقل إلى `Storage` وتأكد من إنشاء المجلدات:
     - `cvs`
     - `avatars`
     - `event-images`

2. **ربط المفاتيح**:
   - افتح ملف `app.js`.
   - استبدل القيم التالية ببيانات مشروعك:
     ```javascript
     const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
     const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
     ```

3. **النشر على GitHub Pages**:
   - ارفع الملفات إلى مستودع جديد على GitHub:
     ```bash
     git init
     git add .
     git commit -m "Initial commit - HAJIB-EVENTS Platform"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     git push -u origin main
     ```
   - من إعدادات المستودع في GitHub، توجه إلى **Pages** واختر الفرع `main` وسيتم إطلاق الموقع مباشرة.