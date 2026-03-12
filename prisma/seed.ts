// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv/config');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding database...');
    console.log('Using DB URL from DATABASE_URL');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    await prisma.user.upsert({
        where: { email: 'admin@rms.com' },
        update: {},
        create: { email: 'admin@rms.com', name: 'Admin User', password: adminPassword, role: 'admin' },
    });

    // Create manager
    const managerPassword = await bcrypt.hash('manager123', 12);
    await prisma.user.upsert({
        where: { email: 'manager@rms.com' },
        update: {},
        create: { email: 'manager@rms.com', name: 'Sarah Manager', password: managerPassword, role: 'manager' },
    });

    // Create kitchen staff
    const kitchenPassword = await bcrypt.hash('kitchen123', 12);
    await prisma.user.upsert({
        where: { email: 'kitchen@rms.com' },
        update: {},
        create: { email: 'kitchen@rms.com', name: 'Chef Marcus', password: kitchenPassword, role: 'kitchen' },
    });

    // Create cashier
    const cashierPassword = await bcrypt.hash('cashier123', 12);
    await prisma.user.upsert({
        where: { email: 'cashier@rms.com' },
        update: {},
        create: { email: 'cashier@rms.com', name: 'Emma Cashier', password: cashierPassword, role: 'cashier' },
    });

    // Create categories
    const categories = [
        { name: 'Starters', color: '#FF6B6B', icon: '🥗', sortOrder: 1 },
        { name: 'Mains', color: '#4ECDC4', icon: '🍽️', sortOrder: 2 },
        { name: 'Burgers', color: '#FFE66D', icon: '🍔', sortOrder: 3 },
        { name: 'Pizza', color: '#FF6B35', icon: '🍕', sortOrder: 4 },
        { name: 'Pasta', color: '#A8E6CF', icon: '🍝', sortOrder: 5 },
        { name: 'Desserts', color: '#FF8B94', icon: '🍰', sortOrder: 6 },
        { name: 'Beverages', color: '#B4F8C8', icon: '🥤', sortOrder: 7 },
        { name: 'Cocktails', color: '#FBE7C6', icon: '🍹', sortOrder: 8 },
    ];

    const createdCategories = [];
    for (const cat of categories) {
        const c = await prisma.category.upsert({
            where: { id: cat.name.toLowerCase().replace(/\s/g, '-') },
            update: {},
            create: { ...cat, id: cat.name.toLowerCase().replace(/\s/g, '-') },
        });
        createdCategories.push(c);
    }

    const catMap: Record<string, string> = Object.fromEntries(createdCategories.map((c: { name: string; id: string }) => [c.name, c.id]));

    // Create menu items
    const menuItems = [
        { name: 'Caesar Salad', description: 'Crispy romaine, parmesan, croutons, house-made Caesar dressing', price: 1, cost: 1, categoryId: catMap['Starters'], isPopular: true, calories: 320, prepTime: 5 },
        { name: 'Bruschetta Al Pomodoro', description: 'Toasted ciabatta, fresh tomatoes, basil, extra virgin olive oil', price: 2, cost: 1, categoryId: catMap['Starters'], calories: 210, prepTime: 5 },
        { name: 'Garlic Prawns', description: 'Sauteed tiger prawns in garlic butter and white wine', price: 3, cost: 2, categoryId: catMap['Starters'], isPopular: true, calories: 290, prepTime: 8 },
        { name: 'Chicken Wings', description: '12 crispy wings: BBQ, buffalo, or honey garlic', price: 4, cost: 2, categoryId: catMap['Starters'], calories: 580, prepTime: 12 },
        { name: 'Soup of the Day', description: "Chef's daily creation with artisan bread", price: 5, cost: 1, categoryId: catMap['Starters'], calories: 180, prepTime: 5 },
        { name: 'Grilled Salmon', description: 'Atlantic salmon fillet, lemon butter sauce, seasonal vegetables', price: 8, cost: 4, categoryId: catMap['Mains'], isPopular: true, calories: 520, prepTime: 15 },
        { name: 'Beef Tenderloin', description: '8oz premium cut, truffle jus, roasted vegetables', price: 12, cost: 6, categoryId: catMap['Mains'], calories: 680, prepTime: 20 },
        { name: 'Chicken Marsala', description: 'Pan-seared chicken breast, mushroom marsala sauce', price: 7, cost: 3, categoryId: catMap['Mains'], calories: 490, prepTime: 18 },
        { name: 'Vegetable Curry', description: 'Seasonal vegetables in aromatic yellow curry, basmati rice', price: 6, cost: 2, categoryId: catMap['Mains'], calories: 420, prepTime: 15 },
        { name: 'Classic Smash Burger', description: 'Double smash patty, American cheese, lettuce, tomato, pickles', price: 6, cost: 2, categoryId: catMap['Burgers'], isPopular: true, calories: 750, prepTime: 10 },
        { name: 'Truffle Mushroom Burger', description: 'Wagyu beef, truffle aioli, caramelised onions, gruyere', price: 8, cost: 3, categoryId: catMap['Burgers'], calories: 820, prepTime: 12 },
        { name: 'Crispy Chicken Burger', description: 'Southern fried chicken thigh, coleslaw, pickles, sriracha mayo', price: 7, cost: 3, categoryId: catMap['Burgers'], calories: 690, prepTime: 12 },
        { name: 'Margherita', description: 'San Marzano tomato, fresh mozzarella, basil, EVOO', price: 6, cost: 2, categoryId: catMap['Pizza'], calories: 820, prepTime: 12 },
        { name: 'Pepperoni Feast', description: 'Triple pepperoni, mozzarella, tomato sauce, oregano', price: 7, cost: 3, categoryId: catMap['Pizza'], isPopular: true, calories: 980, prepTime: 12 },
        { name: 'BBQ Chicken Pizza', description: 'BBQ sauce, grilled chicken, red onion, cheddar', price: 8, cost: 3, categoryId: catMap['Pizza'], calories: 910, prepTime: 12 },
        { name: 'Spaghetti Carbonara', description: 'Guanciale, egg yolk, pecorino romano, black pepper', price: 6, cost: 2, categoryId: catMap['Pasta'], isPopular: true, calories: 720, prepTime: 12 },
        { name: 'Fettuccine Alfredo', description: 'Silky parmesan cream sauce, fresh fettuccine, truffle oil', price: 5, cost: 2, categoryId: catMap['Pasta'], calories: 650, prepTime: 10 },
        { name: 'Penne Arrabbiata', description: 'Spicy tomato sauce, garlic, chilli, fresh herbs', price: 4, cost: 2, categoryId: catMap['Pasta'], calories: 560, prepTime: 10 },
        { name: 'Tiramisu', description: 'Classic Italian recipe, mascarpone, espresso, ladyfingers', price: 3, cost: 1, categoryId: catMap['Desserts'], isPopular: true, calories: 380, prepTime: 3 },
        { name: 'Creme Brulee', description: 'Vanilla bean custard, caramelised sugar crust, fresh berries', price: 4, cost: 1, categoryId: catMap['Desserts'], calories: 320, prepTime: 3 },
        { name: 'Chocolate Lava Cake', description: 'Warm dark chocolate cake, vanilla ice cream, raspberry coulis', price: 5, cost: 2, categoryId: catMap['Desserts'], isPopular: true, calories: 520, prepTime: 10 },
        { name: 'Fresh Orange Juice', description: 'Freshly squeezed Valencia oranges', price: 2, cost: 1, categoryId: catMap['Beverages'], calories: 110, prepTime: 2 },
        { name: 'Sparkling Water', description: 'San Pellegrino 500ml', price: 1, cost: 1, categoryId: catMap['Beverages'], calories: 0, prepTime: 1 },
        { name: 'Soft Drink', description: 'Coca-Cola, Sprite, or Fanta', price: 1, cost: 1, categoryId: catMap['Beverages'], calories: 140, prepTime: 1 },
        { name: 'Specialty Coffee', description: 'Espresso, Cappuccino, Latte, Flat White', price: 2, cost: 1, categoryId: catMap['Beverages'], isPopular: true, calories: 80, prepTime: 3 },
        { name: 'Classic Mojito', description: 'White rum, fresh mint, lime, sugar, soda', price: 4, cost: 2, categoryId: catMap['Cocktails'], isPopular: true, calories: 180, prepTime: 4 },
        { name: 'Espresso Martini', description: 'Vodka, coffee liqueur, fresh espresso, vanilla', price: 5, cost: 2, categoryId: catMap['Cocktails'], calories: 210, prepTime: 4 },
        { name: 'Aperol Spritz', description: 'Aperol, prosecco, orange slice', price: 4, cost: 1, categoryId: catMap['Cocktails'], calories: 160, prepTime: 3 },
    ];

    for (const item of menuItems) {
        const itemId = item.name.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '');
        await prisma.menuItem.upsert({
            where: { id: itemId },
            update: item,
            create: { ...item, id: itemId },
        });
    }

    // Create tables — names match the Figma floor plan design
    const tables = [
        { number: 1, capacity: 4, section: 'Bo', status: 'occupied' },
        { number: 2, capacity: 4, section: 'Kenema', status: 'occupied' },
        { number: 3, capacity: 4, section: 'Waterloo', status: 'available' },
        { number: 4, capacity: 4, section: 'Bonthe', status: 'occupied' },
        { number: 5, capacity: 8, section: 'Freetown', status: 'occupied' },
        { number: 6, capacity: 6, section: 'Makeni', status: 'occupied' },
        { number: 7, capacity: 4, section: 'Koidu', status: 'occupied' },
        { number: 8, capacity: 4, section: 'Moyamba', status: 'occupied' },
        { number: 9, capacity: 4, section: 'Lunsar', status: 'occupied' },
        { number: 10, capacity: 6, section: 'Port Loko', status: 'occupied' },
        { number: 11, capacity: 6, section: 'Kabala', status: 'available' },
        { number: 12, capacity: 4, section: 'Mile 91', status: 'available' },
    ];

    for (const table of tables) {
        await prisma.table.upsert({
            where: { number: table.number },
            update: { section: table.section, capacity: table.capacity },
            create: table
        });
    }

    // Create inventory
    const inventory = [
        { name: 'Chicken Breast', category: 'Meat', unit: 'kg', currentStock: 25, minStock: 10, maxStock: 50, cost: 8.99, supplier: 'Fresh Farms Co.' },
        { name: 'Beef Mince', category: 'Meat', unit: 'kg', currentStock: 12, minStock: 8, maxStock: 30, cost: 12.50, supplier: 'Premium Meats' },
        { name: 'Atlantic Salmon', category: 'Seafood', unit: 'kg', currentStock: 8, minStock: 5, maxStock: 20, cost: 22.00, supplier: 'Ocean Fresh' },
        { name: 'Pasta Spaghetti', category: 'Dry Goods', unit: 'kg', currentStock: 30, minStock: 10, maxStock: 60, cost: 2.50, supplier: 'Italian Imports' },
        { name: 'Mozzarella', category: 'Dairy', unit: 'kg', currentStock: 8, minStock: 4, maxStock: 20, cost: 15.00, supplier: 'Local Dairy' },
        { name: 'Heavy Cream', category: 'Dairy', unit: 'L', currentStock: 12, minStock: 5, maxStock: 25, cost: 4.50, supplier: 'Local Dairy' },
        { name: 'Roma Tomatoes', category: 'Produce', unit: 'kg', currentStock: 20, minStock: 8, maxStock: 40, cost: 3.50, supplier: 'Veggie World' },
        { name: 'Fresh Basil', category: 'Herbs', unit: 'bunch', currentStock: 3, minStock: 5, maxStock: 15, cost: 2.00, supplier: 'Herb Garden' },
        { name: 'Extra Virgin Olive Oil', category: 'Oils', unit: 'L', currentStock: 10, minStock: 4, maxStock: 20, cost: 18.00, supplier: 'Mediterranean' },
        { name: 'Red Wine', category: 'Beverages', unit: 'bottle', currentStock: 24, minStock: 12, maxStock: 48, cost: 14.00, supplier: 'Wine Merchants' },
        { name: 'Prosecco', category: 'Beverages', unit: 'bottle', currentStock: 18, minStock: 10, maxStock: 36, cost: 12.00, supplier: 'Wine Merchants' },
        { name: 'Eggs', category: 'Dairy', unit: 'dozen', currentStock: 10, minStock: 4, maxStock: 20, cost: 4.00, supplier: 'Local Farm' },
        { name: 'All Purpose Flour', category: 'Dry Goods', unit: 'kg', currentStock: 40, minStock: 15, maxStock: 80, cost: 1.80, supplier: 'Bulk Foods' },
        { name: 'Sugar', category: 'Dry Goods', unit: 'kg', currentStock: 20, minStock: 8, maxStock: 40, cost: 1.20, supplier: 'Bulk Foods' },
        { name: 'Tiger Prawns', category: 'Seafood', unit: 'kg', currentStock: 4, minStock: 3, maxStock: 15, cost: 28.00, supplier: 'Ocean Fresh' },
    ];

    for (const item of inventory) {
        const itemId = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        await prisma.inventory.upsert({ where: { id: itemId }, update: {}, create: { ...item, id: itemId } });
    }

    // Create reservations
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 2);
    futureDate1.setHours(19, 0, 0, 0);

    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 1);
    futureDate2.setHours(20, 30, 0, 0);

    await prisma.reservation.create({ data: { customerName: 'James Wilson', customerEmail: 'james@example.com', customerPhone: '+1-555-0101', partySize: 4, date: futureDate1, status: 'confirmed', notes: 'Anniversary dinner' } }).catch(() => { });
    await prisma.reservation.create({ data: { customerName: 'Emily Chen', customerEmail: 'emily@example.com', customerPhone: '+1-555-0102', partySize: 2, date: futureDate2, status: 'confirmed' } }).catch(() => { });

    console.log('\n✅ Seeding complete!');
    console.log('\nDemo accounts:');
    console.log('  Admin:   admin@rms.com / admin123');
    console.log('  Manager: manager@rms.com / manager123');
    console.log('  Kitchen: kitchen@rms.com / kitchen123');
    console.log('  Cashier: cashier@rms.com / cashier123');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
