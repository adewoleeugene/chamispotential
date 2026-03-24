'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard, UtensilsCrossed, ShoppingCart, Table2, CalendarDays,
    Package, Users, BarChart3, LogOut, ChefHat, X
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'main', roles: ['admin', 'manager', 'waiter'] },
    { href: '/orders', icon: ShoppingCart, label: 'Orders', section: 'main', roles: ['manager'] },
    { href: '/tables', icon: Table2, label: 'Tables', section: 'main', roles: ['admin', 'manager', 'waiter'] },
    { href: '/menu', icon: UtensilsCrossed, label: 'Menu', section: 'main', roles: ['admin', 'manager'] },
    { href: '/reservations', icon: CalendarDays, label: 'Reservations', section: 'main', roles: ['admin', 'manager'] },
    { href: '/kitchen', icon: ChefHat, label: 'Kitchen', section: 'main', roles: ['admin', 'manager', 'kitchen'] },
    { href: '/inventory', icon: Package, label: 'Inventory', section: 'operations', roles: ['admin', 'manager'] },
    { href: '/staff', icon: Users, label: 'Staff', section: 'operations', roles: ['admin', 'manager'] },
    { href: '/reports', icon: BarChart3, label: 'Reports', section: 'operations', roles: ['admin', 'manager'] },
];

export default function Sidebar({
    pendingOrders = 0,
    readyOrders = [],
    highlightActiveOrders = false,
    onServeReadyOrder,
    showOverlay = true,
    isOpen = false,
    onClose,
}: {
    pendingOrders?: number;
    readyOrders?: Array<{
        id: string;
        orderNumber: string | number;
        type: string;
        items?: Array<unknown>;
        table?: {
            number?: string | number;
        } | null;
    }>;
    highlightActiveOrders?: boolean;
    onServeReadyOrder?: (id: string) => void | Promise<void>;
    showOverlay?: boolean;
    isOpen?: boolean;
    onClose?: () => void;
}) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const sections = ['main', 'operations'];
    const sectionLabels: Record<string, string> = { main: 'Operations', operations: 'Management' };
    const activeOrderRef = useRef<HTMLDivElement | null>(null);

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Guest';

    useEffect(() => {
        if (!highlightActiveOrders || !isOpen) return;
        activeOrderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [highlightActiveOrders, isOpen]);

    return (
        <>
            <div className={`sidebar-overlay ${isOpen && showOverlay ? 'show' : ''}`} onClick={onClose} />
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-mark">
                        <div className="logo-icon">FO</div>
                        <div className="logo-text">
                            <div className="logo-name">Flavor OS</div>
                            <div className="logo-tagline">Editorial service suite</div>
                        </div>
                    </div>
                    <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">
                        <X size={18} />
                    </button>
                </div>

                {user?.role !== 'waiter' && (
                    <div className="sidebar-shift-card">
                        <span className="sidebar-shift-label">Live service</span>
                        <strong className="sidebar-shift-value">Dinner cadence</strong>
                        <p className="sidebar-shift-copy">Keep reservations, tables, tickets, and checkout moving in one rhythm.</p>
                        <div className="sidebar-shift-meta">
                            <span>{roleLabel}</span>
                            <span>Always on</span>
                        </div>
                    </div>
                )}

                {user?.role === 'waiter' && readyOrders.length > 0 && (
                    <div
                        ref={activeOrderRef}
                        className={`sidebar-pickup-card${highlightActiveOrders ? ' sidebar-pickup-card--highlight' : ''}`}
                    >
                        <div className="sidebar-pickup-header">
                            <span className="sidebar-pickup-label">Active Order</span>
                            <span className="sidebar-pickup-count">{readyOrders.length} ready</span>
                        </div>
                        <p className="sidebar-pickup-copy">
                            {readyOrders.length === 1
                                ? 'Ready to serve now.'
                                : 'Ready orders waiting on your station.'}
                        </p>
                        <div className="sidebar-pickup-list">
                            {readyOrders.slice(0, 5).map((order) => (
                                <button
                                    key={order.id}
                                    type="button"
                                    className="sidebar-pickup-item"
                                    onClick={() => onServeReadyOrder?.(order.id)}
                                >
                                    <div className="sidebar-pickup-item-copy">
                                        <div className="sidebar-pickup-order">Order #{order.orderNumber}</div>
                                        <div className="sidebar-pickup-detail">
                                            {order.type === 'dine-in' ? `Table ${order.table?.number}` : 'Takeaway'}
                                        </div>
                                    </div>
                                    <span className="sidebar-pickup-action">Serve</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <nav className="sidebar-nav">
                    {sections.map(section => {
                        const items = navItems.filter((i) => {
                            if (i.section !== section) return false;
                            if (!user) return true;
                            return i.roles.includes(user.role);
                        });
                        if (items.length === 0) return null;
                        return (
                            <div key={section} className="nav-section">
                                <div className="nav-section-label">{sectionLabels[section]}</div>
                                {items.map(item => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                    return (
                                        <Link key={item.href} href={item.href} className={`nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
                                            <Icon size={17} className="nav-icon" />
                                            <span>{item.label}</span>
                                            {item.href === '/orders' && pendingOrders > 0 && (
                                                <span className="nav-badge">{pendingOrders}</span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <button type="button" className="user-info" onClick={handleLogout} title="Sign out">
                        <div className="user-avatar">{user ? getInitials(user.name) : '?'}</div>
                        <div className="user-details">
                            <div className="user-name">{user?.name}</div>
                            <div className="user-role">Signed in as {roleLabel}</div>
                        </div>
                        <LogOut size={15} className="user-action" />
                    </button>
                </div>
            </aside>
        </>
    );
}
