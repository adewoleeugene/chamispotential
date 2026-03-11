'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import { BarChart3, LineChart, Users, DollarSign, ArrowUpRight, FileText, Download } from 'lucide-react';

export default function ReportsPage() {
    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }} className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-brand-500" /> Executive Reports
                    </h2>
                    <p className="text-muted text-sm mt-1">Advanced analytics and historical data</p>
                </div>
                <div className="flex gap-2">
                    <select className="form-select bg-card border-[var(--border)]" style={{ width: 140 }}>
                        <option>Last 7 Days</option>
                        <option>This Month</option>
                        <option>Last Quarter</option>
                        <option>Year to Date</option>
                    </select>
                    <button className="btn btn-secondary"><Download size={16} /> Export (PDF)</button>
                </div>
            </div>

            <div className="grid-3 gap-4 mb-4">
                <div className="card text-center" style={{ padding: 24 }}>
                    <div className="text-muted text-sm font-bold uppercase mb-2">Total Sales</div>
                    <div className="font-bold text-success mb-2" style={{ fontSize: 28, fontFamily: 'Plus Jakarta Sans' }}>$42,150.80</div>
                    <div className="text-xs text-muted flex items-center justify-center gap-1">
                        <ArrowUpRight size={14} className="text-success" /> <span className="text-success">8.5%</span> vs previous period
                    </div>
                </div>
                <div className="card text-center" style={{ padding: 24 }}>
                    <div className="text-muted text-sm font-bold uppercase mb-2">Total Orders</div>
                    <div className="font-bold mb-2" style={{ fontSize: 28, fontFamily: 'Plus Jakarta Sans', color: 'var(--brand-icon)' }}>1,432</div>
                    <div className="text-xs text-muted flex items-center justify-center gap-1">
                        <ArrowUpRight size={14} className="text-success" /> <span className="text-success">2.1%</span> vs previous period
                    </div>
                </div>
                <div className="card text-center" style={{ padding: 24 }}>
                    <div className="text-muted text-sm font-bold uppercase mb-2">Average Ticket</div>
                    <div className="font-bold mb-2" style={{ fontSize: 28, fontFamily: 'Plus Jakarta Sans', color: 'var(--info)' }}>$29.45</div>
                    <div className="text-xs text-muted flex items-center justify-center gap-1">
                        <ArrowUpRight size={14} className="text-success" /> <span className="text-success">5.2%</span> vs previous period
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
                    <FileText size={16} className="text-muted" /> <h3 className="card-title m-0">Generated Reports Library</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-center p-3 border border-[var(--border)] rounded-md hover:bg-[rgba(255,255,255,0.02)] transition">
                        <div className="flex items-center gap-3">
                            <div className="bg-[rgba(239,68,68,0.1)] p-2 rounded-md"><LineChart size={18} color="#ef4444" /></div>
                            <div>
                                <div className="font-bold text-sm">Monthly Revenue Breakdown</div>
                                <div className="text-xs text-muted mt-1">March 2026 • 24MB</div>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-sm"><Download size={14} /> Download</button>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-[var(--border)] rounded-md hover:bg-[rgba(255,255,255,0.02)] transition">
                        <div className="flex items-center gap-3">
                            <div className="bg-[rgba(16,185,129,0.1)] p-2 rounded-md"><Users size={18} color="#10b981" /></div>
                            <div>
                                <div className="font-bold text-sm">Staff Performance & Shifts</div>
                                <div className="text-xs text-muted mt-1">Feb 2026 • 12MB</div>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-sm"><Download size={14} /> Download</button>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-[var(--border)] rounded-md hover:bg-[rgba(255,255,255,0.02)] transition">
                        <div className="flex items-center gap-3">
                            <div className="bg-[rgba(59,130,246,0.1)] p-2 rounded-md"><DollarSign size={18} color="#3b82f6" /></div>
                            <div>
                                <div className="font-bold text-sm">Cost vs Sales Margin Analysis</div>
                                <div className="text-xs text-muted mt-1">Q1 2026 • 35MB</div>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-sm"><Download size={14} /> Download</button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
