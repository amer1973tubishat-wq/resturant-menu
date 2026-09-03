'use client';

import { useCallback, useEffect, useState } from 'react';

export type Lang = 'en' | 'ar';

export const dict = {
  en: {
    signIn: 'Sign in', signOut: 'Sign out', dashboard: 'Dashboard', menu: 'Menu',
    categories: 'Categories', items: 'Items', hero: 'Hero', media: 'Media Library',
    content: 'Site Content', builder: 'Burger Builder', messages: 'Messages',
    users: 'Users', audit: 'Audit Log', settings: 'Settings', profile: 'Profile',
    search: 'Search', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    create: 'Create', add: 'Add', confirm: 'Confirm', loading: 'Loading…',
    username: 'Email or username', password: 'Password', rememberMe: 'Remember me',
    forgotPassword: 'Forgot your password?', currentPassword: 'Current password',
    newPassword: 'New password', confirmPassword: 'Confirm password',
    twoFactor: 'Two-factor authentication', enterCode: 'Enter the 6-digit code',
    backupCode: 'Or use a backup code', verify: 'Verify',
    mustChange: 'Set a new password', mustChangeHelp:
      'Your account requires a new password before you can continue.',
    price: 'Price', name: 'Name', description: 'Description', category: 'Category',
    available: 'Available', published: 'Published', spice: 'Spice level', badges: 'Badges',
    noResults: 'Nothing here yet', viewsChart: 'Visits, last 30 days',
    topItems: 'Most viewed items', recentActivity: 'Recent activity',
    newMessages: 'New messages', publishedItems: 'Published items',
    livePreview: 'Live preview', unsavedChanges: 'You have unsaved changes',
    theme: 'Theme', language: 'Language',
  },
  ar: {
    signIn: 'تسجيل الدخول', signOut: 'تسجيل الخروج', dashboard: 'الرئيسية', menu: 'المنيو',
    categories: 'الأقسام', items: 'الأصناف', hero: 'الواجهة', media: 'مكتبة الوسائط',
    content: 'محتوى الموقع', builder: 'اصنع برجرك', messages: 'الرسائل',
    users: 'المستخدمون', audit: 'سجل التدقيق', settings: 'الإعدادات', profile: 'الملف الشخصي',
    search: 'بحث', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل',
    create: 'إنشاء', add: 'إضافة', confirm: 'تأكيد', loading: 'جارٍ التحميل…',
    username: 'البريد أو اسم المستخدم', password: 'كلمة المرور', rememberMe: 'تذكّرني',
    forgotPassword: 'نسيت كلمة المرور؟', currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور',
    twoFactor: 'المصادقة الثنائية', enterCode: 'أدخل الرمز المكوّن من ٦ أرقام',
    backupCode: 'أو استخدم رمزاً احتياطياً', verify: 'تحقّق',
    mustChange: 'عيّن كلمة مرور جديدة', mustChangeHelp:
      'يجب تعيين كلمة مرور جديدة قبل المتابعة.',
    price: 'السعر', name: 'الاسم', description: 'الوصف', category: 'القسم',
    available: 'متوفر', published: 'منشور', spice: 'مستوى الحرارة', badges: 'الشارات',
    noResults: 'لا يوجد شيء بعد', viewsChart: 'الزيارات آخر ٣٠ يوماً',
    topItems: 'الأكثر مشاهدة', recentActivity: 'آخر النشاطات',
    newMessages: 'رسائل جديدة', publishedItems: 'أصناف منشورة',
    livePreview: 'معاينة مباشرة', unsavedChanges: 'لديك تغييرات غير محفوظة',
    theme: 'المظهر', language: 'اللغة',
  },
} as const;

export type Key = keyof typeof dict.en;

export function useLang() {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('baytna-admin-lang');
      if (saved === 'ar' || saved === 'en') setLangState(saved);
    } catch { /* private mode */ }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('baytna-admin-lang', next); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: Key) => dict[lang][key] ?? dict.en[key], [lang]);
  return { lang, setLang, t, dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const) };
}
