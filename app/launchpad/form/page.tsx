'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/launchpad/Sidebar';
import Dashboard from '@/components/launchpad/Dashboard';
import FormView from '@/components/launchpad/FormView';
import OfferLetterView from '@/components/launchpad/OfferLetterView';
import SubmissionModal from '@/components/launchpad/SubmissionModal';
import LogoutConfirmationModal from '@/components/launchpad/LogoutConfirmationModal';
import AdminUsers from '@/components/launchpad/AdminUsers';
import ClientIntakeView from '@/components/launchpad/ClientIntakeView';
import { useFormState } from '@/components/launchpad/form/useFormState';
import { useProgress } from '@/components/launchpad/form/useProgress';
import { checkAuth, ensureAuth, submitForm, getCsrfToken, logout, listMyStaff, getAttachmentViewUrl, type StaffListItem } from '@/lib/launchpad/api';

function readLaunchpadPermissions(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return [];
    const j = JSON.parse(raw) as { permissions?: string[] };
    return Array.isArray(j.permissions) ? j.permissions : [];
  } catch {
    return [];
  }
}

export default function FormPage() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ isSuccess: false, title: '', message: '' });
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default on mobile
  const [myStaff, setMyStaff] = useState<StaffListItem[]>([]);
  const [myStaffLoading, setMyStaffLoading] = useState(false);
  const [myStaffError, setMyStaffError] = useState<string | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [authRoleRaw, setAuthRoleRaw] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { formData, updateField, overwriteForm, resetForm } = useFormState();
  const progress = useProgress(formData);
  const lpPerms = readLaunchpadPermissions();
  const isAdmin = authRole === 'admin';
  const canFillProfile =
    lpPerms.length > 0
      ? lpPerms.includes('launchpad.profile_submit')
      : authRole === 'admin' || authRole === 'employee';
  const canManageUsers =
    lpPerms.length > 0 ? lpPerms.includes('launchpad.users') : authRoleRaw === 'admin';
  const normalizeRole = (role?: string | null) => {
    const value = (role || '').toLowerCase();
    if (value === 'viewer' || value === 'reader') return 'reader';
    if (value === 'staff' || value === 'employee') return 'employee';
    if (value === 'hr') return 'admin';
    return value || null;
  };

  useEffect(() => {
    // Deep link support (used in initiation emails): /form?view=offer-letter
    try {
      const view = new URLSearchParams(window.location.search).get('view') || '';
      if (view.toLowerCase() === 'offer-letter') setCurrentView('offer-letter');
    } catch {
      // ignore
    }
  }, []);

  const handleEditStaff = async (staff: StaffListItem, targetView: string = 'personal') => {
    if (!canFillProfile) return;
    // Extra safety: staff can only edit their own entries (admins can edit all)
    const authResult = checkAuth();
    const currentUserId = authResult.success ? Number(authResult.user?.id) : NaN;
    if (!isAdmin && Number.isFinite(currentUserId) && staff.created_by_user_id && staff.created_by_user_id !== currentUserId) {
      return;
    }
    const certTypes = staff.certifications?.map((cert) => cert.cert_type).filter(Boolean) || [];
    const firstCert = staff.certifications?.find((cert) => cert.cert_number || cert.exp_date);
    const signatureAttachment = staff.attachments?.find((att) => att.attachment_type === 'SIGNATURE');
    const hasExistingCpr = staff.attachments?.some((att) => att.attachment_type === 'CPR') ?? false;
    const hasExistingCertificate = staff.attachments?.some((att) => att.attachment_type === 'CERTIFICATE') ?? false;
    const existingCprFile = staff.attachments?.find((att) => att.attachment_type === 'CPR') || null;
    const existingCertificateFile = staff.attachments?.find((att) => att.attachment_type === 'CERTIFICATE') || null;
    let signatureDataUrl = '';
    let signatureDate = '';

    if (signatureAttachment) {
      try {
        const resp = await fetch(getAttachmentViewUrl(signatureAttachment.attachment_id));
        const blob = await resp.blob();
        signatureDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read signature'));
          reader.readAsDataURL(blob);
        });
        if (signatureAttachment.created_at) {
          signatureDate = new Date(signatureAttachment.created_at).toISOString().slice(0, 10);
        }
      } catch (e) {
        signatureDataUrl = '';
        signatureDate = '';
      }
    }

    overwriteForm({
      staffId: staff.staff_id,
      formType: 'Update',
      firstName: staff.first_name || '',
      middleName: staff.middle_name || '',
      lastName: staff.last_name || '',
      jobTitle: staff.job_title || '',
      employmentStatus: staff.employment_status || '',
      ssn: staff.ssn_full || '',
      dob: staff.date_of_birth || '',
      email: staff.email || '',
      cellPhone: staff.cell_phone || '',
      homeWorkPhone: staff.home_phone || staff.work_phone || '',
      fullAddress: staff.full_address || '',
      emergencyName: staff.emergency_contact_name || '',
      relationship: staff.emergency_relationship || '',
      primaryPhone: staff.emergency_primary_phone || '',
      secondaryPhone: staff.emergency_secondary_phone || '',
      highestDegree: staff.highest_degree || '',
      yearAwarded: staff.year_awarded || '',
      major: staff.major || '',
      licenseStatus: staff.license_status || '',
      licenseExpDate: staff.license_exp_date || '',
      npiNumber: staff.npi_number || '',
      languages: staff.languages || '',
      specialtyAreas: staff.specialty_areas || '',
      certTypes,
      certNumber: firstCert?.cert_number || '',
      certExpDate: firstCert?.exp_date || '',
      cprUpload: null,
      certificateUpload: null,
      hasExistingCpr,
      hasExistingCertificate,
      existingCprFilename: existingCprFile?.original_filename || null,
      existingCertificateFilename: existingCertificateFile?.original_filename || null,
      bankName: staff.bank_name || '',
      accountName: staff.account_name || '',
      accountNumber: staff.account_number || '',
      routingNumber: staff.routing_number || '',
      accountType: staff.account_type || '',
      payrollAuth: !!staff.authorization_agreed,
      hipaaAck: !!staff.hipaa_acknowledged,
      abuseAck: !!staff.abuse_reporting_acknowledged,
      digitalSignature: signatureDataUrl,
      signatureDate,
    });

    setCurrentView(targetView);
  };

  const loadMyStaff = async (opts?: { name?: string; share_key?: string }) => {
    const authResult = checkAuth();
    if (!authResult.success) return;

    const roleRaw = String(authResult.user?.role || '').toLowerCase();
    const role = normalizeRole(roleRaw);
    setAuthRole(role);
    setAuthRoleRaw(roleRaw || null);

    setMyStaffLoading(true);
    setMyStaffError(null);

    // Reader must provide a share key; otherwise show no results.
    if (role === 'reader' && !opts?.share_key) {
      setMyStaff([]);
      setMyStaffLoading(false);
      setMyStaffError(null);
      return;
    }

    const res = await listMyStaff(role === 'reader' ? { share_key: opts?.share_key } : undefined);
    if (res.success && res.staff) {
      setMyStaff(res.staff);
    } else {
      setMyStaffError(res.message || 'Failed to load your staff entries.');
    }
    setMyStaffLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const authResult = await ensureAuth();
      if (!mounted) return;
      if (!authResult.success) {
        const params = new URLSearchParams();
        params.set('redirect', '/launchpad/form');
        router.push(`/?${params.toString()}`);
        return;
      }
      const roleRaw = String(authResult.user?.role || '').toLowerCase();
      setAuthRole(normalizeRole(roleRaw));
      setAuthRoleRaw(roleRaw || null);
      setIsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    // Load "My Entries" list
    loadMyStaff();
  }, []);

  // Prevent non-admin roles from entering the form flow
  useEffect(() => {
    // Only block reader/view-only users from entering the form flow
    if (authRole === 'reader' && currentView !== 'dashboard' && currentView !== 'offer-letter') {
      setCurrentView('dashboard');
    }
  }, [authRole, currentView]);

  useEffect(() => {
    if (currentView === 'users' && !canManageUsers) {
      setCurrentView('dashboard');
    }
  }, [currentView, canManageUsers]);

  const handleSubmit = async () => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      setModalData({
        isSuccess: false,
        title: 'Submission Failed',
        message: 'Security token missing. Please refresh and try again.',
      });
      setIsModalOpen(true);
      return;
    }

    if (progress.percentage !== 100) {
      setModalData({
        isSuccess: false,
        title: 'Submission Failed: Incomplete',
        message: `Please ensure all required fields are completed. Your packet is currently ${progress.percentage}% complete. Review all 5 steps to find missing information.`,
      });
      setIsModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitForm(formData, csrfToken);
      setModalData({
        isSuccess: response.success || false,
        title: response.title || (response.success ? 'Success!' : 'Submission Failed'),
        message: response.message || '',
      });
      setIsModalOpen(true);
      
      if (response.success) {
        resetForm();
        setFormKey((prev) => prev + 1);
        // Refresh staff list after a successful submission
        await loadMyStaff();
        setTimeout(() => {
          setCurrentView('dashboard');
        }, 2000);
      }
    } catch (error) {
      setModalData({
        isSuccess: false,
        title: 'Submission Failed',
        message: 'There was a problem submitting the form. Please try again.',
      });
      setIsModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
        <Sidebar 
          currentView={currentView} 
          onNavigate={(view) => {
            // Staff/employee should only ever work on their single existing profile.
            // If it exists, auto-load it when they click into the form flow.
            const isFormStep = ['personal', 'emergency', 'professional', 'payroll', 'compliance'].includes(view);
            if (isFormStep && authRole === 'employee' && myStaff.length > 0) {
              // List is already sorted DESC by staff_id from backend.
              void handleEditStaff(myStaff[0], view);
              setSidebarOpen(false);
              return;
            }

            setCurrentView(view);
            setSidebarOpen(false); // Close sidebar on mobile when navigating
          }} 
          onLogout={handleLogout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          canEditProfile={canFillProfile}
          canManageUsers={canManageUsers}
        />

        <main className="flex-1 overflow-y-auto relative bg-slate-50">
          <div className="md:hidden bg-white p-4 border-b flex justify-between items-center sticky top-0 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Open sidebar"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-brand-900">Maha Launchpad</h1>
            <button onClick={handleLogout} className="text-slate-500 hover:text-brand-600">
              Logout
            </button>
          </div>

          <div className="p-4 md:p-8 max-w-[90%] mx-auto space-y-8 pb-20">
            {currentView === 'dashboard' && (
              <Dashboard
                onNavigate={setCurrentView}
                onCreateNew={() => {
                  resetForm();
                  setFormKey((prev) => prev + 1);
                  setCurrentView('personal');
                }}
                myStaff={myStaff}
                myStaffLoading={myStaffLoading}
                myStaffError={myStaffError}
                onRefreshMyStaff={loadMyStaff}
                onEditStaff={handleEditStaff}
              />
            )}

            {currentView === 'users' && canManageUsers && <AdminUsers />}

            {currentView === 'offer-letter' && (
              <OfferLetterView
                staff={
                  myStaff.length > 0
                    ? {
                        staffId: myStaff[0].staff_id,
                        fullName: `${myStaff[0].first_name} ${myStaff[0].middle_name ? myStaff[0].middle_name + ' ' : ''}${myStaff[0].last_name}`.trim(),
                        jobTitle: myStaff[0].job_title || '',
                      }
                    : undefined
                }
                staffList={myStaff}
                onRefreshStaffList={loadMyStaff}
              />
            )}

            {currentView === 'client-intake' && (
              <ClientIntakeView
                onSubmitted={(result) => {
                  setModalData({
                    isSuccess: result.success,
                    title: result.title || (result.success ? 'Client Intake Submitted' : 'Submission Failed'),
                    message: result.message || '',
                  });
                  setIsModalOpen(true);
                  if (result.success) {
                    setTimeout(() => {
                      setCurrentView('dashboard');
                    }, 2000);
                  }
                }}
              />
            )}

            {currentView !== 'dashboard' && currentView !== 'users' && currentView !== 'offer-letter' && currentView !== 'client-intake' && (
              <FormView
                key={formKey}
                formData={formData}
                updateField={updateField}
                onSubmit={handleSubmit}
                currentStep={currentView}
                onStepChange={(step) => setCurrentView(step)}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        </main>
     

      <SubmissionModal
        isOpen={isModalOpen}
        isSuccess={modalData.isSuccess}
        title={modalData.title}
        message={modalData.message}
        onClose={() => setIsModalOpen(false)}
      />

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
}

