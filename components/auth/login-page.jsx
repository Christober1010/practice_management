"use client"

import { useState } from "react"
import { Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Shield, Users, FileText, Heart } from "lucide-react"
import DashboardLayout from "@/components/layout/dashboard-layout"
import Image from "next/image"
import img from "public/favicon.ico"
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [userRole, setUserRole] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  const handleLogin = (role) => {
    setUserRole(role)
  }

  const handleSignInSecurely = () => {
    setLoginError("") // Clear previous errors
    if (email === "admin@maha.com" && password === "Admin@2025") {
      setUserRole("admin")
    } else {
      setLoginError("Invalid email or password. Please try again.")
    }
  }

  if (userRole) {
    return <DashboardLayout userRole={userRole} />
  }

  return (
    <div className=" bg-gradient-to-br from-teal-200 via-blue-200 to-indigo-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <div className="rounded-full shadow-3xl transition-shadow duration-700 animate-shadowColor">
              {/* <Heart className="h-8 w-8 text-white" /> */}
              <Image src={img} className="h-16 w-16 rounded-full" alt="logo"/>
            </div>
            <div className="">
              <h1 className="text-3xl font-bold text-slate-800">ABA Connect</h1>
              <p className="text-sm text-teal-600 font-medium">Practice Management</p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center text-slate-800">Welcome Back</CardTitle>
            <CardDescription className="text-center text-slate-600">Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="therapist@example.com"
                className="h-12 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-12 pr-12 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

            <Button
              onClick={handleSignInSecurely}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-lg"
            >
              Sign In Securely
            </Button>

            {/* Demo Role Selection */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium">Or Demo Login As:</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleLogin("admin")}
                  className="h-12 border-slate-200 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleLogin("bcba")}
                  className="h-12 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  BCBA
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleLogin("rbt")}
                  className="h-12 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  RBT
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleLogin("parent")}
                  className="h-12 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Parent
                </Button>
              </div>
            </div>

            <div className="text-center">
              <Button variant="link" className="text-sm text-teal-600 hover:text-teal-700">
                Forgot your password?
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="text-center text-sm text-slate-600 space-y-1 bg-white/60 backdrop-blur rounded-lg p-4">
          <div className="flex items-center justify-center space-x-2">
            <Shield className="h-4 w-4 text-teal-600" />
            <span className="font-medium">HIPAA Compliant & Secure</span>
          </div>
          <p>Your data is encrypted and protected with enterprise-grade security</p>
        </div>
      </div>
      <Toaster position="bottom-right"/>
    </div>
  )
}
