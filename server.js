const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4000;
const SECRET = process.env.SECRET || 'casa-sabor-secret';
const DB_FILE = path.join(__dirname, 'data.json');
const BACKUP_FILE = path.join(__dirname, 'data.backup.json');
const TMP_FILE = path.join(__dirname, 'data.tmp.json');

const uid = () => crypto.randomBytes(6).toString('hex');
const hashPw = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
};
const checkPw = (pw, stored) => {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  try { return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(crypto.scryptSync(pw, salt, 64).toString('hex'), 'hex')); }
  catch { return false; }
};
const sign = (p) => {
  const b = Buffer.from(JSON.stringify(p)).toString('base64url');
  return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
};
const verify = (t) => {
  if (!t) return null;
  const [b, s] = t.split('.');
  if (!b || !s) return null;
  if (s !== crypto.createHmac('sha256', SECRET).update(b).digest('base64url')) return null;
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()); } catch { return null; }
};

function seed() {
  const DAY = 86400000;
  let s = 42;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const users = [{ id: 'u1', name: 'Alex Morales', email: 'demo@resto.mx', password: hashPw('demo1234'), role: 'Administrador', restaurant: 'Casa Sabor' }];
  const suppliers = [
    { id: uid(), name: 'Distribuidora La Fresca', contact: 'Ramiro Avila', email: 'ventas@lafresca.mx', phone: '55 1234 5678', category: 'Verduras', address: 'CDMX', notes: '' },
    { id: uid(), name: 'Carnes Premium', contact: 'Laura Guzman', email: 'pedidos@cp.mx', phone: '81 9876 5432', category: 'Carnes', address: 'Monterrey', notes: '' },
    { id: uid(), name: 'Lacteos San Juan', contact: 'Miguel Rios', email: 'contacto@lsj.mx', phone: '55 4455 6677', category: 'Lacteos', address: 'Toluca', notes: '' },
    { id: uid(), name: 'Bebidas y Mas', contact: 'Fernanda Solis', email: 'ventas@bym.mx', phone: '55 3322 1100', category: 'Bebidas', address: 'CDMX', notes: '' },
    { id: uid(), name: 'Mariscos del Pacifico', contact: 'Ana Beltran', email: 'p@mp.mx', phone: '33 2211 4455', category: 'Mariscos', address: 'GDL', notes: '' },
  ];
  const names = ['Maria Gonzalez','Carlos Ramirez','Ana Torres','Luis Fernandez','Sofia Mendoza','Jorge Castillo','Paola Rios','Andres Vargas','Daniela Cruz','Ricardo Ortiz'];
  const customers = names.map((name, i) => ({
    id: uid(), name, email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@mail.com',
    phone: '55 ' + (1000 + i * 111) + ' ' + (2000 + i * 222), notes: '',
    createdAt: new Date(Date.now() - (180 - i * 15) * DAY).toISOString(),
  }));
  const inventory = [
    { name: 'Jitomate saladet', category: 'Verduras', quantity: 24, unit: 'kg', minStock: 10, unitCost: 32 },
    { name: 'Cebolla blanca', category: 'Verduras', quantity: 18, unit: 'kg', minStock: 8, unitCost: 26 },
    { name: 'Aguacate Hass', category: 'Verduras', quantity: 6, unit: 'kg', minStock: 10, unitCost: 85 },
    { name: 'Chile serrano', category: 'Verduras', quantity: 3, unit: 'kg', minStock: 4, unitCost: 55 },
    { name: 'Arrachera de res', category: 'Carnes', quantity: 15, unit: 'kg', minStock: 8, unitCost: 320 },
    { name: 'Pollo entero', category: 'Carnes', quantity: 20, unit: 'kg', minStock: 10, unitCost: 95 },
    { name: 'Queso Oaxaca', category: 'Lacteos', quantity: 8, unit: 'kg', minStock: 4, unitCost: 180 },
    { name: 'Tortillas de maiz', category: 'Abarrotes', quantity: 30, unit: 'kg', minStock: 15, unitCost: 24 },
    { name: 'Refresco 600ml', category: 'Bebidas', quantity: 48, unit: 'pza', minStock: 24, unitCost: 18 },
    { name: 'Cerveza artesanal', category: 'Bebidas', quantity: 24, unit: 'pza', minStock: 36, unitCost: 38 },
    { name: 'Camaron mediano', category: 'Mariscos', quantity: 7, unit: 'kg', minStock: 5, unitCost: 290 },
  ].map(i => ({ ...i, id: uid(), supplierId: suppliers[0].id }));

  const MENU = [
    { name: 'Tacos al Pastor', price: 95 }, { name: 'Enchiladas Verdes', price: 120 },
    { name: 'Chiles en Nogada', price: 185 }, { name: 'Pozole Rojo', price: 140 },
    { name: 'Mole Poblano', price: 165 }, { name: 'Carne Asada', price: 220 },
    { name: 'Camarones a la Diabla', price: 210 }, { name: 'Flan Napolitano', price: 60 },
    { name: 'Agua de Horchata', price: 35 }, { name: 'Cerveza Artesanal', price: 65 },
  ];

  const orders = [];
  for (let i = 0; i < 40; i++) {
    const daysBack = Math.floor(rnd() * 45);
    const date = new Date(Date.now() - daysBack * DAY - ri(0, 11) * 3600000);
    const cust = pick(customers);
    const items = [];
    for (let j = 0; j < ri(1, 3); j++) { const m = pick(MENU); items.push({ name: m.name, qty: ri(1, 3), price: m.price }); }
    const total = items.reduce((a, it) => a + it.qty * it.price, 0);
    let status;
    if (daysBack > 1) status = rnd() < 0.9 ? 'completada' : 'cancelada';
    else status = pick(['pendiente', 'preparando', 'listo', 'completada', 'completada']);
    orders.push({ id: uid(), code: 'ORD-' + (1042 + i), customerId: cust.id, customerName: cust.name, items, total, status,
      type: pick(['Local', 'Local', 'Para llevar', 'Domicilio']), notes: '', createdAt: date.toISOString() });
  }

  const transactions = [];
  orders.filter(o => o.status === 'completada').forEach(o => {
    transactions.push({ id: uid(), type: 'income', category: 'Ventas', amount: o.total,
      description: 'Orden ' + o.code + ' - ' + o.customerName, date: o.createdAt,
      method: pick(['Efectivo', 'Tarjeta']), orderId: o.id });
  });
  const exp = [
    { category: 'Insumos', description: 'Compra de verduras', min: 1800, max: 4200 },
    { category: 'Insumos', description: 'Pedido de carnes', min: 3500, max: 7800 },
    { category: 'Nomina', description: 'Nomina quincenal', min: 18000, max: 24000 },
    { category: 'Renta', description: 'Renta del local', min: 22000, max: 22000 },
    { category: 'Servicios', description: 'Luz, agua e internet', min: 3200, max: 6100 },
  ];
  for (let m = 0; m < 3; m++) for (let k = 0; k < 8; k++) {
    const c = exp[k % exp.length];
    transactions.push({ id: uid(), type: 'expense', category: c.category, amount: ri(c.min, c.max),
      description: c.description, date: new Date(Date.now() - (m * 30 + ri(0, 28)) * DAY).toISOString(),
      method: pick(['Transferencia', 'Efectivo']) });
  }
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { users, suppliers, customers, inventory, orders, transactions };
}

