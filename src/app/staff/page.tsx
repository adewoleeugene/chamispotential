'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Lock, Unlock, Phone, X, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

export default function StaffPage() {
    const { user } = useAuth();
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'waiter' });

    const fetchStaff = () => {
        fetch('/api/staff')
            .then(r => r.json())
            .then(d => { setStaff(Array.isArray(d) ? d.filter((member: any) => member.role !== 'cashier') : []); setLoading(false); })
            .catch(() => { setStaff([]); setLoading(false); });
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const toggleActive = async (id: string, isActive: boolean) => {
        if (user?.role !== 'admin' && user?.role !== 'manager') {
            return toast('error', 'Unauthorized');
        }
        const res = await fetch(`/api/staff/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive })
        });
        if (res.ok) {
            toast('success', `User account ${isActive ? 'activated' : 'deactivated'}`);
            setStaff(prev => prev.map(s => s.id === id ? { ...s, isActive } : s));
        } else {
            toast('error', 'Failed to update user status');
        }
    };

    const openAddModal = () => {
        setModalMode('add');
        setFormData({ name: '', email: '', phone: '', password: '', role: 'waiter' });
        setIsModalOpen(true);
    };

    const openEditModal = (s: any) => {
        setModalMode('edit');
        setEditingUserId(s.id);
        setFormData({ name: s.name, email: s.email, phone: s.phone || '', password: '', role: s.role });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (modalMode === 'add') {
            const res = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                toast('success', 'Staff member added successfully');
                setIsModalOpen(false);
                fetchStaff();
            } else {
                const err = await res.json();
                toast('error', err.error || 'Failed to add staff member');
            }
        } else {
            const res = await fetch(`/api/staff/${editingUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.name, role: formData.role, phone: formData.phone })
            });
            if (res.ok) {
                toast('success', 'Staff details updated');
                setIsModalOpen(false);
                fetchStaff();
            } else {
                toast('error', 'Failed to update details');
            }
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
            case 'manager': return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' };
            case 'kitchen': return { bg: 'rgba(249,115,22,0.1)', color: 'var(--brand-400)' };
            default: return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' };
        }
    };

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>Team Directory</h2>
                    <p className="text-muted text-sm mt-1">Manage staff roles and access control</p>
                </div>
                {user?.role === 'admin' && (
                    <button className="btn btn-primary" onClick={openAddModal}><Plus size={16} /> Add Member</button>
                )}
            </div>

            <div className="grid-3 gap-4">
                {staff.map(member => {
                    const roleCols = getRoleBadgeColor(member.role);
                    return (
                        <div key={member.id} className="card" style={{ padding: 20 }}>
                            <div className="flex items-center gap-3 mb-4 border-b border-[var(--border)] pb-4">
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, border: '1px solid var(--border)' }}>
                                    {member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold flex items-center justify-between">
                                        {member.name}
                                        {!member.isActive && <span className="badge cancelled text-sm" style={{ padding: '2px 6px', fontSize: 9 }}>Inactive</span>}
                                    </div>
                                    <div className="text-muted text-sm mb-1">{member.email}</div>
                                    <span className="badge" style={{ background: roleCols.bg, color: roleCols.color }}>
                                        {member.role}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-sm font-medium flex items-center gap-1.5 text-muted">
                                    <Phone size={14} /> {member.phone || 'No phone listed'}
                                </div>
                                <div className="flex gap-2">
                                    {(user?.role === 'admin' || user?.role === 'manager') && (
                                        <>
                                            <button className="btn btn-icon btn-secondary" title="Edit details" onClick={() => openEditModal(member)}><Edit2 size={14} /></button>
                                            <button
                                                className={`btn btn-icon ${member.isActive ? 'btn-danger' : 'btn-success'}`}
                                                title={member.isActive ? 'Disable App Access' : 'Enable App Access'}
                                                onClick={() => toggleActive(member.id, !member.isActive)}
                                            >
                                                {member.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
                        <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                        <h3 className="card-title mb-4">{modalMode === 'add' ? 'Add Staff Member' : 'Edit Staff Details'}</h3>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm text-muted mb-1">Full Name</label>
                                <input required type="text" className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1">Email</label>
                                <input required type="email" className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@flavoros.com" disabled={modalMode === 'edit'} style={{ opacity: modalMode === 'edit' ? 0.7 : 1 }} />
                            </div>

                            <div>
                                <label className="block text-sm text-muted mb-1">Phone Number</label>
                                <input type="tel" className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 234 567 8900" />
                            </div>

                            {modalMode === 'add' && (
                                <div>
                                    <label className="block text-sm text-muted mb-1">Password</label>
                                    <input required type="password" className="form-input" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Create a password" minLength={6} />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-muted mb-1">Role / Access Level</label>
                                <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    <option value="waiter">Waiter / Floor Staff</option>
                                    <option value="kitchen">Kitchen Staff</option>
                                    <option value="manager">Manager</option>
                                    {(user?.role === 'admin' || formData.role === 'admin') && <option value="admin">Administrator</option>}
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary mt-2 justify-center" style={{ padding: 12 }}>
                                {modalMode === 'add' ? 'Create Account' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
