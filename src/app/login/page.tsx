'use client';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';

const demoRoles = [
    { key: 'admin', label: 'Admin', hint: 'Full control' },
    { key: 'manager', label: 'Manager', hint: 'Shift oversight' },
    { key: 'waiter', label: 'Waiter', hint: 'Table service' },
    { key: 'kitchen', label: 'Kitchen', hint: 'Ticket flow' },
] as const;

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (authLoading || !user) return;
        router.replace(user.mustChangePassword ? '/change-password' : getDefaultRouteForRole(user.role));
    }, [authLoading, router, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const result = await login(email, password);
        if (result.success) {
            router.push(result.user.mustChangePassword ? '/change-password' : getDefaultRouteForRole(result.user.role));
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
            waiter: { email: 'waiter@rms.com', password: 'waiter123' },
        };
        const d = demos[role];
        if (d) { setEmail(d.email); setPassword(d.password); }
    };

    return (
        <div className="login-page">
            <div className="login-bg-orb login-bg-orb-one" />
            <div className="login-bg-orb login-bg-orb-two" />

            <div className="login-shell">
                <section className="login-story">
                    <div className="login-story-badge">RMS / Front Of House Edition</div>
                    <h1 className="login-story-title">Run the floor like a chef&apos;s table, not a spreadsheet.</h1>
                    <p className="login-story-copy">
                        Tables, tickets, kitchen timing, staff handoff, and Monime checkout all stay in one elegant service rhythm.
                    </p>

                    <div className="login-metric-grid">
                        <article className="login-metric-card">
                            <span className="login-metric-value">42</span>
                            <span className="login-metric-label">covers tonight</span>
                        </article>
                        <article className="login-metric-card">
                            <span className="login-metric-value">8m</span>
                            <span className="login-metric-label">average fire time</span>
                        </article>
                        <article className="login-metric-card">
                            <span className="login-metric-value">99.2%</span>
                            <span className="login-metric-label">service uptime</span>
                        </article>
                    </div>

                    <div className="login-role-strip">
                        {demoRoles.map((role) => (
                            <div key={role.key} className="login-role-pill">
                                <span>{role.label}</span>
                                <small>{role.hint}</small>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="login-card">
                    <div className="login-logo">
                        <div className="login-logo-icon">FO</div>
                        <p className="login-panel-kicker">Secure access</p>
                        <h2 className="login-heading">Welcome back to service</h2>
                        <p className="login-caption">Sign in to continue operating the dining room in real time.</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger login-alert">
                            <strong className="login-alert-title">Access issue</strong>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-email">Email Address</label>
                            <input
                                id="login-email"
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
                            <label className="form-label" htmlFor="login-password">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                className="form-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary w-full login-submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="loading-spinner loading-spinner-sm" />
                                    Signing in
                                </>
                            ) : (
                                <>
                                    Enter dashboard
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="divider" />

                    <div className="login-demo">
                        <p className="login-demo-label">Quick demo access</p>
                        <div className="login-demo-grid">
                            {demoRoles.map((role) => (
                                <button
                                    key={role.key}
                                    type="button"
                                    onClick={() => demoLogin(role.key)}
                                    className="login-demo-button"
                                >
                                    <span className="login-demo-role">{role.label}</span>
                                    <span className="login-demo-hint">{role.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
