'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
    isOpen = false,
    onClose,
}: {
    pendingOrders?: number;
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

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Guest';

    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'show' : ''}`} onClick={onClose} />
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

                <div className="sidebar-shift-card">
                    <span className="sidebar-shift-label">Live service</span>
                    <strong className="sidebar-shift-value">Dinner cadence</strong>
                    <p className="sidebar-shift-copy">Keep reservations, tables, tickets, and checkout moving in one rhythm.</p>
                    <div className="sidebar-shift-meta">
                        <span>{roleLabel}</span>
                        <span>Always on</span>
                    </div>
                </div>

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
