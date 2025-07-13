import LoginPage from "@/components/auth/login-page"

export default function Home() {
  // This component now acts as the entry point for the login flow.
  // The actual dashboard content is rendered via DashboardLayout
  // which is conditionally rendered based on login state in LoginPage.
  return <LoginPage />
}
