'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import { Settings, Save, Bell, Shield, Download } from 'lucide-react';

export default function SettingsPage() {
    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <Settings size={20} className="text-brand-500" /> System Settings
                    </h2>
                    <p className="text-muted text-sm mt-1">Configure restaurant operations parameters</p>
                </div>
                <button className="btn btn-primary"><Save size={16} /> Save Changes</button>
            </div>

            <div className="grid-2 gap-4">
                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Settings size={16} /> General Settings</h3>
                    <form className="mt-4">
                        <div className="form-group">
                            <label className="form-label">Restaurant Name</label>
                            <input type="text" className="form-input" defaultValue="Flavor OS Demo" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Currency Symbol</label>
                            <input type="text" className="form-input" defaultValue="$" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tax Rate (%)</label>
                            <input type="number" className="form-input" defaultValue="10.0" />
                        </div>
                    </form>
                </div>

                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Bell size={16} /> Notifications</h3>
                    <div className="mt-4 space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer py-2 border-b border-[var(--border)]">
                            <input type="checkbox" defaultChecked />
                            <div className="flex-1">
                                <div className="font-bold">New Order Alerts</div>
                                <div className="text-sm text-muted">Play sound when new order arrives in KDS</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer py-2 border-b border-[var(--border)]">
                            <input type="checkbox" defaultChecked />
                            <div className="flex-1">
                                <div className="font-bold">Low Inventory Warnings</div>
                                <div className="text-sm text-muted">Show banner when items drop below min stock</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer py-2">
                            <input type="checkbox" />
                            <div className="flex-1">
                                <div className="font-bold">Daily Email Report</div>
                                <div className="text-sm text-muted">Send end-of-day summary to admin</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Shield size={16} /> Security & Access</h3>
                    <div className="mt-4">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <input type="checkbox" defaultChecked />
                            <div className="flex-1">
                                <div className="font-bold text-sm">Require Manager Override for Voiding orders</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <input type="checkbox" defaultChecked />
                            <div className="flex-1">
                                <div className="font-bold text-sm">Force Password Reset every 90 days</div>
                            </div>
                        </label>
                        <button className="btn btn-secondary mt-2 w-full justify-center"><Shield size={16} /> View Audit Logs</button>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title mb-4 border-b border-[var(--border)] pb-2 flex items-center gap-2"><Download size={16} /> Data Export</h3>
                    <div className="text-sm text-muted mb-4">Download all restaurant data for your records or accounting software import.</div>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary flex-1 justify-center">Export Menu (CSV)</button>
                        <button className="btn btn-secondary flex-1 justify-center">Export Sales (CSV)</button>
                    </div>
                    <button className="btn btn-primary w-full mt-2 justify-center">Full Database Backup (JSON)</button>
                </div>
            </div>
        </AppLayout>
    );
}
