'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  CreditCardIcon,
  ScaleIcon,
  ArrowRightOnRectangleIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { LayoutDashboard, FileText, UserPlus, File, ChevronDown } from 'lucide-react';
import { ensureAuth } from '@/lib/launchpad/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  canEditProfile?: boolean;
  canManageUsers?: boolean;
}

export default function Sidebar({
  currentView,
  onNavigate,
  onLogout,
  isOpen,
  onClose,
  canEditProfile = true,
  canManageUsers = false,
}: SidebarProps) {
  const router = useRouter();
  const isFormStepView = (view: string) => ['personal', 'emergency', 'professional', 'payroll', 'compliance'].includes(view);
  const [formMenuOpen, setFormMenuOpen] = useState(isFormStepView(currentView));
  const [profileOpen, setProfileOpen] = useState(false);
  const [authUser, setAuthUser] = useState<{ username?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const authResult = await ensureAuth();
      if (!mounted) return;
      if (authResult.success) {
        setAuthUser(authResult.user || null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const roleLabel = useMemo(() => {
    const value = (authUser?.role || '').toLowerCase();
    if (!value) return 'Unknown';
    if (value === 'viewer' || value === 'reader') return 'Reader';
    if (value === 'staff' || value === 'employee') return 'Staff';
    if (value === 'hr') return 'HR';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [authUser?.role]);

  const formSteps = [
    { id: 'personal', label: 'Personal Info', icon: UserIcon },
    { id: 'emergency', label: 'Emergency Contact', icon: ExclamationTriangleIcon },
    { id: 'professional', label: 'Professional Data', icon: AcademicCapIcon },
    { id: 'payroll', label: 'Bank Account Info', icon: CreditCardIcon },
    { id: 'compliance', label: 'Policies & Signatures', icon: ScaleIcon },
  ];

  const inFormFlow = isFormStepView(currentView);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-slate-200
        flex flex-col shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen !== false ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-3 hover:bg-slate-100 rounded-lg p-2 transition-colors -ml-2 flex-1">
                <img
                  src="/favicon.ico"
                  alt="Maha Logo"
                  className="rounded-full object-cover h-12 w-12 shadow-md"
                />
                <div className="flex items-center justify-between flex-1">
                  <div className="text-left">
                    <h1 className="text-xl font-bold text-slate-800">
                      Maha Launchpad
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Welcome Aboard!</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500 ml-2" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem
                onClick={() => {
                  router.push('/');
                }}
                className="cursor-pointer"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Mahaverse</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  router.push('/launchpad/form');
                }}
                className="cursor-pointer bg-teal-50 text-teal-700"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Maha Launchpad</span>
                <span className="ml-auto text-xs">✓</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 ml-2"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          <li>
            <button
              onClick={() => onNavigate('dashboard')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-3 ${
                currentView === 'dashboard'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`h-5 w-5 ${currentView === 'dashboard' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Dashboard</span>
            </button>
          </li>

          <li>
            <button
              onClick={() => onNavigate('offer-letter')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-3 ${
                currentView === 'offer-letter'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <File className={`h-5 w-5 ${currentView === 'offer-letter' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Offer Letter</span>
            </button>
          </li>
          
          {canEditProfile && (
            <li
              className="relative group"
              onMouseEnter={() => setFormMenuOpen(true)}
              onMouseLeave={() => setFormMenuOpen(false)}
            >
              <div className="flex items-center">
                <button
                  onClick={() => onNavigate('personal')}
                  className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${
                    inFormFlow
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <FileText className={`h-5 w-5 ${inFormFlow ? 'text-teal-600' : 'text-slate-400'}`} />
                    <span>My Profile</span>
                  </div>
                  <ChevronRightIcon
                    className={`h-4 w-4 transition-transform ${formMenuOpen ? 'rotate-90' : ''}`}
                  />
                </button>
              </div>
              {formMenuOpen && (
                <ul className="mt-2 space-y-1 shadow">
                  {formSteps.map((step) => {
                    const isActive = currentView === step.id;
                    const Icon = step.icon;
                    return (
                      <li key={step.id}>
                        <button
                          onClick={() => onNavigate(step.id)}
                          className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-3 ${
                            isActive
                              ? 'bg-teal-50 text-teal-700'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span>{step.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          )}

          {canManageUsers && (
            <li>
              <button
                onClick={() => onNavigate('users')}
                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-3 ${
                  currentView === 'users'
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <UserPlus className={`h-5 w-5 ${currentView === 'users' ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>User Accounts</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* Footer with Logout */}
      <div className="border-t border-slate-200 bg-slate-50">
        {/* Logout Button */}
        {onLogout && authUser && (
          <div className="px-3 py-4">
            <div
              className="relative"
              onMouseEnter={() => setProfileOpen(true)}
              onMouseLeave={() => setProfileOpen(false)}
            >
              <button
                onClick={() => setProfileOpen((prev) => !prev)}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-slate-800">
                    {authUser.username || 'Account'}
                  </div>
                  <div className="text-xs text-slate-500">{roleLabel}</div>
                </div>
                <ChevronRightIcon className={`h-4 w-4 transition-transform ${profileOpen ? 'rotate-90' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute bottom-[80%] left-0 right-0 mb-2 z-50">
                  <div className="rounded-lg border border-slate-200 bg-white shadow-lg p-3 space-y-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {authUser.username || 'Account'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {authUser.email || 'No email on file'}
                      </div>
                      <div className="text-xs text-slate-500">Role: {roleLabel}</div>
                    </div>
                    <div className="border-t border-slate-200 pt-2 space-y-2">
                      <button
                        onClick={() => {
                          // Redirect to unified Mahaverse login with forgot password view
                          const params = new URLSearchParams();
                          params.set('view', 'forgotPassword');
                          params.set('redirect', '/launchpad/form');
                          router.push(`/?${params.toString()}`);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors"
                      >
                        <span>Forgot Password</span>
                      </button>
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
