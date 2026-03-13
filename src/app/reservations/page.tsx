'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export default function ReservationsPage() {
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const toast = useToast();

    const fetchReservations = () => {
        fetch('/api/reservations')
            .then(res => res.json())
            .then(data => { setReservations(data); setLoading(false); });
    };

    useEffect(() => { fetchReservations(); }, []);

    const updateStatus = async (id: string, status: string) => {
        const res = await fetch(`/api/reservations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            toast('success', `Reservation marked as ${status}`);
            fetchReservations();
        } else {
            toast('error', 'Failed to update reservation');
        }
    };

    const filtered = reservations.filter(r => statusFilter === 'all' || r.status === statusFilter);

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div className="category-tabs" style={{ marginBottom: 0 }}>
                    <button className={`category-tab ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                    <button className={`category-tab ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Pending</button>
                    <button className={`category-tab ${statusFilter === 'confirmed' ? 'active' : ''}`} onClick={() => setStatusFilter('confirmed')}>Confirmed</button>
                    <button className={`category-tab ${statusFilter === 'cancelled' ? 'active' : ''}`} onClick={() => setStatusFilter('cancelled')}>Cancelled</button>
                </div>
                <button className="btn btn-primary"><Plus size={16} /> New Reservation</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Customer</th>
                            <th>Contact</th>
                            <th>Size</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(res => (
                            <tr key={res.id}>
                                <td>
                                    <div className="font-bold">{new Date(res.date).toLocaleDateString()}</div>
                                    <div className="text-muted text-sm">{new Date(res.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="font-bold">{res.customerName}</td>
                                <td className="text-sm">
                                    {res.customerPhone}<br />
                                    <span className="text-muted">{res.customerEmail}</span>
                                </td>
                                <td className="font-bold">{res.partySize} pax</td>
                                <td><span className={`badge ${res.status}`}>{res.status}</span></td>
                                <td>
                                    <div className="flex gap-2">
                                        {res.status === 'pending' && (
                                            <button className="btn btn-icon btn-success" title="Confirm" onClick={() => updateStatus(res.id, 'confirmed')}><CheckCircle size={14} /></button>
                                        )}
                                        {res.status !== 'cancelled' && (
                                            <button className="btn btn-icon btn-danger" title="Cancel" onClick={() => updateStatus(res.id, 'cancelled')}><XCircle size={14} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="empty-state">No reservations found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    );
}
