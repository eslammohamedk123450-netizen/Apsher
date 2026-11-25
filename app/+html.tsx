import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * قالب HTML لجذر تطبيق الويب.
 * ضبط `dir="rtl"` على عنصر <html> يجعل react-native-web يبني كل الصفوف
 * باتجاه عربي من أول رسمة، بدل الاعتماد على I18nManager بعد أول عرض.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
