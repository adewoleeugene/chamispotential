'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Trash2, Search, Utensils, X, Save, ChefHat, Info } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { formatLeones } from '@/lib/currency';

type Category = {
    id: string;
    name: string;
    icon?: string;
    sortOrder?: number;
};

type MenuItem = {
    id: string;
    name: string;
    description?: string;
    price: number;
    cost?: number;
    categoryId: string;
    isPopular: boolean;
    category?: Category;
};

type InventoryItem = {
    id: string;
    name: string;
    unit: string;
};

type RecipeIngredient = {
    id: string;
    inventoryId: string;
    quantityUsed: number;
    inventory?: InventoryItem;
};

type ItemFormState = {
    id: string;
    name: string;
    description: string;
    price: number;
    cost: number;
    categoryId: string;
    isPopular: boolean;
};

export default function MenuPage() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const toast = useToast();

    // Modals
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [showRecipeEditor, setShowRecipeEditor] = useState(false);

    // Form States
    const [itemForm, setItemForm] = useState<ItemFormState>({ id: '', name: '', description: '', price: 0, cost: 0, categoryId: '', isPopular: false });
    const [categoryForm, setCategoryForm] = useState({ name: '', icon: '🍽️', sortOrder: 0 });
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
    const [newIngredient, setNewIngredient] = useState({ inventoryId: '', quantityUsed: 1 });

    const fetchData = useCallback(async () => {
        try {
            const [m, c, i] = await Promise.all([
                fetch('/api/menu').then(r => r.json()),
                fetch('/api/categories').then(r => r.json()),
                fetch('/api/inventory').then(r => r.json())
            ]);
            setItems(m);
            setCategories(c);
            setInventory(i);
            setLoading(false);
        } catch {
            toast('error', 'Failed to load menu data');
        }
    }, [toast]);

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchData();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchData]);

    const loadRecipeIngredients = async (itemId: string) => {
        try {
            const res = await fetch(`/api/menu/${itemId}/ingredients`);
            const data = await res.json();
            setRecipeIngredients(data);
        } catch {
            toast('error', 'Failed to load recipe');
        }
    };

    const saveItem = async (openRecipeAfterSave = false) => {
        const method = itemForm.id ? 'PATCH' : 'POST';
        const url = itemForm.id ? `/api/menu/${itemForm.id}` : '/api/menu';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemForm)
            });
            if (res.ok) {
                const savedItem = await res.json();
                const nextItemForm = {
                    id: savedItem.id,
                    name: savedItem.name,
                    description: savedItem.description || '',
                    price: savedItem.price,
                    cost: savedItem.cost || 0,
                    categoryId: savedItem.categoryId,
                    isPopular: savedItem.isPopular,
                };

                setItemForm(nextItemForm);
                setSelectedItem(savedItem);
                toast('success', `Item ${itemForm.id ? 'updated' : 'created'} successfully`);

                if (openRecipeAfterSave) {
                    await loadRecipeIngredients(savedItem.id);
                    setShowRecipeEditor(true);
                } else {
                    setIsItemModalOpen(false);
                    setShowRecipeEditor(false);
                }

                fetchData();
                return savedItem;
            }
        } catch {
            toast('error', 'Failed to save item');
        }

        return null;
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveItem(false);
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast('success', 'Item deleted');
                fetchData();
            }
        } catch {
            toast('error', 'Failed to delete item');
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryForm)
            });
            if (res.ok) {
                toast('success', 'Category created');
                setIsCategoryModalOpen(false);
                fetchData();
            }
        } catch {
            toast('error', 'Failed to create category');
        }
    };

    const handleOpenRecipeEditor = async () => {
        const itemId = itemForm.id;

        if (!itemId) {
            const savedItem = await saveItem(true);
            if (!savedItem) return;
            return;
        }

        setSelectedItem({
            id: itemId,
            name: itemForm.name,
            description: itemForm.description,
            price: itemForm.price,
            cost: itemForm.cost,
            categoryId: itemForm.categoryId,
            isPopular: itemForm.isPopular,
        });
        await loadRecipeIngredients(itemId);
        setShowRecipeEditor(true);
    };

    const handleAddIngredient = async () => {
        if (!newIngredient.inventoryId || !selectedItem) return;
        try {
            const res = await fetch(`/api/menu/${selectedItem.id}/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newIngredient)
            });
            if (res.ok) {
                const updated = await res.json();
                setRecipeIngredients(prev => {
                    const exists = prev.findIndex(i => i.inventoryId === updated.inventoryId);
                    if (exists > -1) {
                        const next = [...prev];
                        next[exists] = updated;
                        return next;
                    }
                    return [...prev, updated];
                });
                setNewIngredient({ inventoryId: '', quantityUsed: 1 });
                toast('success', 'Ingredient added to recipe');
            }
        } catch {
            toast('error', 'Failed to add ingredient');
        }
    };

    const handleRemoveIngredient = async (id: string) => {
        if (!selectedItem) return;
        try {
            const res = await fetch(`/api/menu/${selectedItem.id}/ingredients`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeIngredientId: id })
            });
            if (res.ok) {
                setRecipeIngredients(prev => prev.filter(i => i.id !== id));
                toast('success', 'Ingredient removed');
            }
        } catch {
            toast('error', 'Failed to remove ingredient');
        }
    };

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.category?.name || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <AppLayout><div className="loading-spinner" style={{ margin: '100px auto' }} /></AppLayout>;

    return (
        <AppLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Utensils className="text-primary" /> Menu Management
                    </h1>
                    <p className="text-muted">Manage your dishes, drinks, and their recipe linkages.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => {
                        setCategoryForm({ name: '', icon: '🍽️', sortOrder: categories.length });
                        setIsCategoryModalOpen(true);
                    }}>
                        <Plus size={16} /> Add Category
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                        setItemForm({ id: '', name: '', description: '', price: 0, cost: 0, categoryId: categories[0]?.id || '', isPopular: false });
                        setSelectedItem(null);
                        setRecipeIngredients([]);
                        setNewIngredient({ inventoryId: '', quantityUsed: 1 });
                        setShowRecipeEditor(false);
                        setIsItemModalOpen(true);
                    }}>
                        <Plus size={16} /> Add Item
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="search-input flex-1">
                    <Search size={16} />
                    <input type="text" placeholder="Search dishes, drinks, or category..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item Details</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="font-bold">{item.name}</div>
                                        <div className="text-muted text-sm truncate" style={{ maxWidth: 300 }}>{item.description}</div>
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                                            {item.category?.icon} {item.category?.name}
                                        </span>
                                    </td>
                                    <td className="font-bold text-success">{formatLeones(item.price)}</td>
                                    <td>
                                        {item.isPopular ? <span className="badge available">⭐ Popular</span> : <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>Standard</span>}
                                    </td>
                                    <td>
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                className="btn btn-icon btn-secondary"
                                                title="Edit"
                                                onClick={() => {
                                                    setItemForm({
                                                        id: item.id,
                                                        name: item.name,
                                                        description: item.description || '',
                                                        price: item.price,
                                                        cost: item.cost || 0,
                                                        categoryId: item.categoryId,
                                                        isPopular: item.isPopular,
                                                    });
                                                    setSelectedItem(item);
                                                    setRecipeIngredients([]);
                                                    setNewIngredient({ inventoryId: '', quantityUsed: 1 });
                                                    setShowRecipeEditor(false);
                                                    setIsItemModalOpen(true);
                                                }}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-icon btn-danger" title="Delete" onClick={() => handleDeleteItem(item.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Item Modal */}
            {isItemModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 680 }}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold">{itemForm.id ? 'Edit Menu Item' : 'New Menu Item'}</h2>
                                <p className="text-sm text-muted">
                                    {itemForm.id ? 'Update the item and manage its recipe in one place.' : 'Create the item, then configure recipe ingredients from this popup.'}
                                </p>
                            </div>
                            <button className="btn btn-icon btn-ghost" onClick={() => setIsItemModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm text-muted mb-1">Item Name</label>
                                <input required className="form-input" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Signature Truffle Burger" />
                            </div>
                            <div>
                                <label className="block text-sm text-muted mb-1">Description</label>
                                <textarea className="form-input" rows={3} value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Describe the dish..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1">Price ($)</label>
                                    <input required type="number" step="0.01" className="form-input" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: parseFloat(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1">Selection Category</label>
                                    <select className="form-input" value={itemForm.categoryId} onChange={e => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input type="checkbox" id="isPopular" checked={itemForm.isPopular} onChange={e => setItemForm({ ...itemForm, isPopular: e.target.checked })} />
                                <label htmlFor="isPopular" className="text-sm">Mark as Popular (Show ⭐ badge)</label>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            <ChefHat size={16} className="text-primary" /> Recipe
                                        </div>
                                        <div className="text-sm text-muted">
                                            Link inventory ingredients so orders deduct stock automatically.
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={handleOpenRecipeEditor}>
                                        <ChefHat size={16} /> {showRecipeEditor ? 'Refresh Recipe' : 'Recipe'}
                                    </button>
                                </div>
                                {!itemForm.id && (
                                    <div className="text-xs text-muted mt-3">
                                        Selecting `Recipe` will save this item first, then open the ingredient editor here.
                                    </div>
                                )}
                            </div>

                            {showRecipeEditor && (
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <div className="mb-6">
                                        <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                                            <ChefHat size={16} className="text-primary" /> Recipe: {selectedItem?.name || itemForm.name}
                                        </h3>
                                        <p className="text-sm text-muted">Stock will be automatically deducted when this item is ordered.</p>
                                    </div>

                                    <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Plus size={14} /> Add Ingredient</h3>
                                        <div className="flex gap-2">
                                            <select
                                                className="form-input flex-1"
                                                value={newIngredient.inventoryId}
                                                onChange={e => setNewIngredient({ ...newIngredient, inventoryId: e.target.value })}
                                            >
                                                <option value="">Select inventory item...</option>
                                                {inventory.map(i => (
                                                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                ))}
                                            </select>
                                            <div style={{ width: 100 }}>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    className="form-input"
                                                    placeholder="Qty"
                                                    value={newIngredient.quantityUsed}
                                                    onChange={e => setNewIngredient({ ...newIngredient, quantityUsed: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                            <button type="button" className="btn btn-primary btn-icon" onClick={handleAddIngredient} title="Add to recipe">
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="recipe-list">
                                        <h3 className="text-sm font-bold mb-3 text-muted">CURRENT INGREDIENTS</h3>
                                        {recipeIngredients.length === 0 ? (
                                            <div className="text-center p-8 border border-dashed border-white/10 rounded-lg text-muted text-sm">
                                                <Info className="mx-auto mb-2 opacity-20" size={32} />
                                                No ingredients linked yet. This item won&apos;t affect stock levels.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {recipeIngredients.map(ri => (
                                                    <div key={ri.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                                        <div>
                                                            <div className="font-bold">{ri.inventory?.name}</div>
                                                            <div className="text-xs text-muted">Deducts {ri.quantityUsed} {ri.inventory?.unit} per order</div>
                                                        </div>
                                                        <button type="button" className="btn btn-icon btn-ghost text-danger" onClick={() => handleRemoveIngredient(ri.id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsItemModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1"><Save size={16} /> Save Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 400 }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Add New Category</h2>
                            <button className="btn btn-icon btn-ghost" onClick={() => setIsCategoryModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm text-muted mb-1">Category Name</label>
                                <input required className="form-input" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="e.g. Main Course" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted mb-1">Icon (Emoji)</label>
                                    <input className="form-input text-center" value={categoryForm.icon} onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })} maxLength={2} />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1">Display Order</label>
                                    <input type="number" className="form-input" value={categoryForm.sortOrder} onChange={e => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) })} />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary w-full mt-4"><Plus size={16} /> Create Category</button>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: #1a1a1a;
                    padding: 2rem;
                    border-radius: 1rem;
                    border: 1px solid rgba(255,255,255,0.1);
                    width: 90%;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }
                .form-input {
                    width: 100%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 0.5rem;
                    padding: 0.6rem 0.8rem;
                    color: white;
                    transition: all 0.2s;
                }
                .form-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    background: rgba(255,255,255,0.1);
                }
                select.form-input option {
                    background: #1a1a1a;
                }
            `}</style>
        </AppLayout>
    );
}
