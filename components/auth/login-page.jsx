"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, Heart } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import img from "../../public/favicon.ico";
import Image from "next/image";

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState(null); // Removed TypeScript type annotation
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check for existing session on component mount
  useEffect(() => {
    const checkExistingSession = () => {
      const storedUser = localStorage.getItem("aba_user");
      const storedToken = localStorage.getItem("aba_token");
      const storedExpiry = localStorage.getItem("aba_token_expiry");

      if (storedUser && storedToken && storedExpiry) {
        const expiryTime = new Date(storedExpiry);
        const now = new Date();

        if (now < expiryTime) {
          setUser(JSON.parse(storedUser));
        } else {
          // Token expired, clear storage
          localStorage.removeItem("aba_user");
          localStorage.removeItem("aba_token");
          localStorage.removeItem("aba_token_expiry");
        }
      }

      setIsCheckingAuth(false);
    };

    checkExistingSession();
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    setLoginError("");

    if (!email || !password) {
      setLoginError("Please enter both email and password");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store user data and token in localStorage
        localStorage.setItem("aba_user", JSON.stringify(data.user));
        localStorage.setItem("aba_token", data.token);
        localStorage.setItem("aba_token_expiry", data.expires_at);

        // Set user state to trigger dashboard render
        setUser(data.user);

        toast.success(`Welcome back, ${data.user.first_name}!`);
      } else {
        setLoginError(data.error || "Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all stored data
    localStorage.removeItem("aba_user");
    localStorage.removeItem("aba_token");
    localStorage.removeItem("aba_token_expiry");

    // Reset state
    setUser(null);
    setEmail("");
    setPassword("");
    setLoginError("");

    toast.success("Logged out successfully");
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-200 via-blue-200 to-indigo-200 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="rounded-full bg-white shadow-lg p-4 animate-pulse">
              {/* <Heart className="h-8 w-8 text-teal-600" /> */}
              <Image src={img} className="h-10 w-10" alt="Maha Logo"/>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Mahaverse</h1>
              <p className="text-md font-bold text-slate-600">Shining in Every Shade of the Spectrum</p>
              <p className="text-sm text-teal-600 font-medium">
                Practice Management
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-2 text-slate-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <DashboardLayout userRole={user} onLogout={handleLogout} />;
  }
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-200 via-blue-200 to-indigo-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            {/* Replaced favicon import with Heart icon */}
            <div className="rounded-full bg-white shadow-lg p-4 transition-shadow duration-700">
              <Image src={img} className="h-10 w-10" />
            </div>
            <div className="text-left">
             <h1 className="text-3xl font-bold text-slate-800">Mahaverse</h1>
              <p className="text-md font-bold text-slate-700">Shining in Every Shade of the Spectrum</p>
              <p className="text-sm text-teal-600 font-medium">
                Practice Management
              </p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center text-slate-800">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center text-slate-600">
              Sign in to access your dashboard
            </CardDescription>
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
                disabled={isLoading}
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
                  disabled={isLoading}
                  onKeyPress={(e) => e.key === "Enter" && handleSignIn()}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-600 text-sm text-center">{loginError}</p>
              </div>
            )}

            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-lg disabled:opacity-50"
            >
              {isLoading ? "Signing In..." : "Sign In Securely"}
            </Button>

            <div className="text-center">
              <Button
                variant="link"
                className="text-sm text-teal-600 hover:text-teal-700"
              >
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
          <p>
            Your data is encrypted and protected with enterprise-grade security
          </p>
        </div>

        {/* <div className="text-center text-xs text-slate-500 bg-white/40 backdrop-blur rounded-lg p-3">
          <p className="font-medium mb-1">Demo Credentials:</p>
          <p>admin@maha.com | bcba@maha.com | parent@maha.com | rbt@maha.com</p>
          <p>Password: Password@2025</p>
        </div> */}
      </div>
      <Toaster />
    </div>
  );
}
