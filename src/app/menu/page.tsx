'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Trash2, Search, Utensils, X, Save, ChefHat, Info } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';

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
    extraOptions?: ExtraOption[];
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

type ExtraOption = {
    id: string;
    inventoryId: string;
    label: string;
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
};

type IngredientDraft = {
    id: string;
    inventoryId: string;
    quantityUsed: string;
};

type ExtraDraft = {
    id: string;
    inventoryId: string;
    label: string;
    quantityUsed: string;
};

function createIngredientDraft(): IngredientDraft {
    return {
        id: Math.random().toString(36).slice(2, 11),
        inventoryId: '',
        quantityUsed: '',
    };
}

function createExtraDraft(): ExtraDraft {
    return {
        id: Math.random().toString(36).slice(2, 11),
        inventoryId: '',
        label: '',
        quantityUsed: '',
    };
}

export default function MenuPage() {
    const { user } = useAuth();
    const { settings } = useSettings();
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
    const [showExtrasEditor, setShowExtrasEditor] = useState(false);

    // Form States
    const [itemForm, setItemForm] = useState<ItemFormState>({ id: '', name: '', description: '', price: 0, cost: 0, categoryId: '' });
    const [categoryForm, setCategoryForm] = useState({ name: '', icon: '🍽️', sortOrder: 0 });
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
    const [ingredientDrafts, setIngredientDrafts] = useState<IngredientDraft[]>([createIngredientDraft()]);
    const [extraOptions, setExtraOptions] = useState<ExtraOption[]>([]);
    const [extraDrafts, setExtraDrafts] = useState<ExtraDraft[]>([createExtraDraft()]);
    const canManageMenu = user?.role === 'admin' || user?.role === 'manager';

    const buildItemPayload = () => ({
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        price: Number(itemForm.price),
        cost: Number(itemForm.cost),
        categoryId: itemForm.categoryId,
    });

    const fetchData = useCallback(async () => {
        try {
            const [m, c, i] = await Promise.all([
                fetch('/api/menu').then(r => r.json()),
                fetch('/api/categories').then(r => r.json()),
                fetch('/api/inventory').then(r => r.json())
            ]);
            setItems(Array.isArray(m) ? m : []);
            setCategories(Array.isArray(c) ? c : []);
            setInventory(Array.isArray(i) ? i : Array.isArray(i?.items) ? i.items : []);
            setLoading(false);
        } catch {
            setItems([]);
            setCategories([]);
            setInventory([]);
            setLoading(false);
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
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to load recipe');
            }
            const data = await res.json();
            setRecipeIngredients(data);
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to load recipe');
        }
    };

    const loadExtraOptions = async (itemId: string) => {
        try {
            const res = await fetch(`/api/menu/${itemId}/extras`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to load extras');
            }
            const data = await res.json();
            setExtraOptions(Array.isArray(data) ? data : []);
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to load extras');
        }
    };

    const saveItem = async (openRecipeAfterSave = false) => {
        const payload = buildItemPayload();
        const method = itemForm.id ? 'PATCH' : 'POST';
        const url = itemForm.id ? `/api/menu/${itemForm.id}` : '/api/menu';

        if (!payload.name) {
            toast('error', 'Item name is required');
            return null;
        }

        if (!payload.categoryId) {
            toast('error', 'Select a category before saving');
            return null;
        }

        if (!Number.isFinite(payload.price)) {
            toast('error', 'Enter a valid price');
            return null;
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || 'Failed to save item');
            }

            const savedItem = data;
            const nextItemForm = {
                id: savedItem.id,
                name: savedItem.name,
                description: savedItem.description || '',
                price: savedItem.price,
                cost: savedItem.cost || 0,
                categoryId: savedItem.categoryId,
            };

            setItemForm(nextItemForm);
            setSelectedItem(savedItem);
            toast('success', `Item ${itemForm.id ? 'updated' : 'created'} successfully`);

            if (openRecipeAfterSave) {
                await loadRecipeIngredients(savedItem.id);
                setShowRecipeEditor(true);
                await loadExtraOptions(savedItem.id);
            } else {
                setIsItemModalOpen(false);
                setShowRecipeEditor(false);
                setShowExtrasEditor(false);
            }

            fetchData();
            return savedItem;
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to save item');
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
            isPopular: false,
        });
        await loadRecipeIngredients(itemId);
        resetIngredientDrafts();
        setShowRecipeEditor(true);
    };

    const updateExtraDraft = (draftId: string, updates: Partial<ExtraDraft>) => {
        setExtraDrafts((prev) => prev.map((draft) => draft.id === draftId ? { ...draft, ...updates } : draft));
    };

    const addExtraDraftRow = () => {
        setExtraDrafts((prev) => [...prev, createExtraDraft()]);
    };

    const removeExtraDraftRow = (draftId: string) => {
        setExtraDrafts((prev) => {
            const remaining = prev.filter((draft) => draft.id !== draftId);
            return remaining.length > 0 ? remaining : [createExtraDraft()];
        });
    };

    const resetExtraDrafts = () => {
        setExtraDrafts([createExtraDraft()]);
    };

    const handleOpenExtrasEditor = async () => {
        const itemId = itemForm.id;

        if (!itemId) {
            const savedItem = await saveItem(false);
            if (!savedItem) return;
            await loadExtraOptions(savedItem.id);
            resetExtraDrafts();
            setShowExtrasEditor(true);
            setIsItemModalOpen(true);
            return;
        }

        setSelectedItem({
            id: itemId,
            name: itemForm.name,
            description: itemForm.description,
            price: itemForm.price,
            cost: itemForm.cost,
            categoryId: itemForm.categoryId,
            isPopular: false,
        });
        await loadExtraOptions(itemId);
        resetExtraDrafts();
        setShowExtrasEditor(true);
    };

    const handleSaveExtraDrafts = async () => {
        if (!selectedItem) return;

        const activeDrafts = extraDrafts.filter((draft) => draft.inventoryId.trim() || draft.label.trim() || draft.quantityUsed.trim());

        const sanitizedDrafts = activeDrafts
            .map((draft) => ({
                inventoryId: draft.inventoryId.trim(),
                label: draft.label.trim(),
                quantityUsed: Number(draft.quantityUsed),
            }))
            .filter((draft) => draft.inventoryId || draft.label || Number.isFinite(draft.quantityUsed));

        if (sanitizedDrafts.length === 0) {
            toast('error', 'Add at least one extra');
            return;
        }

        if (sanitizedDrafts.some((draft) => !draft.inventoryId || !draft.label)) {
            toast('error', 'Select an inventory item and enter a label for each extra');
            return;
        }

        if (sanitizedDrafts.some((draft) => !Number.isFinite(draft.quantityUsed) || draft.quantityUsed <= 0)) {
            toast('error', 'Enter a valid quantity for each extra');
            return;
        }

        try {
            const res = await fetch(`/api/menu/${selectedItem.id}/extras`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extras: sanitizedDrafts })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save extras');
            }

            const savedExtras = await res.json();
            const updates = Array.isArray(savedExtras) ? savedExtras : [savedExtras];
            setExtraOptions((prev) => {
                const next = [...prev];

                updates.forEach((updated) => {
                    const exists = next.findIndex((extra) => extra.id === updated.id || extra.label === updated.label);
                    if (exists > -1) {
                        next[exists] = updated;
                    } else {
                        next.push(updated);
                    }
                });

                return next;
            });
            resetExtraDrafts();
            toast('success', `${updates.length} extra option${updates.length === 1 ? '' : 's'} saved`);
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to save extras');
        }
    };

    const updateIngredientDraft = (draftId: string, updates: Partial<IngredientDraft>) => {
        setIngredientDrafts((prev) => prev.map((draft) => draft.id === draftId ? { ...draft, ...updates } : draft));
    };

    const addIngredientDraftRow = () => {
        setIngredientDrafts((prev) => [...prev, createIngredientDraft()]);
    };

    const removeIngredientDraftRow = (draftId: string) => {
        setIngredientDrafts((prev) => {
            const remaining = prev.filter((draft) => draft.id !== draftId);
            return remaining.length > 0 ? remaining : [createIngredientDraft()];
        });
    };

    const resetIngredientDrafts = () => {
        setIngredientDrafts([createIngredientDraft()]);
    };

    const handleSaveIngredientDrafts = async () => {
        if (!selectedItem) return;

        const activeDrafts = ingredientDrafts.filter((draft) => draft.inventoryId.trim() || draft.quantityUsed.trim());

        const sanitizedDrafts = activeDrafts
            .map((draft) => ({
                inventoryId: draft.inventoryId.trim(),
                quantityUsed: Number(draft.quantityUsed),
            }))
            .filter((draft) => draft.inventoryId || Number.isFinite(draft.quantityUsed));

        if (sanitizedDrafts.length === 0) {
            toast('error', 'Add at least one ingredient');
            return;
        }

        if (sanitizedDrafts.some((draft) => !draft.inventoryId)) {
            toast('error', 'Select an inventory item for each ingredient row');
            return;
        }

        if (sanitizedDrafts.some((draft) => !Number.isFinite(draft.quantityUsed) || draft.quantityUsed <= 0)) {
            toast('error', 'Enter a valid ingredient quantity for each row');
            return;
        }

        const uniqueInventoryIds = new Set(sanitizedDrafts.map((draft) => draft.inventoryId));
        if (uniqueInventoryIds.size !== sanitizedDrafts.length) {
            toast('error', 'Choose each inventory item only once per save');
            return;
        }

        try {
            const res = await fetch(`/api/menu/${selectedItem.id}/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredients: sanitizedDrafts })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save ingredients');
            }

            const savedIngredients = await res.json();
            const updates = Array.isArray(savedIngredients) ? savedIngredients : [savedIngredients];
            setRecipeIngredients(prev => {
                const next = [...prev];

                updates.forEach((updated) => {
                    const exists = next.findIndex(i => i.inventoryId === updated.inventoryId);
                    if (exists > -1) {
                        next[exists] = updated;
                    } else {
                        next.push(updated);
                    }
                });

                return next;
            });
            resetIngredientDrafts();
            toast('success', `${updates.length} ingredient${updates.length === 1 ? '' : 's'} saved to recipe`);
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to save ingredients');
        }
    };

    const openNewItemModal = () => {
        setItemForm({ id: '', name: '', description: '', price: 0, cost: 0, categoryId: categories[0]?.id || '' });
        setSelectedItem(null);
        setRecipeIngredients([]);
        resetIngredientDrafts();
        setExtraOptions([]);
        resetExtraDrafts();
        setShowRecipeEditor(false);
        setShowExtrasEditor(false);
        setIsItemModalOpen(true);
    };

    const openEditItemModal = (item: MenuItem) => {
        setItemForm({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.price,
            cost: item.cost || 0,
            categoryId: item.categoryId,
        });
        setSelectedItem(item);
        setRecipeIngredients([]);
        resetIngredientDrafts();
        setExtraOptions(Array.isArray((item as MenuItem & { extraOptions?: ExtraOption[] }).extraOptions) ? (item as MenuItem & { extraOptions?: ExtraOption[] }).extraOptions || [] : []);
        resetExtraDrafts();
        setShowRecipeEditor(false);
        setShowExtrasEditor(false);
        setIsItemModalOpen(true);
    };

    const handleRemoveIngredient = async (id: string) => {
        if (!selectedItem) return;
        try {
            const res = await fetch(`/api/menu/${selectedItem.id}/ingredients`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeIngredientId: id })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to remove ingredient');
            }

            setRecipeIngredients(prev => prev.filter(i => i.id !== id));
            toast('success', 'Ingredient removed');
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to remove ingredient');
        }
    };

    const handleRemoveExtra = async (id: string) => {
        if (!selectedItem) return;
        try {
            const res = await fetch(`/api/menu/${selectedItem.id}/extras`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extraOptionId: id })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to remove extra');
            }

            setExtraOptions((prev) => prev.filter((extra) => extra.id !== id));
            toast('success', 'Extra removed');
        } catch (error) {
            toast('error', error instanceof Error ? error.message : 'Failed to remove extra');
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
                {canManageMenu && (
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => {
                            setCategoryForm({ name: '', icon: '🍽️', sortOrder: categories.length });
                            setIsCategoryModalOpen(true);
                        }}>
                            <Plus size={16} /> Add Category
                        </button>
                        <button className="btn btn-primary" onClick={() => {
                            openNewItemModal();
                        }}>
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                )}
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
                                    <td className="font-bold text-success">{formatCurrency(item.price, settings.currencySymbol)}</td>
                                    <td>
                                        {item.isPopular
                                            ? <span className="badge available">Popular</span>
                                            : <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>Standard</span>}
                                    </td>
                                    <td>
                                        {canManageMenu && (
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    className="btn btn-icon btn-secondary"
                                                    title="Edit"
                                                    onClick={() => openEditItemModal(item)}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button className="btn btn-icon btn-danger" title="Delete" onClick={() => handleDeleteItem(item.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
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
                    <div className="modal-content item-modal-content" style={{ maxWidth: 680 }}>
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
                            <div className="grid grid-cols-2 gap-4 item-form-grid">
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

                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            <Plus size={16} className="text-primary" /> Allowed Extras
                                        </div>
                                        <div className="text-sm text-muted">
                                            These become structured add-ons the waiter can apply during customization.
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={handleOpenExtrasEditor}>
                                        <Plus size={16} /> {showExtrasEditor ? 'Refresh Extras' : 'Extras'}
                                    </button>
                                </div>
                                {!itemForm.id && (
                                    <div className="text-xs text-muted mt-3">
                                        Selecting `Extras` will save this item first, then open the extra-options editor here.
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
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <h3 className="text-sm font-bold flex items-center gap-2"><Plus size={14} /> Add Ingredients</h3>
                                            <button type="button" className="btn btn-secondary" onClick={addIngredientDraftRow}>
                                                <Plus size={16} /> Add Row
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {ingredientDrafts.map((draft, index) => (
                                                <div key={draft.id} className="recipe-add-row">
                                                    <select
                                                        className="form-input flex-1"
                                                        value={draft.inventoryId}
                                                        onChange={e => updateIngredientDraft(draft.id, { inventoryId: e.target.value })}
                                                    >
                                                        <option value="">Select inventory item...</option>
                                                        {inventory.map(i => (
                                                            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                        ))}
                                                    </select>
                                                    <div className="recipe-quantity-field">
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            className="form-input"
                                                            placeholder="Qty"
                                                            value={draft.quantityUsed}
                                                            onChange={e => updateIngredientDraft(draft.id, { quantityUsed: e.target.value })}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-icon btn-ghost"
                                                        onClick={() => removeIngredientDraftRow(draft.id)}
                                                        title={ingredientDrafts.length === 1 ? 'Clear row' : `Remove ingredient row ${index + 1}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end mt-4">
                                            <button type="button" className="btn btn-primary" onClick={handleSaveIngredientDrafts}>
                                                <Save size={16} /> Save Ingredients
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

                            {showExtrasEditor && (
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <div className="mb-6">
                                        <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                                            <Plus size={16} className="text-primary" /> Allowed Extras: {selectedItem?.name || itemForm.name}
                                        </h3>
                                        <p className="text-sm text-muted">Waiters can add these extras at order time, and inventory will be deducted accordingly.</p>
                                    </div>

                                    <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <h3 className="text-sm font-bold flex items-center gap-2"><Plus size={14} /> Add Extra Options</h3>
                                            <button type="button" className="btn btn-secondary" onClick={addExtraDraftRow}>
                                                <Plus size={16} /> Add Row
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {extraDrafts.map((draft, index) => (
                                                <div key={draft.id} className="recipe-add-row extra-add-row">
                                                    <select
                                                        className="form-input"
                                                        value={draft.inventoryId}
                                                        onChange={e => {
                                                            const inventoryItem = inventory.find((item) => item.id === e.target.value);
                                                            updateExtraDraft(draft.id, {
                                                                inventoryId: e.target.value,
                                                                label: draft.label || inventoryItem?.name || '',
                                                            });
                                                        }}
                                                    >
                                                        <option value="">Select inventory item...</option>
                                                        {inventory.map(i => (
                                                            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        className="form-input"
                                                        placeholder="Label for waiter"
                                                        value={draft.label}
                                                        onChange={e => updateExtraDraft(draft.id, { label: e.target.value })}
                                                    />
                                                    <div className="recipe-quantity-field">
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            className="form-input"
                                                            placeholder="Qty"
                                                            value={draft.quantityUsed}
                                                            onChange={e => updateExtraDraft(draft.id, { quantityUsed: e.target.value })}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-icon btn-ghost"
                                                        onClick={() => removeExtraDraftRow(draft.id)}
                                                        title={extraDrafts.length === 1 ? 'Clear row' : `Remove extra row ${index + 1}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-end mt-4">
                                            <button type="button" className="btn btn-primary" onClick={handleSaveExtraDrafts}>
                                                <Save size={16} /> Save Extras
                                            </button>
                                        </div>
                                    </div>

                                    <div className="recipe-list">
                                        <h3 className="text-sm font-bold mb-3 text-muted">CURRENT EXTRA OPTIONS</h3>
                                        {extraOptions.length === 0 ? (
                                            <div className="text-center p-8 border border-dashed border-white/10 rounded-lg text-muted text-sm">
                                                <Info className="mx-auto mb-2 opacity-20" size={32} />
                                                No extras linked yet. Waiters will only be able to remove items from the base recipe.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {extraOptions.map(extra => (
                                                    <div key={extra.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                                        <div>
                                                            <div className="font-bold">{extra.label}</div>
                                                            <div className="text-xs text-muted">{extra.inventory?.name} • Uses {extra.quantityUsed} {extra.inventory?.unit}</div>
                                                        </div>
                                                        <button type="button" className="btn btn-icon btn-ghost text-danger" onClick={() => handleRemoveExtra(extra.id)}>
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
                    padding: clamp(0.75rem, 3vh, 2rem);
                    overflow-y: auto;
                }
                .modal-content {
                    background: #1a1a1a;
                    padding: 2rem;
                    border-radius: 1rem;
                    border: 1px solid rgba(255,255,255,0.1);
                    width: 90%;
                    max-height: calc(100dvh - clamp(1.5rem, 6vh, 4rem));
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }
                .item-modal-content {
                    scrollbar-gutter: stable;
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
                .recipe-add-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 100px auto;
                    gap: 0.5rem;
                    align-items: stretch;
                }
                .extra-add-row {
                    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 100px auto;
                }
                .recipe-quantity-field {
                    width: 100%;
                }
                @media (max-width: 720px) {
                    .modal-content {
                        width: 100%;
                        padding: 1.25rem;
                        border-radius: 0.875rem;
                    }
                    .item-form-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .recipe-add-row {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .extra-add-row {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }
            `}</style>
        </AppLayout>
    );
}
