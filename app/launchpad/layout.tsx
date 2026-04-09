import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Maha Launchpad',
  description: 'Employee Onboarding Application for Maha Behavioral Health Services',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="text-slate-700">
        {children}
        <Toaster />
      </body>
    </html>
  )
}

