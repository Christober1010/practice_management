import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import Providers from "../app/provider"
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Mahaverse Shining in Every Shade of the Spectrum",
  description: "Comprehensive ABA Practice Management Software",
};

// export default async function RootLayout({ children }) {
//   return (
//     <html lang="en" suppressHydrationWarning>
//       <body className={inter.className}>
//         <ThemeProvider>{children}</ThemeProvider>
//       </body>
//     </html>
//   );
// }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
