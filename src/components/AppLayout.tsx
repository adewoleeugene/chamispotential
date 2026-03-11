'use client';
import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Bell, Check } from 'lucide-react';
import { useState } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [readyOrders, setReadyOrders] = useState<any[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);

    useEffect(() => {
        if (!loading && !user && pathname !== '/login' && pathname !== '/') {
            router.push('/login');
        }
    }, [user, loading, router, pathname]);

    useEffect(() => {
        if (!user) return;
        const fetchReady = () => {
            fetch('/api/orders?status=ready')
                .then(r => r.json())
                .then(d => { if (Array.isArray(d)) setReadyOrders(d); })
                .catch(() => { });
        };
        fetchReady();
        const interval = setInterval(fetchReady, 10000);
        return () => clearInterval(interval);
    }, [user]);

    const markAsServed = async (id: string) => {
        await fetch(`/api/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'served' })
        });
        setReadyOrders(prev => prev.filter(o => o.id !== id));
    };

    if (loading || !user) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    // Calculate generic page titles based on pathname if not provided
    const titleMap: Record<string, string> = {
        '/dashboard': 'Dashboard Overview',
        '/orders': 'Order Management',
        '/tables': 'Table Layout',
        '/menu': 'Menu Editor',
        '/reservations': 'Reservations',
        '/kitchen': 'Kitchen Display',
        '/inventory': 'Inventory',
        '/staff': 'Staff Management',
        '/reports': 'Reports',
        '/settings': 'System Settings'
    };

    const getTitle = () => {
        const mainPath = `/${pathname.split('/')[1]}`;
        return titleMap[mainPath] || 'Restaurant System';
    };

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <header className="header">
                    <div className="header-left">
                        <h1 className="page-title">{getTitle()}</h1>
                        <p className="page-subtitle">Real-time restaurant operations</p>
                    </div>
                    <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {user?.role !== 'kitchen' && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowNotifs(!showNotifs)}
                                    style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: 8, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}
                                >
                                    <Bell size={18} />
                                    {readyOrders.length > 0 && (
                                        <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 'bold', width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translate(25%, -25%)' }}>
                                            {readyOrders.length}
                                        </span>
                                    )}
                                </button>

                                {showNotifs && (
                                    <div style={{ position: 'absolute', top: 40, right: 0, width: 320, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000, overflow: 'hidden' }}>
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold', fontSize: 13, background: 'var(--surface-active)', color: 'var(--brand-300)' }}>
                                            Ready for Pickup
                                        </div>
                                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                            {readyOrders.length === 0 ? (
                                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No orders currently ready.</div>
                                            ) : readyOrders.map(order => (
                                                <div key={order.id} style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', fontSize: 13 }}>Order #{order.orderNumber}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {order.type === 'dine-in' ? `Table ${order.table?.number}` : 'Takeaway'} • {order.items?.length || 0} items
                                                        </div>
                                                    </div>
                                                    <button onClick={() => markAsServed(order.id)} style={{ background: 'var(--success)', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Check size={12} /> Serve
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="badge available">
                            <span className="badge-dot" /> System Online
                        </div>
                        <div style={{ background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                    </div>
                </header>
                <div className="page-content">
                    {children}
                </div>
            </main>
        </div>
    );
}
