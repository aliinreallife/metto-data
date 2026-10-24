import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const vazirmatn = localFont({
  src: [
    { path: "./fonts/Vazirmatn-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Vazirmatn-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Metto Data | داده‌های حمل‌ونقل ایران",
  description:
    "اطلاعات و عکس ایستگاهت را برای تکمیل داده‌های متو بفرست؛ بدون ساختن حساب.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={vazirmatn.variable}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
