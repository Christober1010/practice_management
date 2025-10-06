import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Added for is_active
import { Badge } from "@/components/ui/badge";
import { User, Shield, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function AddUserModal({ isOpen, onClose, onSave, editingUser }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [passwordKey, setPasswordKey] = useState(0); // To force remount password input

  const emptyUser = {
    id: uuidv4(),
    email: "",
    PASSWORD: "",
    role: "",
    first_name: "",
    last_name: "",
    is_active: 1,
  };

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          id: editingUser.id,
          email: editingUser.email || "",
          PASSWORD: "",
          role: editingUser.role || "",
          first_name: editingUser.first_name || editingUser.firstName || "",
          last_name: editingUser.last_name || editingUser.lastName || "",
          is_active:
            editingUser.is_active !== undefined ? editingUser.is_active : 1,
        });
      } else {
        setFormData(emptyUser);
      }
      setErrors({});
      setPasswordKey((prev) => prev + 1); // Force password input remount to clear autofill
    }
  }, [isOpen, editingUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCheckboxChange = (field) => (checked) => {
    setFormData({ ...formData, [field]: checked ? 1 : 0 });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    let hasErrors = false;

    const requiredEntry = (field, name) => {
      if (!field || !field.trim()) {
        hasErrors = true;
        newErrors[name] = "Missing Required Entry";
      }
    };

    requiredEntry(formData.email, "email");
    if (!editingUser) {
      requiredEntry(formData.PASSWORD, "PASSWORD");
    }
    requiredEntry(formData.role, "role");
    requiredEntry(formData.first_name, "first_name");
    requiredEntry(formData.last_name, "last_name");

    setErrors(newErrors);
    return hasErrors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const hasErrors = validateForm();
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

  const handleClose = () => {
    setFormData(emptyUser);
    setErrors({});
    onClose();
  };

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        className={
          errors[id]
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : ""
        }
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (
    id,
    label,
    value,
    onValueChange,
    children,
    placeholder = "Select..."
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className={
            errors[id]
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : ""
          }
        >
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
            {editingUser ? "Edit User" : "Add New User"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Single Section for All Fields */}
          <div className="space-y-6">
            {/* Account Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderInputWithError(
                "email",
                "Email",
                formData.email,
                handleInputChange,
                {
                  name: "email",
                  type: "email",
                  placeholder: "Enter email address",
                  autoComplete: "new-email",
                }
              )}
              {renderInputWithError(
                "PASSWORD",
                "Password",
                formData.PASSWORD,
                handleInputChange,
                {
                  name: "PASSWORD",
                  type: "password",
                  placeholder: editingUser
                    ? "Leave blank to keep current"
                    : "Enter password",
                  autoComplete: "new-password",
                  key: passwordKey,
                }
              )}
            </div>

            {renderSelectWithError(
              "role",
              "Role",
              formData.role,
              (value) => setFormData({ ...formData, role: value }),
              <>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="bcba">BCBA</SelectItem>
                <SelectItem value="rbt">RBT</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </>,
              "Select role"
            )}

            {/* Personal Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderInputWithError(
                "first_name",
                "First Name",
                formData.first_name,
                handleInputChange,
                { name: "first_name", placeholder: "Enter first name" }
              )}
              {renderInputWithError(
                "last_name",
                "Last Name",
                formData.last_name,
                handleInputChange,
                { name: "last_name", placeholder: "Enter last name" }
              )}
            </div>

            {/* Active Status Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active === 1}
                onCheckedChange={handleCheckboxChange("is_active")}
                className={
                  errors.is_active
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : ""
                }
              />
              <Label htmlFor="is_active">Active</Label>
              {errors.is_active && (
                <p className="text-red-500 text-sm ml-4">{errors.is_active}</p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? "Saving..." : editingUser ? "Update User" : "Add User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
