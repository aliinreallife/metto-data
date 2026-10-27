import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import "blobatar/motion.css";
import "blobatar/gaze.css";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "../lib/theme";
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
      <head>
        <script
          id="metto-theme"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
