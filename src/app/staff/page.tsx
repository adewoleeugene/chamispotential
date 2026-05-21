'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Lock, Unlock, Phone, KeyRound, Users as UsersIcon, ShieldAlert, UserCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { IconHint } from '@/components/ui/tooltip';

type StaffMember = {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    isActive: boolean;
};

const ROLE_COPY: Record<string, { label: string; color: string; bg: string; hint: string }> = {
    admin:   { label: 'Administrator',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  hint: 'Full control of the system' },
    manager: { label: 'Manager',        color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', hint: 'Runs day-to-day operations' },
    kitchen: { label: 'Kitchen',        color: '#f97316', bg: 'rgba(249,115,22,0.12)', hint: 'Cooks tickets' },
    waiter:  { label: 'Waiter',         color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  hint: 'Takes orders and serves' },
    cashier: { label: 'Cashier',        color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  hint: 'Takes orders and handles payments' },
    staff:   { label: 'Support staff',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', hint: 'General floor support' },
};

const getRoleCopy = (role: string) => ROLE_COPY[role] || { label: role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', hint: '' };

const ROLE_PERMISSIONS: Record<string, { can: string[]; cant: string[] }> = {
    admin:   { can: ['Everything across the app'], cant: [] },
    manager: { can: ['Manage staff', 'View reports', 'Manage menu & inventory', 'Place orders'], cant: ['Change system settings'] },
    waiter:  { can: ['Place orders', 'Manage tables'], cant: ['View reports', 'Edit menu', 'Manage staff'] },
    cashier: { can: ['Place orders', 'Take payments', 'Manage tables'], cant: ['View reports', 'Edit menu', 'Manage staff'] },
    kitchen: { can: ['View kitchen tickets', 'Mark orders ready'], cant: ['Place orders', 'Edit menu', 'View reports'] },
    staff:   { can: ['Place orders', 'Manage tables'], cant: ['View reports', 'Edit menu', 'Manage staff'] },
};

const suggestUsername = (fullName: string) => {
    return fullName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .join('.');
};

export default function StaffPage() {
    const { user, logout, refresh } = useAuth();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', username: '', phone: '', password: '', role: 'waiter' });

    const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
    const [resetPassword, setResetPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');

    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchStaff = async () => {
        try {
            const r = await fetch('/api/staff');
            if (r.status === 401 || r.status === 403) {
                await refresh();
                return;
            }
            const d = await r.json();
            setStaff(Array.isArray(d) ? (d as StaffMember[]) : []);
        } catch {
            toast('error', 'Failed to load staff. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStaff(); }, []);

    const toggleActive = async (id: string, isActive: boolean) => {
        if (user?.role !== 'admin' && user?.role !== 'manager') {
            return toast('error', 'You do not have permission to change account status');
        }
        const res = await fetch(`/api/staff/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive }),
        });
        if (res.ok) {
            toast('success', `Account ${isActive ? 'activated' : 'deactivated'}`);
            setStaff(prev => prev.map(s => s.id === id ? { ...s, isActive } : s));
        } else {
            toast('error', 'Failed to update account');
        }
    };

    const openAddModal = () => {
        setModalMode('add');
        setEditingUserId(null);
        setFormData({ name: '', username: '', phone: '', password: '', role: 'waiter' });
        setIsModalOpen(true);
    };

    const openEditModal = (s: StaffMember) => {
        setModalMode('edit');
        setEditingUserId(s.id);
        setFormData({ name: s.name, username: s.email, phone: s.phone || '', password: '', role: s.role });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (modalMode === 'add') {
            const res = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                toast('success', `${formData.name} added — they’ll set their own password at first login`);
                setIsModalOpen(false);
                fetchStaff();
            } else {
                const err = await res.json().catch(() => null);
                toast('error', err?.error || 'Failed to add team member');
            }
        } else {
            const res = await fetch(`/api/staff/${editingUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.name, role: formData.role, phone: formData.phone }),
            });
            if (res.ok) {
                toast('success', 'Details updated');
                setIsModalOpen(false);
                fetchStaff();
            } else {
                toast('error', 'Failed to update details');
            }
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        const res = await fetch(`/api/staff/${deleteTarget.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        setDeleteLoading(false);
        if (res.ok) {
            toast('success', `${deleteTarget.name} has been removed`);
            setDeleteTarget(null);
            setStaff(prev => prev.filter(s => s.id !== deleteTarget.id));
        } else {
            const err = await res.json().catch(() => null);
            toast('error', err?.error || 'Failed to delete staff member');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetTarget) return;
        if (resetPassword !== resetConfirmPassword) {
            toast('error', 'Passwords do not match');
            return;
        }
        const res = await fetch(`/api/staff/${resetTarget.id}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
            body: JSON.stringify({ password: resetPassword }),
        });
        if (res.ok) {
            toast('success', `${resetTarget.name} must change this password at next login`);
            setResetTarget(null);
            setResetPassword('');
            setResetConfirmPassword('');
        } else if (res.status === 401) {
            toast('error', 'Your session has expired. Please log in again.');
            await logout();
        } else {
            const data = await res.json().catch(() => null);
            toast('error', data?.error || 'Failed to reset password');
        }
    };

    const visibleStaff = staff.filter((member) => {
        if (user?.role !== 'manager') return true;
        return !['admin', 'manager'].includes(member.role);
    });

    const editableRoleOptions = user?.role === 'manager'
        ? [
            { value: 'waiter', label: 'Waiter / Floor Staff' },
            { value: 'cashier', label: 'Cashier' },
            { value: 'kitchen', label: 'Kitchen Staff' },
        ]
        : [
            { value: 'waiter', label: 'Waiter / Floor Staff' },
            { value: 'cashier', label: 'Cashier' },
            { value: 'kitchen', label: 'Kitchen Staff' },
            { value: 'manager', label: 'Manager' },
            { value: 'admin', label: 'Administrator' },
        ];

    // ─── Manager-friendly summary stats ─────────────────────────────────────
    const activeCount = visibleStaff.filter(s => s.isActive).length;
    const inactiveCount = visibleStaff.filter(s => !s.isActive).length;
    const roleCounts = visibleStaff.reduce<Record<string, number>>((acc, s) => {
        if (s.isActive) acc[s.role] = (acc[s.role] || 0) + 1;
        return acc;
    }, {});
    const topRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 8 }}>
                        Your team
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display), serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4 }}>
                        {activeCount} {activeCount === 1 ? 'person' : 'people'} on the floor
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {user?.role === 'manager'
                            ? 'View and manage your frontline staff. Admins and other managers are hidden from this view.'
                            : 'Add new team members, set roles, and reset passwords when staff forget theirs.'}
                    </p>
                </div>
                {user?.role === 'admin' && (
                    <Button variant="primary" onClick={openAddModal}>
                        <Plus size={16} /> Add team member
                    </Button>
                )}
            </div>

            {/* Summary cards */}
            <div className="grid-3 gap-4 mb-6">
                <SummaryStat
                    icon={<UserCheck size={18} />}
                    label="Active right now"
                    value={String(activeCount)}
                    sub={inactiveCount > 0 ? `${inactiveCount} deactivated` : 'Everyone has access'}
                    accent="#22c55e"
                />
                <SummaryStat
                    icon={<UsersIcon size={18} />}
                    label="Roles in play"
                    value={String(topRoles.length)}
                    sub={topRoles.map(([r, c]) => `${c} ${getRoleCopy(r).label.toLowerCase()}`).join(' · ') || 'No staff yet'}
                    accent="#38bdf8"
                />
                <SummaryStat
                    icon={<ShieldAlert size={18} />}
                    label="Deactivated"
                    value={String(inactiveCount)}
                    sub={inactiveCount > 0 ? 'Tap the unlock icon on any card to activate' : 'Everyone is active'}
                    accent={inactiveCount > 0 ? '#f97316' : '#94a3b8'}
                />
            </div>

            {/* Staff cards */}
            <div className="grid-3 gap-4">
                {visibleStaff.map(member => {
                    const role = getRoleCopy(member.role);
                    const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                        <div
                            key={member.id}
                            className="card"
                            style={{
                                padding: 20,
                                opacity: member.isActive ? 1 : 0.6,
                                position: 'relative',
                            }}
                        >
                            <div className="flex items-start gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div
                                    style={{
                                        width: 46,
                                        height: 46,
                                        borderRadius: 14,
                                        background: 'var(--gradient-brand)',
                                        color: '#fffaf4',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        letterSpacing: '0.06em',
                                        boxShadow: 'var(--shadow-brand)',
                                        flexShrink: 0,
                                    }}
                                >
                                    {initials}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {member.name}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                background: member.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.18)',
                                                color: member.isActive ? '#22c55e' : '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.1em',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {member.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {member.email}
                                    </div>
                                    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: role.bg, color: role.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {role.label}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center" style={{ gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                                    <Phone size={13} />
                                    {member.phone || 'No phone'}
                                </div>
                                {(user?.role === 'admin' || user?.role === 'manager') && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <IconHint label="Edit details">
                                            <Button size="icon" variant="secondary" onClick={() => openEditModal(member)}>
                                                <Edit2 size={14} />
                                            </Button>
                                        </IconHint>
                                        {user?.role === 'admin' && (
                                            <IconHint label="Reset password">
                                                <Button size="icon" variant="secondary" onClick={() => setResetTarget({ id: member.id, name: member.name })}>
                                                    <KeyRound size={14} />
                                                </Button>
                                            </IconHint>
                                        )}
                                        <IconHint label={member.isActive ? 'Deactivate' : 'Activate'}>
                                            <Button
                                                size="icon"
                                                variant={member.isActive ? 'danger' : 'success'}
                                                onClick={() => toggleActive(member.id, !member.isActive)}
                                            >
                                                {member.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                                            </Button>
                                        </IconHint>
                                        {user?.role === 'admin' && user.id !== member.id && (
                                            <IconHint label="Delete staff member">
                                                <Button size="icon" variant="danger" onClick={() => setDeleteTarget({ id: member.id, name: member.name })}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </IconHint>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {visibleStaff.length === 0 && (
                    <div className="card" style={{ padding: 24, gridColumn: '1 / -1', textAlign: 'center' }}>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No team members yet. Click <strong>Add team member</strong> to invite your first one.</p>
                    </div>
                )}
            </div>

            {/* Add / Edit dialog */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent style={{ maxWidth: 560, padding: 36 }}>
                    {/* Hero with live avatar preview */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8 }}>
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 18,
                                background: 'var(--gradient-brand)',
                                color: '#fffaf4',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 20,
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                boxShadow: 'var(--shadow-brand)',
                                flexShrink: 0,
                            }}
                        >
                            {(formData.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <DialogTitle asChild>
                                <h2
                                    style={{
                                        fontFamily: 'var(--font-display), serif',
                                        fontSize: 26,
                                        fontWeight: 700,
                                        letterSpacing: '-0.03em',
                                        lineHeight: 1.1,
                                        color: 'var(--text-primary)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {modalMode === 'add'
                                        ? (formData.name ? `Welcome, ${formData.name.split(' ')[0]}` : 'Add a teammate')
                                        : 'Edit details'}
                                </h2>
                            </DialogTitle>
                            <DialogDescription style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                {modalMode === 'add'
                                    ? 'Create an account so they can join the floor.'
                                    : 'Update name, role, or phone. Username cannot be changed.'}
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 8 }}>
                        {/* ─── Section: Who they are ───────────────────── */}
                        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <SectionLabel>Who they are</SectionLabel>

                            <FormField label="Full name" htmlFor="staff-name">
                                <Input
                                    id="staff-name"
                                    required
                                    value={formData.name}
                                    onChange={e => {
                                        const name = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            name,
                                            username: modalMode === 'add' && (!prev.username || prev.username === suggestUsername(prev.name))
                                                ? suggestUsername(name)
                                                : prev.username,
                                        }));
                                    }}
                                    placeholder="e.g. Aminata Sesay"
                                />
                            </FormField>

                            <FormField label="Phone (optional)" htmlFor="staff-phone">
                                <Input
                                    id="staff-phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+232 78 123 4567"
                                />
                            </FormField>
                        </section>

                        {/* ─── Section: How they log in ───────────────── */}
                        <section
                            style={{
                                borderTop: '1px solid var(--border)',
                                paddingTop: 28,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 20,
                            }}
                        >
                            <SectionLabel>How they log in</SectionLabel>

                            <FormField
                                label="Username"
                                htmlFor="staff-username"
                                description={modalMode === 'add' ? 'Letters, numbers, and dots only. They’ll use this to log in.' : undefined}
                            >
                                <Input
                                    id="staff-username"
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="aminata.sesay"
                                    disabled={modalMode === 'edit'}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                />
                            </FormField>

                            {modalMode === 'add' && (
                                <FormField
                                    label="Their first password"
                                    htmlFor="staff-password"
                                    description="At least 8 characters. They'll be asked to change it the first time they log in."
                                >
                                    <Input
                                        id="staff-password"
                                        required
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Pick something memorable"
                                        minLength={8}
                                    />
                                </FormField>
                            )}

                            <FormField label="Role" htmlFor="staff-role">
                                <Select
                                    value={formData.role}
                                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                                >
                                    <SelectTrigger id="staff-role">
                                        <SelectValue placeholder="Pick a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {editableRoleOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <RolePermissionsPreview role={formData.role} />
                        </section>

                        <DialogFooter style={{ paddingTop: 12, gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: '12px 18px',
                                }}
                            >
                                Cancel
                            </button>
                            <Button type="submit" variant="primary">
                                {modalMode === 'add' ? 'Create account' : 'Save changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete staff member</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter style={{ paddingTop: 8 }}>
                        <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</Button>
                        <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting…' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset password dialog */}
            <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset password</DialogTitle>
                        <DialogDescription>
                            Set a temporary password for <strong>{resetTarget?.name}</strong>. They’ll be required to change it the next time they sign in.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                        <FormField label="Temporary password" htmlFor="reset-pw">
                            <Input
                                id="reset-pw"
                                required
                                type="password"
                                value={resetPassword}
                                onChange={e => setResetPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                minLength={8}
                            />
                        </FormField>
                        <FormField label="Confirm password" htmlFor="reset-pw-confirm">
                            <Input
                                id="reset-pw-confirm"
                                required
                                type="password"
                                value={resetConfirmPassword}
                                onChange={e => setResetConfirmPassword(e.target.value)}
                                placeholder="Repeat the temporary password"
                                minLength={8}
                            />
                        </FormField>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
                            <Button type="submit" variant="primary">Reset password</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                color: 'var(--text-accent)',
            }}
        >
            {children}
        </div>
    );
}

function RolePermissionsPreview({ role }: { role: string }) {
    const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.waiter;
    const copy = getRoleCopy(role);
    return (
        <div
            style={{
                padding: 14,
                borderRadius: 14,
                background: copy.bg,
                border: `1px solid ${copy.color}22`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: copy.color, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    {copy.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {copy.hint}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {perms.can.map((p) => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span> {p}
                    </div>
                ))}
                {perms.cant.map((p) => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
                        <span style={{ color: '#f97316', fontWeight: 700 }}>✗</span> {p}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SummaryStat({ icon, label, value, sub, accent }: {
    icon: React.ReactNode; label: string; value: string; sub: string; accent: string;
}) {
    return (
        <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>{label}</span>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: `${accent}1a`, border: `1px solid ${accent}44`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
            </div>
            <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 6 }}>
                {value}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub}</div>
        </div>
    );
}
