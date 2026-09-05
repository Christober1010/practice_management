'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createUser } from '@/lib/launchpad/api';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'staff', label: 'Staff' },
  { value: 'viewer', label: 'Viewer' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function AdminUsers() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [status, setStatus] = useState('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isFormValid = useMemo(() => {
    return username.trim().length >= 3 && password.length >= 8;
  }, [username, password]);

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('staff');
    setStatus('active');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);
    const response = await createUser({
      username: username.trim(),
      password,
      email: email.trim() || undefined,
      role,
      is_active: status === 'active',
    });

    if (response.success) {
      setFeedback({ type: 'success', message: response.message || 'User created successfully.' });
      resetForm();
    } else {
      setFeedback({ type: 'error', message: response.message || 'Failed to create user.' });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">User Administration</h2>
        <p className="text-slate-500 mt-2">Create new accounts for staff who need access.</p>
      </header>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create">Create User</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create a new user</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-username">Username</Label>
                    <Input
                      id="user-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. jdoe"
                      autoComplete="off"
                    />
                    <p className="text-xs text-slate-500">Internal id only. Welcome email tells them to sign in with email.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email (for login)</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Temporary Password</Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {feedback && (
                  <div className={feedback.type === 'success' ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
                    {feedback.message}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? 'Creating…' : 'Create User'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                    Reset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