let db;
function writeAtomic(payload) {
  fs.writeFileSync(TMP_FILE, JSON.stringify(payload, null, 2));
  fs.renameSync(TMP_FILE, DB_FILE);
  try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch {}
}
function load() {
  for (const f of [DB_FILE, BACKUP_FILE]) {
    try { if (fs.existsSync(f)) { const r = fs.readFileSync(f, 'utf8'); if (r.trim()) return JSON.parse(r); } } catch {}
  }
  const s = seed(); writeAtomic(s); return s;
}
function save() { try { writeAtomic(db); } catch {} }
db = load();
setInterval(save, 30000);
process.on('SIGINT', () => { save(); process.exit(0); });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const p = verify(t);
  if (!p) return res.status(401).json({ error: 'No autorizado' });
  req.userId = p.sub; next();
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.users.find(x => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u || !checkPw(password || '', u.password)) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = sign({ sub: u.id });
  const { password: _, ...safe } = u;
  res.json({ token, user: safe });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, restaurant } = req.body || {};
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Datos incompletos' });
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Correo ya registrado' });
  const u = { id: uid(), name, email, password: hashPw(password), role: 'Administrador', restaurant: restaurant || 'Casa Sabor' };
  db.users.push(u); save();
  const { password: _, ...safe } = u;
  res.json({ token: sign({ sub: u.id }), user: safe });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.users.find(x => x.id === req.userId);
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  const { password: _, ...safe } = u;
  res.json(safe);
});

app.get('/api/dashboard', auth, (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
  const inc = db.transactions.filter(t => t.type === 'income');
  const exp = db.transactions.filter(t => t.type === 'expense');
  const sum = (a) => a.reduce((x, t) => x + Number(t.amount || 0), 0);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const n = new Date(d); n.setDate(n.getDate() + 1);
    week.push({ label: d.toLocaleDateString('es-MX', { weekday: 'short' }).slice(0, 3),
      value: sum(inc.filter(t => new Date(t.date) >= d && new Date(t.date) < n)) });
  }
  const done = db.orders.filter(o => o.status === 'completada');
  res.json({
    salesToday: sum(inc.filter(t => new Date(t.date) >= start)),
    ordersToday: db.orders.filter(o => new Date(o.createdAt) >= start).length,
    activeOrders: db.orders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status)).length,
    incomeMonth: sum(inc.filter(t => new Date(t.date) >= ms)),
    expenseMonth: sum(exp.filter(t => new Date(t.date) >= ms)),
    profitMonth: sum(inc.filter(t => new Date(t.date) >= ms)) - sum(exp.filter(t => new Date(t.date) >= ms)),
    avgTicket: done.length ? sum(done.map(o => o.total)) / done.length : 0,
    lowStock: db.inventory.filter(i => i.quantity <= i.minStock),
    week,
    recentOrders: [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
  });
});

function crud(name, prepare) {
  app.get('/api/' + name, auth, (_, res) => res.json(db[name]));
  app.post('/api/' + name, auth, (req, res) => {
    const item = { ...(prepare ? prepare(req.body) : req.body), id: uid() };
    db[name] = [item, ...db[name]]; save(); res.status(201).json(item);
  });
  app.patch('/api/' + name + '/:id', auth, (req, res) => {
    const i = db[name].findIndex(x => x.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'No encontrado' });
    db[name][i] = { ...db[name][i], ...req.body, id: db[name][i].id };
    save(); res.json(db[name][i]);
  });
  app.delete('/api/' + name + '/:id', auth, (req, res) => {
    db[name] = db[name].filter(x => x.id !== req.params.id); save(); res.json({ ok: true });
  });
}

crud('orders', b => ({ ...b, code: b.code || 'ORD-' + (1042 + db.orders.length + 1), createdAt: b.createdAt || new Date().toISOString() }));
crud('inventory');
crud('customers', b => ({ ...b, createdAt: b.createdAt || new Date().toISOString() }));
crud('suppliers');
crud('transactions');

app.listen(PORT, () => console.log('\n Casa Sabor API -> http://localhost:' + PORT + '\n   Demo: demo@resto.mx / demo1234\n'));
