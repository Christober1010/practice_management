import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { User, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // New import for UUID generation

export default function AddUserModal({ isOpen, onClose, onSave, editingUser }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('account');
  const [saving, setSaving] = useState(false);
  const [passwordKey, setPasswordKey] = useState(0);  // To force remount password input

  const tabOrder = ['account', 'personal'];

  const emptyUser = {
    id: uuidv4(),
    email: '',
    PASSWORD: '',
    role: '',
    first_name: '',
    last_name: '',
    is_active: 1,
  };

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          id: editingUser.id,
          email: editingUser.email || '',
          PASSWORD: '',
          role: editingUser.role || '',
          first_name: editingUser.first_name || editingUser.firstName || '',
          last_name: editingUser.last_name || editingUser.lastName || '',
          is_active: editingUser.is_active !== undefined ? editingUser.is_active : 1,
        });
      } else {
        setFormData(emptyUser);
      }
      setActiveTab('account');
      setErrors({});
      setPasswordKey((prev) => prev + 1);  // Force password input remount to clear autofill
    }
  }, [isOpen, editingUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateCurrentTab = (tab) => {
    const currentTabErrors = {};
    let hasErrors = false;

    const requiredEntry = (field) => {
      if (!field || !field.trim()) {
        hasErrors = true;
        return 'Missing Required Entry';
      }
      return null;
    };

    switch (tab) {
      case 'account':
        currentTabErrors.email = requiredEntry(formData.email);
        if (!editingUser) {
          currentTabErrors.PASSWORD = requiredEntry(formData.PASSWORD);
        }
        currentTabErrors.role = requiredEntry(formData.role);
        break;
      case 'personal':
        currentTabErrors.first_name = requiredEntry(formData.first_name);
        currentTabErrors.last_name = requiredEntry(formData.last_name);
        break;
      default:
        break;
    }

    const finalErrors = Object.fromEntries(
      Object.entries(currentTabErrors).filter(([, v]) => v !== null)
    );
    setErrors((prev) => ({ ...prev, ...finalErrors }));
    return hasErrors;
  };

  const validateAllTabs = () => {
    let hasAnyErrors = false;
    let firstErrorTab = null;

    for (const tab of tabOrder) {
      const hasTabErrors = validateCurrentTab(tab);
      if (hasTabErrors && !firstErrorTab) {
        firstErrorTab = tab;
      }
      hasAnyErrors = hasAnyErrors || hasTabErrors;
    }

    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
    }
    return hasAnyErrors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const hasErrors = validateAllTabs();
    if (hasErrors) {
      setSaving(false);
      return;
    }

    const dataToSave = { ...formData };
    if (editingUser && !formData.PASSWORD) {
      delete dataToSave.PASSWORD;
    }

    await onSave(dataToSave);
    setSaving(false);
    handleClose();
  };

  const handleNextTab = (e) => {
    e.preventDefault();
    setErrors({});
    const hasErrors = validateCurrentTab(activeTab);
    if (hasErrors) return;

    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else {
      handleSave(e);
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    setFormData(emptyUser);
    setErrors({});
    setActiveTab('account');
    onClose();
  };

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        className={errors[id] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (id, label, value, onValueChange, children, placeholder = 'Select...') => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={errors[id] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-teal-600" />
            {editingUser ? 'Edit User' : 'Add New User'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="space-y-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="account" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Account
                </TabsTrigger>
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Personal
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="account" className="space-y-6">
              <div>
                <Badge variant="destructive" className="ml-2">Required</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInputWithError(
                  'email',
                  'Email',
                  formData.email,
                  handleInputChange,
                  { name: 'email', type: 'email', placeholder: 'Enter email address', autoComplete: 'new-email' }
                )}
                {renderInputWithError(
                  'PASSWORD',
                  'Password',
                  formData.PASSWORD,
                  handleInputChange,
                  { name: 'PASSWORD', type: 'password', placeholder: editingUser ? 'Leave blank to keep current' : 'Enter password', autoComplete: 'new-password', key: passwordKey }
                )}
              </div>
              {renderSelectWithError(
                'role',
                'Role',
                formData.role,
                (value) => setFormData({ ...formData, role: value }),
                <>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="bcba">BCBA</SelectItem>
                  <SelectItem value="rbt">RBT</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </>,
                'Select role'
              )}
            </TabsContent>

            <TabsContent value="personal" className="space-y-6">
              <div>
                <Badge variant="destructive" className="ml-2">Required</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInputWithError(
                  'first_name',
                  'First Name',
                  formData.first_name,
                  handleInputChange,
                  { name: 'first_name', placeholder: 'Enter first name' }
                )}
                {renderInputWithError(
                  'last_name',
                  'Last Name',
                  formData.last_name,
                  handleInputChange,
                  { name: 'last_name', placeholder: 'Enter last name' }
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between gap-3 pt-6 border-t">
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {activeTab !== tabOrder[0] && (
                <Button type="button" variant="outline" onClick={handlePreviousTab}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                {saving ? 'Saving...' : (isLastTab ? (editingUser ? 'Update User' : 'Add User') : 'Save & Continue')}
              </Button>
              {!isLastTab && (
                <Button type="button" onClick={handleNextTab} variant="outline">
                  Next
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
