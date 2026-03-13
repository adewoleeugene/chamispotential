'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';

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
            <div className="fullscreen-shell">
                <div className="fullscreen-panel">
                    <span className="fullscreen-kicker">Preparing secure access</span>
                    <div className="loading-spinner" />
                    <p className="fullscreen-copy">Checking your account status.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-bg-orb login-bg-orb-one" />
            <div className="login-bg-orb login-bg-orb-two" />

            <div className="login-shell" style={{ gridTemplateColumns: 'minmax(0, 0.95fr) minmax(360px, 0.8fr)' }}>
                <section className="login-story">
                    <div className="login-story-badge">Security checkpoint</div>
                    <h1 className="login-story-title">Set a new password before you return to the floor.</h1>
                    <p className="login-story-copy">
                        Your account has a temporary password. Update it now so only you can access live orders, tables, and service operations.
                    </p>

                    <div className="login-metric-grid">
                        <article className="login-metric-card">
                            <span className="login-metric-value">8+</span>
                            <span className="login-metric-label">character minimum</span>
                        </article>
                        <article className="login-metric-card">
                            <span className="login-metric-value">1</span>
                            <span className="login-metric-label">required reset flow</span>
                        </article>
                        <article className="login-metric-card">
                            <span className="login-metric-value">0</span>
                            <span className="login-metric-label">shared passwords after this step</span>
                        </article>
                    </div>
                </section>

                <section className="login-card">
                    <div className="login-logo">
                        <div className="login-logo-icon"><KeyRound size={18} /></div>
                        <p className="login-panel-kicker">Required password change</p>
                        <h2 className="login-heading">Protect your station</h2>
                        <p className="login-caption">Use your current temporary password once, then choose a new one for future sign-ins.</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger login-alert">
                            <strong className="login-alert-title">Password update failed</strong>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="alert alert-success login-alert">
                            <strong className="login-alert-title">Password updated</strong>
                            <span>{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Current Password</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Enter temporary password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Choose a new password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary w-full login-submit" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <span className="loading-spinner loading-spinner-sm" />
                                    Updating password
                                </>
                            ) : (
                                <>
                                    Save and continue
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
