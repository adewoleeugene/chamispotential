'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard, UtensilsCrossed, ShoppingCart, Table2, CalendarDays,
    Package, Users, BarChart3, Settings, LogOut, ChefHat
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'main', roles: ['admin', 'manager', 'waiter'] },
    { href: '/orders', icon: ShoppingCart, label: 'Orders', section: 'main', roles: ['admin', 'manager', 'waiter'] },
    { href: '/tables', icon: Table2, label: 'Tables', section: 'main', roles: ['admin', 'manager', 'waiter'] },
    { href: '/menu', icon: UtensilsCrossed, label: 'Menu', section: 'main', roles: ['admin', 'manager'] },
    { href: '/reservations', icon: CalendarDays, label: 'Reservations', section: 'main', roles: ['admin', 'manager'] },
    { href: '/kitchen', icon: ChefHat, label: 'Kitchen', section: 'main', roles: ['admin', 'manager', 'kitchen'] },
    { href: '/inventory', icon: Package, label: 'Inventory', section: 'operations', roles: ['admin', 'manager'] },
    { href: '/staff', icon: Users, label: 'Staff', section: 'operations', roles: ['admin', 'manager'] },
    { href: '/reports', icon: BarChart3, label: 'Reports', section: 'operations', roles: ['admin', 'manager'] },
    { href: '/settings', icon: Settings, label: 'Settings', section: 'system', roles: ['admin'] },
];

export default function Sidebar({ pendingOrders = 0 }: { pendingOrders?: number }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const sections = ['main', 'operations', 'system'];
    const sectionLabels: Record<string, string> = { main: 'Operations', operations: 'Management', system: 'System' };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-mark">
                    <div className="logo-icon">🍽️</div>
                    <div className="logo-text">
                        <div className="logo-name">Flavor OS</div>
                        <div className="logo-tagline">Restaurant Suite</div>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {sections.map(section => {
                    const items = navItems.filter(i => i.section === section && (!user || i.roles.includes(user.role)));
                    if (items.length === 0) return null;
                    return (
                        <div key={section} className="nav-section">
                            <div className="nav-section-label">{sectionLabels[section]}</div>
                            {items.map(item => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                return (
                                    <Link key={item.href} href={item.href} className={`nav-item${isActive ? ' active' : ''}`}>
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
                <div className="user-info" onClick={handleLogout} title="Click to logout">
                    <div className="user-avatar">{user ? getInitials(user.name) : '?'}</div>
                    <div className="user-details">
                        <div className="user-name">{user?.name}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
                    <LogOut size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
            </div>
        </aside>
    );
}
