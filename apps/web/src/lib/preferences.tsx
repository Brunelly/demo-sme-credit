import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "ar";
export type Theme = "light" | "dark";

const translations = {
  "Rasikh Bank": "بنك راسخ",
  "SME Credit Desk": "مكتب ائتمان المنشآت الصغيرة والمتوسطة",
  Applications: "الطلبات",
  "Review queue": "قائمة المراجعة",
  Settings: "الإعدادات",
  "UI kit": "مكتبة الواجهة",
  "Application queue": "قائمة الطلبات",
  "Oldest applications first": "الطلبات الأقدم أولاً",
  "Sample data": "بيانات تجريبية",
  Business: "المنشأة",
  Product: "المنتج",
  "Amount (SAR)": "المبلغ (ر.س)",
  Stage: "المرحلة",
  "SME financing applications": "طلبات تمويل المنشآت الصغيرة والمتوسطة",
  "No applications": "لا توجد طلبات",
  "New applications will appear here.": "ستظهر الطلبات الجديدة هنا.",
  "Selected application workspace": "مساحة عمل الطلب المحدد",
  "Select an application.": "اختر طلباً.",
  Facility: "التسهيل",
  "Active scenario": "السيناريو النشط",
  "Global setting · recorded per run": "إعداد عام · يُسجل لكل تشغيل",
  "Buyer quality": "تصنيف المشتري",
  "Not applicable": "لا ينطبق",
  "Assessment trail": "سجل التقييم",
  "Simulated sources · immutable specialist, review and rework record": "مصادر محاكاة · سجل ثابت لعمل المختص والمراجعة وإعادة العمل",
  "Run assessment": "تشغيل التقييم",
  "Assessment not completed": "لم يكتمل التقييم",
  "Loading assessment history": "جارٍ تحميل سجل التقييم",
  "Assessment history unavailable": "سجل التقييم غير متاح",
  "No assessment history": "لا يوجد سجل تقييم",
  "Run the four source specialists to create the first traceable assessment.": "شغّل مختصي المصادر الأربعة لإنشاء أول تقييم قابل للتتبع.",
  "Analyst review queue": "قائمة مراجعة المحلل",
  "Decide each recommendation under SME-CP-07 §7.1. Every action is written to the decision ledger.": "اتخذ قراراً بشأن كل توصية وفقاً للبند SME-CP-07 §7.1. يُسجل كل إجراء في سجل القرارات.",
  "Sample review data": "بيانات مراجعة تجريبية",
  "These cases are illustrative and labelled for the demonstration.": "هذه الحالات توضيحية وموسومة لأغراض العرض.",
  "Oldest received first": "الأقدم استلاماً أولاً",
  "Control-centre settings": "إعدادات مركز التحكم",
  "Manage the simulated source data used by every subsequent assessment.": "إدارة بيانات المصادر المحاكية المستخدمة في كل تقييم لاحق.",
  "Simulated assessment scenario": "سيناريو التقييم المحاكى",
  "Save scenario": "حفظ السيناريو",
  "Use dark theme": "استخدام النسق الداكن",
  "Use light theme": "استخدام النسق الفاتح",
} as const;

type TranslationKey = keyof typeof translations;
interface PreferencesValue {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  t: (text: string) => string;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function storedValue<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && valid.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => storedValue("rasikh-locale", ["en", "ar"], "en"));
  const [theme, setTheme] = useState<Theme>(() => storedValue("rasikh-theme", ["light", "dark"], "light"));

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("rasikh-locale", locale);
      localStorage.setItem("rasikh-theme", theme);
    } catch { /* Preferences still apply when storage is unavailable. */ }
  }, [locale, theme]);

  const value = useMemo<PreferencesValue>(() => ({
    locale,
    theme,
    setLocale,
    setTheme,
    t: (text) => locale === "ar" ? translations[text as TranslationKey] ?? text : text,
  }), [locale, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used within PreferencesProvider");
  return value;
}
