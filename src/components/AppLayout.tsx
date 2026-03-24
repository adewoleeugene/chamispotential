'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Bell, Check, Menu, ChefHat, ArrowRight } from 'lucide-react';

type ReadyOrder = {
    id: string;
    orderNumber: string | number;
    type: string;
    items?: Array<unknown>;
    table?: {
        number?: string | number;
    } | null;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarOverlayVisible, setSidebarOverlayVisible] = useState(false);
    const [highlightActiveOrders, setHighlightActiveOrders] = useState(false);
    const [headerDate, setHeaderDate] = useState('');

    useEffect(() => {
        if (!loading && !user && pathname !== '/login' && pathname !== '/') {
            router.push('/login');
        }
    }, [user, loading, router, pathname]);

    useEffect(() => {
        if (!loading && user?.mustChangePassword && pathname !== '/change-password') {
            router.push('/change-password');
        }
    }, [loading, pathname, router, user]);

    useEffect(() => {
        if (!user) return;
        const fetchReady = () => {
            fetch('/api/orders?status=ready')
                .then(r => r.json())
                .then(d => { if (Array.isArray(d)) setReadyOrders(d as ReadyOrder[]); })
                .catch(() => { });
        };
        fetchReady();
        const interval = setInterval(fetchReady, 10000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        document.body.classList.toggle('menu-open', sidebarOpen && sidebarOverlayVisible);
        return () => document.body.classList.remove('menu-open');
    }, [sidebarOpen, sidebarOverlayVisible]);

    useEffect(() => {
        if (!highlightActiveOrders) return;
        const timeout = window.setTimeout(() => setHighlightActiveOrders(false), 2200);
        return () => window.clearTimeout(timeout);
    }, [highlightActiveOrders]);

    useEffect(() => {
        const formatter = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        const updateHeaderDate = () => {
            setHeaderDate(formatter.format(new Date()));
        };

        updateHeaderDate();
        const interval = window.setInterval(updateHeaderDate, 60000);
        return () => window.clearInterval(interval);
    }, []);

    const markAsServed = async (id: string) => {
        await fetch(`/api/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'served' })
        });
        setReadyOrders(prev => prev.filter(o => o.id !== id));
    };

    if (loading || !user || (user.mustChangePassword && pathname !== '/change-password')) {
        return (
            <div className="fullscreen-shell">
                <div className="fullscreen-panel">
                    <span className="fullscreen-kicker">Preparing service</span>
                    <div className="loading-spinner" />
                    <p className="fullscreen-copy">Loading your station and live orders.</p>
                </div>
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
    };

    const getTitle = () => {
        const mainPath = `/${pathname.split('/')[1]}`;
        return titleMap[mainPath] || 'Restaurant System';
    };

    const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    const userInitials = user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
    const nextReadyOrder = readyOrders[0] || null;

    return (
        <div className="app-layout">
            <Sidebar
                readyOrders={readyOrders}
                highlightActiveOrders={highlightActiveOrders}
                onServeReadyOrder={markAsServed}
                showOverlay={sidebarOverlayVisible}
                isOpen={sidebarOpen}
                onClose={() => {
                    setSidebarOpen(false);
                    setSidebarOverlayVisible(false);
                    setHighlightActiveOrders(false);
                }}
            />
            <main className="main-content">
                <header className="header">
                    <div className="header-left">
                        <button
                            className="mobile-nav-toggle"
                            onClick={() => {
                                setSidebarOverlayVisible(true);
                                setSidebarOpen(true);
                            }}
                            aria-label="Open navigation"
                        >
                            <Menu size={18} />
                        </button>
                        <div className="header-title-group">
                            <span className="header-kicker">Service command center</span>
                            <div className="header-title-row">
                                <h1 className="page-title">{getTitle()}</h1>
                                <span className="header-chip">{roleLabel}</span>
                            </div>
                            <p className="page-subtitle">Real-time restaurant operations with live floor awareness.</p>
                        </div>
                    </div>
                    <div className="header-right">
                        {user?.role === 'waiter' && (
                            <div className="header-notification-wrap">
                                <button
                                    onClick={() => setShowNotifs(!showNotifs)}
                                    className="header-icon-button"
                                    aria-label="Toggle ready order notifications"
                                    aria-expanded={showNotifs}
                                >
                                    <Bell size={18} />
                                    {readyOrders.length > 0 && (
                                        <span className="header-icon-badge">
                                            {readyOrders.length}
                                        </span>
                                    )}
                                </button>

                                {showNotifs && (
                                    <div className="header-popover">
                                        <div className="header-popover-heading">
                                            Ready for Pickup
                                        </div>
                                        <div className="header-popover-body">
                                            {readyOrders.length === 0 ? (
                                                <div className="header-popover-empty">No orders currently ready.</div>
                                            ) : readyOrders.map(order => (
                                                <div key={order.id} className="header-popover-item">
                                                    <div className="header-popover-copy">
                                                        <div className="header-popover-order">Order #{order.orderNumber}</div>
                                                        <div className="header-popover-detail">
                                                            {order.type === 'dine-in' ? `Table ${order.table?.number}` : 'Takeaway'} • {order.items?.length || 0} items
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => markAsServed(order.id)} className="header-popover-action">
                                                        <Check size={12} /> Serve
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="badge available header-status-pill">
                            <span className="badge-dot" /> System Online
                        </div>
                        <div className="header-date-pill">{headerDate}</div>
                        <div className="header-profile">
                            <span className="header-profile-avatar">{userInitials}</span>
                            <div className="header-profile-copy">
                                <span className="header-profile-name">{user.name}</span>
                                <span className="header-profile-role">{roleLabel}</span>
                            </div>
                        </div>
                    </div>
                </header>
                {user?.role === 'waiter' && readyOrders.length > 0 && (
                    <div className="waiter-ready-banner">
                        <div className="waiter-ready-banner-copy">
                            <div className="waiter-ready-banner-kicker">
                                <ChefHat size={14} />
                                Kitchen Alert
                            </div>
                            <div className="waiter-ready-banner-title">
                                {readyOrders.length === 1
                                    ? `Order #${nextReadyOrder?.orderNumber} is ready for pickup`
                                    : `${readyOrders.length} orders are ready for pickup`}
                            </div>
                            <div className="waiter-ready-banner-detail">
                                {readyOrders.length === 1
                                    ? (nextReadyOrder?.type === 'dine-in'
                                        ? `Collect from kitchen and serve Table ${nextReadyOrder.table?.number}.`
                                        : 'Collect from kitchen and hand off the takeaway order.')
                                    : 'Open the bell or view the ready orders in the sidebar to clear the ready stack.'}
                            </div>
                        </div>
                        <div className="waiter-ready-banner-actions">
                            {readyOrders.length === 1 && nextReadyOrder && (
                                <button type="button" className="waiter-ready-banner-button" onClick={() => markAsServed(nextReadyOrder.id)}>
                                    <Check size={14} /> Mark picked up
                                </button>
                            )}
                            <button
                                type="button"
                                className="waiter-ready-banner-link"
                                onClick={() => {
                                    setSidebarOverlayVisible(false);
                                    setSidebarOpen(true);
                                    setHighlightActiveOrders(true);
                                }}
                            >
                                View orders <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
                <div className="page-content">
                    {children}
                </div>
            </main>
        </div>
    );
}
