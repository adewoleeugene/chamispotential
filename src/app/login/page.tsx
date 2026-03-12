'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const result = await login(email, password);
        if (result.success) {
            router.push(result.user.role === 'kitchen' ? '/kitchen' : '/dashboard');
        } else {
            setError(result.error || 'Login failed');
            setLoading(false);
        }
    };

    const demoLogin = (role: string) => {
        const demos: Record<string, { email: string; password: string }> = {
            admin: { email: 'admin@rms.com', password: 'admin123' },
            manager: { email: 'manager@rms.com', password: 'manager123' },
            kitchen: { email: 'kitchen@rms.com', password: 'kitchen123' },
            cashier: { email: 'cashier@rms.com', password: 'cashier123' },
            waiter: { email: 'waiter@rms.com', password: 'waiter123' },
        };
        const d = demos[role];
        if (d) { setEmail(d.email); setPassword(d.password); }
    };

    return (
        <div className="login-page">
            {/* Background orbs */}
            <div className="login-bg-orb" style={{ width: 600, height: 600, background: '#f97316', top: -200, right: -200 }} />
            <div className="login-bg-orb" style={{ width: 400, height: 400, background: '#3b82f6', bottom: -150, left: -150 }} />

            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-icon">🍽️</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                        Welcome Back
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                        Sign in to your RMS dashboard
                    </p>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="Enter your email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', marginTop: 8 }}>
                        {loading ? <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : 'Sign In'}
                    </button>
                </form>

                <div className="divider" />

                <div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Demo Accounts
                    </p>
                    <div className="grid-2" style={{ gap: 8 }}>
                        {['admin', 'manager', 'waiter', 'kitchen', 'cashier'].map(role => (
                            <button
                                key={role}
                                onClick={() => demoLogin(role)}
                                className="btn btn-secondary btn-sm"
                                style={{ justifyContent: 'center' }}
                            >
                                {role === 'admin' ? '👑' : role === 'manager' ? '📊' : role === 'kitchen' ? '👨‍🍳' : role === 'waiter' ? '🏃' : '💳'} {role.charAt(0).toUpperCase() + role.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
