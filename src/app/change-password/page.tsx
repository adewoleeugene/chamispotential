'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';

export default function ChangePasswordPage() {
    const router = useRouter();
    const { user, loading, refresh } = useAuth();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        if (!user.mustChangePassword) {
            router.replace(getDefaultRouteForRole(user.role));
        }
    }, [loading, router, user]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('New password and confirmation do not match');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to update password');
                return;
            }
            setSuccess('Password updated successfully. Routing you back into service.');
            await refresh();
            router.replace(getDefaultRouteForRole(user?.role));
        } catch {
            setError('Failed to update password');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
                <div
                    className="flex flex-col items-center gap-3"
                    style={{
                        padding: 42,
                        borderRadius: 30,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(10, 13, 18, 0.9)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    <span
                        className="text-[var(--text-accent)] uppercase font-bold"
                        style={{ fontSize: 10, letterSpacing: '0.2em' }}
                    >
                        Preparing secure access
                    </span>
                    <span className="h-8 w-8 rounded-full border-2 border-[var(--border-strong)] border-t-[var(--brand-400)] animate-spin" />
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>
                        Checking your account status.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center p-8 overflow-hidden bg-[var(--bg-primary)]">
            <div
                aria-hidden
                className="absolute pointer-events-none rounded-full opacity-[0.24]"
                style={{
                    width: 620, height: 620, top: -220, right: -180,
                    background: 'rgba(214, 139, 72, 0.5)', filter: 'blur(90px)',
                }}
            />
            <div
                aria-hidden
                className="absolute pointer-events-none rounded-full opacity-[0.24]"
                style={{
                    width: 460, height: 460, bottom: -160, left: -140,
                    background: 'rgba(85, 132, 173, 0.34)', filter: 'blur(90px)',
                }}
            />

            <div
                className="relative z-10 grid gap-6 w-full"
                style={{
                    maxWidth: 1180,
                    gridTemplateColumns: 'minmax(0, 0.95fr) minmax(360px, 0.8fr)',
                }}
            >
                <section
                    className="hidden lg:flex flex-col justify-between"
                    style={{
                        padding: 42,
                        minHeight: 640,
                        borderRadius: 30,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: 'var(--shadow-lg)',
                        backdropFilter: 'blur(18px)',
                        background:
                            'radial-gradient(circle at top right, rgba(240, 191, 131, 0.2), transparent 32%), linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)), rgba(10, 13, 18, 0.8)',
                    }}
                >
                    <div>
                        <span
                            className="inline-flex items-center self-start mb-7 rounded-full text-[var(--text-accent)] uppercase font-bold"
                            style={{
                                padding: '8px 14px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                fontSize: 11,
                                letterSpacing: '0.16em',
                            }}
                        >
                            Security checkpoint
                        </span>
                        <h1
                            className="text-[var(--text-primary)]"
                            style={{
                                maxWidth: '13ch',
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 'clamp(3rem, 6vw, 5.6rem)',
                                fontWeight: 700,
                                lineHeight: 0.92,
                                letterSpacing: '-0.07em',
                                marginBottom: 20,
                            }}
                        >
                            Set a new password before you return to the floor.
                        </h1>
                        <p
                            className="text-[var(--text-secondary)]"
                            style={{ maxWidth: 520, fontSize: 16, lineHeight: 1.55 }}
                        >
                            Your account has a temporary password. Update it now so only you can access live orders, tables, and service operations.
                        </p>
                    </div>

                </section>

                <section
                    className="w-full relative z-10"
                    style={{
                        padding: '48px 44px',
                        minHeight: 640,
                        borderRadius: 30,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: 'var(--shadow-lg)',
                        backdropFilter: 'blur(18px)',
                        background:
                            'linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)), rgba(10, 13, 18, 0.9)',
                    }}
                >
                    <div style={{ marginBottom: 40 }}>
                        <div
                            className="flex items-center justify-center text-[#fff9f0]"
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 18,
                                background: 'var(--gradient-brand)',
                                border: '1px solid rgba(255, 248, 238, 0.12)',
                                boxShadow: 'var(--shadow-brand)',
                                marginBottom: 24,
                            }}
                        >
                            <KeyRound size={18} />
                        </div>
                        <h2
                            className="text-[var(--text-primary)]"
                            style={{
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 40,
                                fontWeight: 700,
                                lineHeight: 0.98,
                                letterSpacing: '-0.06em',
                                marginBottom: 14,
                            }}
                        >
                            Protect your station
                        </h2>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: 14, lineHeight: 1.55 }}>
                            Use your current temporary password once, then choose a new one for future sign-ins.
                        </p>
                    </div>

                    {error && (
                        <div
                            className="mb-5 flex flex-col gap-1"
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(240,107,100,0.3)',
                                background: 'rgba(240,107,100,0.08)',
                            }}
                        >
                            <strong className="text-[var(--danger)] uppercase" style={{ fontSize: 12, letterSpacing: '0.16em' }}>
                                Password update failed
                            </strong>
                            <span className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div
                            className="mb-5 flex flex-col gap-1"
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(83,211,167,0.3)',
                                background: 'rgba(83,211,167,0.08)',
                            }}
                        >
                            <strong className="text-[var(--success)] uppercase" style={{ fontSize: 12, letterSpacing: '0.16em' }}>
                                Password updated
                            </strong>
                            <span className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
                        <FormField label="Current password" htmlFor="cp-current">
                            <Input
                                id="cp-current"
                                type="password"
                                placeholder="Enter temporary password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                required
                                autoFocus
                            />
                        </FormField>

                        <FormField label="New password" htmlFor="cp-new" description="At least 8 characters.">
                            <Input
                                id="cp-new"
                                type="password"
                                placeholder="Choose a new password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </FormField>

                        <FormField label="Confirm new password" htmlFor="cp-confirm">
                            <Input
                                id="cp-confirm"
                                type="password"
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </FormField>

                        <Button type="submit" size="lg" disabled={submitting} className="w-full mt-2">
                            {submitting ? (
                                <>
                                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    Updating password
                                </>
                            ) : (
                                <>
                                    Save and continue
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </Button>
                    </form>
                </section>
            </div>
        </div>
    );
}
