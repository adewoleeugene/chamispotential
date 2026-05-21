'use client';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, user, loading: authLoading } = useAuth();
    const { settings } = useSettings();
    const router = useRouter();

    const brandName = settings.restaurantName?.trim() || 'Flavor OS';
    const brandInitials = brandName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'FO';

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

    return (
        <div className="relative min-h-screen flex items-center justify-center p-8 overflow-hidden bg-[var(--bg-primary)]">
            {/* Background orbs — match original 620px / 460px */}
            <div
                aria-hidden
                className="absolute pointer-events-none rounded-full opacity-[0.24]"
                style={{
                    width: 620,
                    height: 620,
                    top: -220,
                    right: -180,
                    background: 'rgba(214, 139, 72, 0.5)',
                    filter: 'blur(90px)',
                }}
            />
            <div
                aria-hidden
                className="absolute pointer-events-none rounded-full opacity-[0.24]"
                style={{
                    width: 460,
                    height: 460,
                    bottom: -160,
                    left: -140,
                    background: 'rgba(85, 132, 173, 0.34)',
                    filter: 'blur(90px)',
                }}
            />

            <div
                className="relative z-10 grid gap-6 w-full"
                style={{
                    maxWidth: 1180,
                    gridTemplateColumns: 'minmax(0, 1.18fr) minmax(360px, 440px)',
                }}
            >
                {/* Editorial story panel */}
                <section
                    className="hidden lg:flex flex-col items-center justify-center text-center"
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
                    <div className="flex flex-col items-center">
                        <h1
                            className="text-[var(--text-primary)]"
                            style={{
                                maxWidth: '14ch',
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 'clamp(3rem, 6vw, 5.6rem)',
                                fontWeight: 700,
                                lineHeight: 0.92,
                                letterSpacing: '-0.07em',
                                marginBottom: 20,
                                textAlign: 'center',
                            }}
                        >
                            Run the floor like a chef&apos;s table, not a spreadsheet.
                        </h1>
                        <p
                            className="text-[var(--text-secondary)]"
                            style={{ maxWidth: 520, fontSize: 16, lineHeight: 1.55, textAlign: 'center' }}
                        >
                            Tables, tickets, kitchen timing, staff handoff, and Monime checkout all stay in one elegant service rhythm.
                        </p>
                    </div>

                </section>

                {/* Form card */}
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
                            className="flex items-center justify-center overflow-hidden text-[#fff9f0]"
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 18,
                                background: 'var(--gradient-brand)',
                                border: '1px solid rgba(255, 248, 238, 0.12)',
                                boxShadow: 'var(--shadow-brand)',
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 18,
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                marginBottom: 24,
                            }}
                        >
                            {settings.logoDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={settings.logoDataUrl} alt={brandName} className="h-full w-full object-cover" />
                            ) : brandInitials}
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
                            Welcome back to service
                        </h2>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: 14, lineHeight: 1.55 }}>
                            Sign in to continue operating the dining room in real time.
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
                            <strong
                                className="text-[var(--danger)] uppercase"
                                style={{ fontSize: 12, letterSpacing: '0.16em' }}
                            >
                                Access issue
                            </strong>
                            <span className="text-[var(--text-secondary)]" style={{ fontSize: 14 }}>
                                {error}
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
                        <FormField label="Username" htmlFor="login-username">
                            <Input
                                id="login-username"
                                type="text"
                                autoComplete="username"
                                placeholder="Enter your username"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </FormField>

                        <FormField label="Password" htmlFor="login-password">
                            <Input
                                id="login-password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </FormField>

                        <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
                            {loading ? (
                                <>
                                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    Signing in
                                </>
                            ) : (
                                <>
                                    Enter dashboard
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
