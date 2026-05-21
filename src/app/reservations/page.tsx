'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, CheckCircle, XCircle, Users, CalendarClock, Clock3, Undo2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { IconHint } from '@/components/ui/tooltip';

type Reservation = {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    partySize: number;
    date: string;
    duration?: number;
    status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no-show';
    notes?: string | null;
    tableId?: string | null;
};

const STATUS_COPY: Record<string, { label: string; color: string }> = {
    pending:   { label: 'Pending',   color: '#f59e0b' },
    confirmed: { label: 'Confirmed', color: '#22c55e' },
    seated:    { label: 'Seated',    color: '#38bdf8' },
    completed: { label: 'Completed', color: '#94a3b8' },
    cancelled: { label: 'Cancelled', color: '#ef4444' },
    'no-show': { label: 'No-show',   color: '#ef4444' },
};

const isToday = (d: Date) => {
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const isThisWeek = (d: Date) => {
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= -1 && diff <= 7;
};

export default function ReservationsPage() {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | Reservation['status']>('all');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [form, setForm] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        partySize: '2',
        date: '',
        time: '',
        duration: '90',
        notes: '',
        status: 'confirmed' as Reservation['status'],
    });
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const fetchReservations = () => {
        fetch('/api/reservations')
            .then(res => res.json())
            .then(data => { setReservations(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => { setReservations([]); setLoading(false); });
    };

    useEffect(() => { fetchReservations(); }, []);

    const updateStatus = async (id: string, status: Reservation['status']) => {
        const res = await fetch(`/api/reservations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            toast('success', `Marked ${STATUS_COPY[status]?.label.toLowerCase() || status}`);
            fetchReservations();
        } else {
            toast('error', 'Failed to update reservation');
        }
    };

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.date || !form.time) {
            toast('error', 'Pick a date and time');
            return;
        }
        const partySize = Number(form.partySize);
        const duration = Number(form.duration);
        if (!Number.isFinite(partySize) || partySize < 1) {
            toast('error', 'Party size must be at least 1');
            return;
        }
        setSaving(true);
        try {
            const isoDate = new Date(`${form.date}T${form.time}`).toISOString();
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: form.customerName.trim(),
                    customerPhone: form.customerPhone.trim(),
                    customerEmail: form.customerEmail.trim() || null,
                    partySize,
                    date: isoDate,
                    duration: Number.isFinite(duration) ? duration : 90,
                    notes: form.notes.trim() || null,
                    status: form.status,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to add reservation');
            }
            toast('success', 'Reservation added');
            setIsAddOpen(false);
            setForm({
                customerName: '', customerPhone: '', customerEmail: '',
                partySize: '2', date: '', time: '', duration: '90', notes: '',
                status: 'confirmed',
            });
            fetchReservations();
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to add reservation');
        } finally {
            setSaving(false);
        }
    };

    // Manager summary
    const todayCount = reservations.filter(r => isToday(new Date(r.date)) && r.status !== 'cancelled').length;
    const pendingCount = reservations.filter(r => r.status === 'pending').length;
    const thisWeekCount = reservations.filter(r => isThisWeek(new Date(r.date)) && r.status !== 'cancelled').length;
    const totalCovers = reservations
        .filter(r => isToday(new Date(r.date)) && r.status !== 'cancelled')
        .reduce((sum, r) => sum + (r.partySize || 0), 0);

    const filtered = reservations.filter(r => statusFilter === 'all' || r.status === statusFilter);

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            {/* Header */}
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 8 }}>
                        Bookings
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display), serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4 }}>
                        Who&apos;s coming in?
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640 }}>
                        Today&apos;s bookings, pending confirmations, and the week ahead.
                    </p>
                </div>
                <Button variant="primary" onClick={() => setIsAddOpen(true)}>
                    <Plus size={16} /> New reservation
                </Button>
            </div>

            {/* Summary stats */}
            <div className="grid-3 gap-4 mb-6">
                <SummaryCard
                    icon={<CalendarClock size={18} />}
                    label="Today"
                    value={String(todayCount)}
                    sub={todayCount > 0 ? `${totalCovers} guest${totalCovers === 1 ? '' : 's'} expected` : 'No bookings for today'}
                    accent="#f59e0b"
                />
                <SummaryCard
                    icon={<Clock3 size={18} />}
                    label="Need confirmation"
                    value={String(pendingCount)}
                    sub={pendingCount > 0 ? 'Confirm or cancel to clear the list' : 'All bookings confirmed'}
                    accent={pendingCount > 0 ? '#f97316' : '#22c55e'}
                />
                <SummaryCard
                    icon={<Users size={18} />}
                    label="This week"
                    value={String(thisWeekCount)}
                    sub="Confirmed bookings in the next 7 days"
                    accent="#38bdf8"
                />
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {(['all', 'pending', 'confirmed', 'seated', 'completed', 'cancelled'] as const).map((status) => {
                    const active = statusFilter === status;
                    const count = status === 'all' ? reservations.length : reservations.filter(r => r.status === status).length;
                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 999,
                                background: active ? 'rgba(180,104,51,0.16)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${active ? 'rgba(180,104,51,0.4)' : 'var(--border)'}`,
                                color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            {status === 'all' ? 'All' : STATUS_COPY[status]?.label || status}
                            <span style={{ fontSize: 11, opacity: 0.7 }}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Reservation rows */}
            <div style={{ borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
                            {statusFilter === 'all' ? 'No reservations yet' : `No ${statusFilter} reservations`}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Tap &quot;New reservation&quot; to add one.
                        </div>
                    </div>
                ) : (
                    filtered.map((r, index, arr) => {
                        const d = new Date(r.date);
                        const day = d.toLocaleDateString(undefined, { day: '2-digit' });
                        const month = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const statusCopy = STATUS_COPY[r.status] || { label: r.status, color: '#94a3b8' };

                        return (
                            <div
                                key={r.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '64px 1fr auto',
                                    gap: 16,
                                    alignItems: 'center',
                                    padding: '18px 20px',
                                    borderBottom: index < arr.length - 1 ? '1px solid var(--border)' : 'none',
                                }}
                            >
                                {/* Date chip */}
                                <div style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 14,
                                    background: 'rgba(180,104,51,0.08)',
                                    border: '1px solid rgba(180,104,51,0.18)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 20, fontWeight: 700, color: 'var(--text-accent)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                                        {day}
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', marginTop: 3 }}>
                                        {month}
                                    </div>
                                </div>

                                {/* Details */}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {r.customerName}
                                        </span>
                                        <span style={{
                                            display: 'inline-block',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.14em',
                                            padding: '3px 10px',
                                            borderRadius: 999,
                                            background: `${statusCopy.color}22`,
                                            color: statusCopy.color,
                                            border: `1px solid ${statusCopy.color}44`,
                                        }}>
                                            {statusCopy.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        <strong style={{ color: 'var(--text-secondary)' }}>{time}</strong>
                                        {' · '}
                                        <strong style={{ color: 'var(--text-secondary)' }}>{r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}</strong>
                                        {' · '}
                                        {r.customerPhone || 'No phone'}
                                        {r.notes ? <> · {r.notes}</> : null}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {r.status === 'pending' && (
                                        <IconHint label="Confirm booking">
                                            <Button size="icon" variant="success" onClick={() => updateStatus(r.id, 'confirmed')}>
                                                <CheckCircle size={14} />
                                            </Button>
                                        </IconHint>
                                    )}
                                    {(r.status === 'confirmed' || r.status === 'pending') && (
                                        <IconHint label="Mark seated">
                                            <Button size="icon" variant="secondary" onClick={() => updateStatus(r.id, 'seated')}>
                                                <Users size={14} />
                                            </Button>
                                        </IconHint>
                                    )}
                                    {r.status === 'seated' && (
                                        <>
                                            <IconHint label="Undo — back to confirmed">
                                                <Button size="icon" variant="secondary" onClick={() => updateStatus(r.id, 'confirmed')}>
                                                    <Undo2 size={14} />
                                                </Button>
                                            </IconHint>
                                            <IconHint label="Mark completed">
                                                <Button size="icon" variant="success" onClick={() => updateStatus(r.id, 'completed')}>
                                                    <CheckCircle size={14} />
                                                </Button>
                                            </IconHint>
                                        </>
                                    )}
                                    {r.status === 'completed' && (
                                        <IconHint label="Undo — back to seated">
                                            <Button size="icon" variant="secondary" onClick={() => updateStatus(r.id, 'seated')}>
                                                <Undo2 size={14} />
                                            </Button>
                                        </IconHint>
                                    )}
                                    {r.status === 'cancelled' && (
                                        <IconHint label="Undo — restore booking">
                                            <Button size="icon" variant="success" onClick={() => updateStatus(r.id, 'confirmed')}>
                                                <Undo2 size={14} />
                                            </Button>
                                        </IconHint>
                                    )}
                                    {!['cancelled', 'completed'].includes(r.status) && (
                                        <IconHint label="Cancel">
                                            <Button size="icon" variant="danger" onClick={() => updateStatus(r.id, 'cancelled')}>
                                                <XCircle size={14} />
                                            </Button>
                                        </IconHint>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* New reservation dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent style={{ maxWidth: 580, padding: 36 }}>
                    {/* Hero with calendar chip */}
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
                                boxShadow: 'var(--shadow-brand)',
                                flexShrink: 0,
                            }}
                        >
                            <CalendarClock size={24} />
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
                                    {form.customerName.trim()
                                        ? `Booking for ${form.customerName.trim().split(' ')[0]}`
                                        : 'New reservation'}
                                </h2>
                            </DialogTitle>
                            <DialogDescription style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Add a booking to the calendar. You can confirm, seat, or cancel it later.
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={submitForm} style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 8 }}>
                        {/* ── Section: About the guest ───────────────────── */}
                        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)' }}>
                                About the guest
                            </div>

                            <FormField label="Customer name" htmlFor="r-name">
                                <Input id="r-name" required value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="e.g. Mariama Conteh" />
                            </FormField>

                            <div className="grid-2 gap-4">
                                <FormField label="Phone" htmlFor="r-phone">
                                    <Input id="r-phone" required type="tel" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="+232 78 123 4567" />
                                </FormField>
                                <FormField label="Email (optional)" htmlFor="r-email">
                                    <Input id="r-email" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} placeholder="mariama@example.com" />
                                </FormField>
                            </div>
                        </section>

                        {/* ── Section: When and how many ─────────────────── */}
                        <section
                            style={{
                                borderTop: '1px solid var(--border)',
                                paddingTop: 28,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 20,
                            }}
                        >
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)' }}>
                                When and how many
                            </div>

                            <div className="grid-3 gap-4">
                                <FormField label="Date" htmlFor="r-date">
                                    <Input id="r-date" required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                                </FormField>
                                <FormField label="Time" htmlFor="r-time">
                                    <Input id="r-time" required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                                </FormField>
                                <FormField label="Guests" htmlFor="r-size">
                                    <Input id="r-size" required type="number" min="1" value={form.partySize} onChange={e => setForm({ ...form, partySize: e.target.value })} />
                                </FormField>
                            </div>

                            <div className="grid-2 gap-4">
                                <FormField label="Length (minutes)" htmlFor="r-duration" description="Default is 90 minutes — about a full dinner.">
                                    <Input id="r-duration" type="number" min="30" step="15" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
                                </FormField>
                                <FormField label="Status" htmlFor="r-status" description={form.status === 'pending' ? 'Holds the slot but needs your confirmation.' : 'Locked in — they’re coming.'}>
                                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Reservation['status'] })}>
                                        <SelectTrigger id="r-status"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="confirmed">Confirmed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormField>
                            </div>

                            <FormField label="Notes (optional)" htmlFor="r-notes" description="Birthday, allergies, window seat — anything the team should know.">
                                <textarea
                                    id="r-notes"
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    rows={3}
                                    placeholder="e.g. Birthday celebration, no nuts, prefer corner booth"
                                    style={{
                                        width: '100%',
                                        borderRadius: 16,
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-primary)',
                                        padding: '14px 24px',
                                        fontSize: 14,
                                        lineHeight: 1.5,
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </FormField>
                        </section>

                        <DialogFooter style={{ paddingTop: 12, gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setIsAddOpen(false)}
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
                            <Button type="submit" variant="primary" disabled={saving}>
                                {saving ? 'Saving…' : 'Add reservation'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function SummaryCard({ icon, label, value, sub, accent }: {
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
