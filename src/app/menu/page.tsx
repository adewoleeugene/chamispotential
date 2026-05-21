'use client';
import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Edit2, Trash2, Search, Utensils, X, Save, ChefHat, Info, Flame, Tag } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { IconHint } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/patterns/form-field';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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
    const [extrasCatalog, setExtrasCatalog] = useState<Array<{ id: string; name: string; inventoryId: string; defaultQuantity: number; inventory: { id: string; name: string; unit: string } }>>([]);
    const [isExtraCatalogModalOpen, setIsExtraCatalogModalOpen] = useState(false);
    const [extraCatalogForm, setExtraCatalogForm] = useState({ name: '', inventoryId: '', defaultQuantity: '' });
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
            const [m, c, i, ex] = await Promise.all([
                fetch('/api/menu').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/categories').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/inventory').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/api/extras-catalog').then(r => r.ok ? r.json() : []).catch(() => []),
            ]);
            setItems(Array.isArray(m) ? m : []);
            setCategories(Array.isArray(c) ? c : []);
            setInventory(Array.isArray(i) ? i : Array.isArray(i?.items) ? i.items : []);
            setExtrasCatalog(Array.isArray(ex) ? ex : []);
            setLoading(false);
        } catch {
            setItems([]);
            setCategories([]);
            setInventory([]);
            setExtrasCatalog([]);
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

        // Existing items: still require at least one ingredient linked.
        if (itemForm.id) {
            if (recipeIngredients.length === 0) {
                toast('error', 'Link at least one ingredient before saving — inventory needs a recipe to track sales.');
                return;
            }
            await saveItem(false);
            return;
        }

        // New items: validate the ingredient drafts BEFORE creating anything,
        // so we never leave an orphan menu item without a recipe.
        const drafts = ingredientDrafts.filter(d => d.inventoryId.trim() || d.quantityUsed.trim());
        if (drafts.length === 0) {
            toast('error', 'Add at least one ingredient so inventory can track this dish.');
            return;
        }
        const sanitized = drafts.map(d => ({
            inventoryId: d.inventoryId.trim(),
            quantityUsed: Number(d.quantityUsed),
        }));
        if (sanitized.some(d => !d.inventoryId)) {
            toast('error', 'Pick an inventory item for every ingredient row.');
            return;
        }
        if (sanitized.some(d => !Number.isFinite(d.quantityUsed) || d.quantityUsed <= 0)) {
            toast('error', 'Enter a valid quantity for every ingredient.');
            return;
        }
        if (new Set(sanitized.map(d => d.inventoryId)).size !== sanitized.length) {
            toast('error', 'Each ingredient can only be added once.');
            return;
        }

        // Validate optional extras drafts ahead of any API call.
        const extraRaw = extraDrafts.filter(d => d.inventoryId.trim() || d.label.trim() || d.quantityUsed.trim());
        const extrasSanitized = extraRaw.map(d => ({
            inventoryId: d.inventoryId.trim(),
            label: d.label.trim(),
            quantityUsed: Number(d.quantityUsed),
        }));
        if (extrasSanitized.some(d => !d.inventoryId || !d.label)) {
            toast('error', 'Pick an extra for every extras row (or clear it).');
            return;
        }
        if (extrasSanitized.some(d => !Number.isFinite(d.quantityUsed) || d.quantityUsed <= 0)) {
            toast('error', 'Enter a valid quantity for every extra.');
            return;
        }

        // 1. Create the item.
        const savedItem = await saveItem(false);
        if (!savedItem) return;

        // 2. Attach the recipe.
        try {
            const res = await fetch(`/api/menu/${savedItem.id}/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredients: sanitized }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to save recipe');
            }
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Recipe failed to save — try again.');
            await loadRecipeIngredients(savedItem.id);
            setShowRecipeEditor(true);
            setIsItemModalOpen(true);
            return;
        }

        // 3. Attach extras (optional — only if drafts were filled in).
        if (extrasSanitized.length > 0) {
            try {
                const res = await fetch(`/api/menu/${savedItem.id}/extras`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ extras: extrasSanitized }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || 'Failed to save extras');
                }
            } catch (err) {
                toast('error', err instanceof Error ? err.message : 'Extras failed to save — item & recipe were saved.');
                await loadExtraOptions(savedItem.id);
                setShowExtrasEditor(true);
                setIsItemModalOpen(true);
                return;
            }
        }

        toast('success', `“${savedItem.name}” saved with ${sanitized.length} ingredient${sanitized.length === 1 ? '' : 's'}${extrasSanitized.length ? ` and ${extrasSanitized.length} extra${extrasSanitized.length === 1 ? '' : 's'}` : ''}.`);
        resetIngredientDrafts();
        resetExtraDrafts();
        setRecipeIngredients([]);
        setExtraOptions([]);
        setShowRecipeEditor(false);
        setShowExtrasEditor(false);
        fetchData();
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

    const handleSaveExtraCatalog = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = extraCatalogForm.name.trim();
        const inventoryId = extraCatalogForm.inventoryId;
        const defaultQuantity = Number(extraCatalogForm.defaultQuantity);

        if (!name) { toast('error', 'Give the extra a name'); return; }
        if (!inventoryId) { toast('error', 'Pick the inventory item this extra uses'); return; }
        if (!Number.isFinite(defaultQuantity) || defaultQuantity <= 0) {
            toast('error', 'Enter a quantity greater than zero');
            return;
        }

        try {
            const res = await fetch('/api/extras-catalog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, inventoryId, defaultQuantity }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                toast('error', body?.error || 'Could not create extra');
                return;
            }
            toast('success', `“${name}” added to extras`);
            setIsExtraCatalogModalOpen(false);
            setExtraCatalogForm({ name: '', inventoryId: '', defaultQuantity: '' });
            fetchData();
        } catch {
            toast('error', 'Could not create extra');
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = categoryForm.name.trim();
        if (!name) {
            toast('error', 'Give the category a name');
            return;
        }
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...categoryForm, name }),
            });
            if (res.ok) {
                toast('success', `“${name}” added to your menu`);
                setIsCategoryModalOpen(false);
                setCategoryForm({ name: '', icon: '🍽️', sortOrder: 0 });
                fetchData();
                return;
            }
            const body = await res.json().catch(() => null);
            toast('error', body?.error || 'Could not create category');
        } catch {
            toast('error', 'Could not create category');
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
        setShowRecipeEditor(true);
        setShowExtrasEditor(true);
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
            {/* Editorial header */}
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-accent)', marginBottom: 8 }}>
                        Your menu
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display), serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4 }}>
                        What you serve
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640 }}>
                        Every dish and drink your team can sell. Add ingredients to each item so inventory updates automatically.
                    </p>
                </div>
                {canManageMenu && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={() => {
                            setCategoryForm({ name: '', icon: '🍽️', sortOrder: categories.length });
                            setIsCategoryModalOpen(true);
                        }}>
                            <Plus size={16} /> Add category
                        </Button>
                        <Button variant="secondary" onClick={() => {
                            setExtraCatalogForm({ name: '', inventoryId: inventory[0]?.id || '', defaultQuantity: '' });
                            setIsExtraCatalogModalOpen(true);
                        }}>
                            <Plus size={16} /> Add extra
                        </Button>
                        <Button variant="primary" onClick={openNewItemModal}>
                            <Plus size={16} /> Add item
                        </Button>
                    </div>
                )}
            </div>

            {/* Summary stats */}
            <div className="grid-3 gap-4 mb-6">
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>Total items</span>
                        <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(180,104,51,0.14)', border: '1px solid rgba(180,104,51,0.32)', color: 'var(--text-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Utensils size={18} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 6 }}>
                        {items.length}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        Dishes and drinks on offer
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>Categories</span>
                        <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.32)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Tag size={18} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 6 }}>
                        {categories.length}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {categories.slice(0, 3).map(c => c.name).join(' · ') || 'Add a category to start'}
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>Trending now</span>
                        <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.32)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Flame size={18} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 6 }}>
                        {items.filter(i => i.isPopular).length}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        Items selling best this week
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="flex gap-4 mb-4">
                <div className="search-input flex-1">
                    <Search size={16} />
                    <input type="text" placeholder="Search by name or category…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Dish</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Tag</th>
                                <th style={{ textAlign: 'right' }}>{canManageMenu ? '' : null}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="font-bold" style={{ fontFamily: 'var(--font-display), serif', fontSize: 15, letterSpacing: '-0.01em' }}>
                                            {item.name}
                                        </div>
                                        {item.description && (
                                            <div className="text-muted text-sm truncate" style={{ maxWidth: 360 }}>{item.description}</div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                                            {item.category?.icon} {item.category?.name}
                                        </span>
                                    </td>
                                    <td className="font-bold text-success">{formatCurrency(item.price, settings.currencySymbol)}</td>
                                    <td>
                                        {item.isPopular
                                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.32)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                <Flame size={10} /> Trending
                                            </span>
                                            : <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                Standard
                                            </span>}
                                    </td>
                                    <td>
                                        {canManageMenu && (
                                            <div className="flex gap-2 justify-end">
                                                <IconHint label="Edit dish">
                                                    <Button size="icon" variant="secondary" onClick={() => openEditItemModal(item)}>
                                                        <Edit2 size={14} />
                                                    </Button>
                                                </IconHint>
                                                <IconHint label="Remove from menu">
                                                    <Button size="icon" variant="danger" onClick={() => handleDeleteItem(item.id)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </IconHint>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
                                            {search ? `Nothing matches "${search}"` : items.length === 0 ? 'No menu items yet' : 'No matches'}
                                        </div>
                                        {canManageMenu && items.length === 0 && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                Tap &quot;Add item&quot; to put your first dish on the menu.
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
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

                            {showRecipeEditor && (
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <div className="mb-6">
                                        <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                                            <ChefHat size={16} className="text-primary" /> Recipe: {selectedItem?.name || itemForm.name}
                                        </h3>
                                        <p className="text-sm text-muted">Stock will be automatically deducted when this item is ordered.</p>
                                    </div>

                                    <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
                                        <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><Plus size={14} /> Add Ingredients</h3>
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
                                        <button
                                            type="button"
                                            onClick={addIngredientDraftRow}
                                            style={{
                                                display: 'flex',
                                                width: '100%',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                marginTop: 12,
                                                padding: '12px 16px',
                                                borderRadius: 10,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                background: 'transparent',
                                                border: '1px dashed rgba(255,255,255,0.18)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.color = 'var(--brand-500)';
                                                e.currentTarget.style.borderColor = 'rgba(249,115,22,0.55)';
                                                e.currentTarget.style.background = 'rgba(249,115,22,0.05)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            <Plus size={15} /> Add ingredient
                                        </button>
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
                                        <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><Plus size={14} /> Pick extras for this dish</h3>
                                        {extrasCatalog.length === 0 ? (
                                            <div className="text-center p-6 border border-dashed border-white/10 rounded-lg text-muted text-sm">
                                                <Info className="mx-auto mb-2 opacity-30" size={28} />
                                                No extras created yet. Use <b>Add extra</b> at the top of the page to create reusable add-ons (extra cheese, extra shot, side fries…).
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col gap-3">
                                                    {extraDrafts.map((draft, index) => {
                                                        const linkedCatalog = extrasCatalog.find(c => c.inventoryId === draft.inventoryId && c.name === draft.label);
                                                        return (
                                                            <div key={draft.id} className="recipe-add-row extra-add-row">
                                                                <select
                                                                    className="form-input"
                                                                    value={linkedCatalog?.id || ''}
                                                                    onChange={e => {
                                                                        const picked = extrasCatalog.find(c => c.id === e.target.value);
                                                                        if (picked) {
                                                                            updateExtraDraft(draft.id, {
                                                                                inventoryId: picked.inventoryId,
                                                                                label: picked.name,
                                                                                quantityUsed: String(picked.defaultQuantity),
                                                                            });
                                                                        } else {
                                                                            updateExtraDraft(draft.id, { inventoryId: '', label: '', quantityUsed: '' });
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Select an extra…</option>
                                                                    {extrasCatalog.map(c => (
                                                                        <option key={c.id} value={c.id}>
                                                                            {c.name} — {c.inventory.name} ({c.defaultQuantity} {c.inventory.unit})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <div className="recipe-quantity-field">
                                                                    <input
                                                                        type="number"
                                                                        step="0.001"
                                                                        className="form-input"
                                                                        placeholder="Qty"
                                                                        value={draft.quantityUsed}
                                                                        onChange={e => updateExtraDraft(draft.id, { quantityUsed: e.target.value })}
                                                                        title="Override the default quantity for this dish (optional)"
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
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addExtraDraftRow}
                                                    style={{
                                                        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
                                                        gap: 8, marginTop: 12, padding: '12px 16px', borderRadius: 10,
                                                        fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
                                                        background: 'transparent', border: '1px dashed rgba(255,255,255,0.18)', cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.color = 'var(--brand-500)';
                                                        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.55)';
                                                        e.currentTarget.style.background = 'rgba(249,115,22,0.05)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.color = 'var(--text-muted)';
                                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                                                        e.currentTarget.style.background = 'transparent';
                                                    }}
                                                >
                                                    <Plus size={15} /> Add another extra
                                                </button>
                                                <div className="flex justify-end mt-4">
                                                    <button type="button" className="btn btn-primary" onClick={handleSaveExtraDrafts}>
                                                        <Save size={16} /> Save Extras
                                                    </button>
                                                </div>
                                            </>
                                        )}
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
                                <button type="submit" className="btn btn-primary flex-1">
                                    <Save size={16} /> {itemForm.id ? 'Save item' : 'Save item & recipe'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Dialog */}
            <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
                <DialogContent style={{ maxWidth: 560 }}>
                    {/* Hero with live preview chip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8 }}>
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 18,
                                background: 'var(--gradient-brand)',
                                color: '#fffaf4',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 28,
                                boxShadow: 'var(--shadow-brand)',
                                flexShrink: 0,
                            }}
                        >
                            {categoryForm.icon || '🍽️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <DialogTitle asChild>
                                <h2
                                    style={{
                                        fontFamily: 'var(--font-display), serif',
                                        fontSize: 26,
                                        fontWeight: 700,
                                        letterSpacing: '-0.03em',
                                        lineHeight: 1.1,
                                        color: 'var(--text-primary)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {categoryForm.name.trim() || 'Add a category'}
                                </h2>
                            </DialogTitle>
                            <DialogDescription style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Group dishes on the menu. Pick a name and an emoji that fits.
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <FormField label="Emoji" htmlFor="cat-icon" className="shrink-0">
                                <Input
                                    id="cat-icon"
                                    value={categoryForm.icon}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        const glyphs = Array.from(new Intl.Segmenter().segment(raw), s => s.segment);
                                        setCategoryForm({ ...categoryForm, icon: glyphs.slice(-1).join('') || raw });
                                    }}
                                    style={{ fontSize: 22, textAlign: 'center', width: 64, paddingLeft: 8, paddingRight: 8, lineHeight: 1.2 }}
                                />
                            </FormField>
                            <FormField label="Name" htmlFor="cat-name" className="flex-1">
                                <Input
                                    id="cat-name"
                                    required
                                    value={categoryForm.name}
                                    onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="Mains, Burgers, Drinks…"
                                    autoFocus
                                />
                            </FormField>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                            Tip — open your emoji picker with <b style={{ color: 'var(--text-secondary)' }}>⌘ Ctrl Space</b> (Mac) or <b style={{ color: 'var(--text-secondary)' }}>Win + .</b> (Windows).
                        </p>

                        <DialogFooter style={{ paddingTop: 8, gap: 8 }}>
                            <Button type="button" variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" disabled={!categoryForm.name.trim()}>
                                <Plus size={16} /> Create category
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Extra Catalog Dialog */}
            <Dialog open={isExtraCatalogModalOpen} onOpenChange={setIsExtraCatalogModalOpen}>
                <DialogContent style={{ maxWidth: 560 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--gradient-brand)', color: '#fffaf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: 'var(--shadow-brand)', flexShrink: 0 }}>
                            +
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <DialogTitle asChild>
                                <h2 style={{ fontFamily: 'var(--font-display), serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 6 }}>
                                    {extraCatalogForm.name.trim() || 'Add an extra'}
                                </h2>
                            </DialogTitle>
                            <DialogDescription style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                A reusable add-on (extra cheese, extra shot, side of fries…) that any dish can offer. Waiters pick from this list at order time.
                            </DialogDescription>
                        </div>
                    </div>

                    <form onSubmit={handleSaveExtraCatalog} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
                        <FormField label="What waiters see" htmlFor="extra-name">
                            <Input
                                id="extra-name"
                                required
                                value={extraCatalogForm.name}
                                onChange={e => setExtraCatalogForm({ ...extraCatalogForm, name: e.target.value })}
                                placeholder="Extra cheese, Extra shot, Side fries…"
                                autoFocus
                            />
                        </FormField>

                        <FormField label="Inventory item it uses" htmlFor="extra-inv" description="Stock deducts from this item when the extra is applied.">
                            <select
                                id="extra-inv"
                                className="form-input"
                                value={extraCatalogForm.inventoryId}
                                onChange={e => setExtraCatalogForm({ ...extraCatalogForm, inventoryId: e.target.value })}
                                required
                            >
                                <option value="">Select inventory item…</option>
                                {inventory.map(inv => (
                                    <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Quantity used per extra" htmlFor="extra-qty" description="How much stock one application of this extra consumes.">
                            <Input
                                id="extra-qty"
                                type="number"
                                step="0.001"
                                required
                                value={extraCatalogForm.defaultQuantity}
                                onChange={e => setExtraCatalogForm({ ...extraCatalogForm, defaultQuantity: e.target.value })}
                                placeholder="e.g. 0.05"
                            />
                        </FormField>

                        <DialogFooter style={{ paddingTop: 8, gap: 8 }}>
                            <Button type="button" variant="ghost" onClick={() => setIsExtraCatalogModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={!extraCatalogForm.name.trim() || !extraCatalogForm.inventoryId || !extraCatalogForm.defaultQuantity}
                            >
                                <Plus size={16} /> Create extra
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
