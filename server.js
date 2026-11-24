const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "digital-print.sqlite");
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 brand TEXT NOT NULL, model TEXT NOT NULL, description TEXT DEFAULT '',
 price_usd REAL DEFAULT 0, price_cdf REAL DEFAULT 0,
 condition TEXT DEFAULT 'Neuf', stock INTEGER DEFAULT 1,
 photos TEXT DEFAULT '[]', active INTEGER DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
 address TEXT DEFAULT '', items TEXT NOT NULL, total_usd REAL DEFAULT 0,
 total_cdf REAL DEFAULT 0, payment_method TEXT DEFAULT 'À la livraison',
 status TEXT DEFAULT 'En attente',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
 destination: (_, __, cb) => cb(null, uploadDir),
 filename: (_, file, cb) => cb(null, Date.now() + "-" + Math.random().toString(16).slice(2) + path.extname(file.originalname).toLowerCase())
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 6 },
 fileFilter: (_, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)) });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
 secret: process.env.SESSION_SECRET || "CHANGE-ME-BEFORE-PUBLISHING-32-CHARS",
 resave: false, saveUninitialized: false,
 store: new SQLiteStore({ db: "sessions.sqlite", dir: __dirname }),
 cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 86400000 }
}));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "";
if (adminEmail && adminPassword) {
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if (!exists) db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')")
    .run("Administrateur DIGITAL PRINT", adminEmail, bcrypt.hashSync(adminPassword, 12));
}
const publicUser = u => u ? ({ id:u.id, name:u.name, email:u.email, role:u.role }) : null;
const requireAuth = (req,res,next) => req.session.user ? next() : res.status(401).json({error:"Connexion requise."});
const requireAdmin = (req,res,next) => req.session.user?.role === "admin" ? next() : res.status(403).json({error:"Accès administrateur refusé."});

app.get("/api/me", (req,res) => res.json({ user: publicUser(req.session.user) }));
app.post("/api/register", (req,res) => {
 const {name,email,password} = req.body || {};
 if (!name || !email || !password || password.length < 8) return res.status(400).json({error:"Nom, e-mail et mot de passe (8 caractères minimum) obligatoires."});
 try {
  const info = db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)")
   .run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password,12));
  req.session.user = db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(info.lastInsertRowid);
  res.json({user:publicUser(req.session.user)});
 } catch(e) { res.status(409).json({error:"Cette adresse e-mail est déjà utilisée."}); }
});
app.post("/api/login", (req,res) => {
 const {email,password} = req.body || {};
 const user = db.prepare("SELECT * FROM users WHERE email=?").get(String(email||"").trim().toLowerCase());
 if (!user || !bcrypt.compareSync(password || "", user.password_hash)) return res.status(401).json({error:"E-mail ou mot de passe incorrect."});
 req.session.user = {id:user.id,name:user.name,email:user.email,role:user.role};
 res.json({user:publicUser(req.session.user)});
});
app.post("/api/logout", (req,res) => req.session.destroy(() => res.json({ok:true})));

app.get("/api/products", (_,res) => {
 const rows = db.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all();
 res.json(rows.map(p => ({...p, photos:JSON.parse(p.photos || "[]")})));
});
app.post("/api/products", requireAdmin, upload.array("photos",6), (req,res) => {
 const b=req.body, photos=(req.files||[]).map(f=>"/uploads/"+f.filename);
 if (!b.brand || !b.model) return res.status(400).json({error:"Marque et modèle obligatoires."});
 const info=db.prepare(`INSERT INTO products(brand,model,description,price_usd,price_cdf,condition,stock,photos)
 VALUES(?,?,?,?,?,?,?,?)`).run(b.brand,b.model,b.description||"",Number(b.price_usd)||0,Number(b.price_cdf)||0,b.condition||"Neuf",Math.max(0,Number(b.stock)||0),JSON.stringify(photos));
 res.json({id:info.lastInsertRowid,ok:true});
});
app.put("/api/products/:id", requireAdmin, (req,res) => {
 const b=req.body;
 const info=db.prepare(`UPDATE products SET brand=?,model=?,description=?,price_usd=?,price_cdf=?,condition=?,stock=?,active=? WHERE id=?`)
 .run(b.brand,b.model,b.description||"",Number(b.price_usd)||0,Number(b.price_cdf)||0,b.condition||"Neuf",Math.max(0,Number(b.stock)||0),b.active===false?0:1,req.params.id);
 res.json({ok:info.changes>0});
});
app.delete("/api/products/:id", requireAdmin, (req,res) => {
 const info=db.prepare("UPDATE products SET active=0 WHERE id=?").run(req.params.id);
 res.json({ok:info.changes>0});
});

app.post("/api/orders", (req,res) => {
 const {customer_name,phone,address,items,payment_method} = req.body || {};
 if (!customer_name || !phone || !Array.isArray(items) || !items.length) return res.status(400).json({error:"Veuillez indiquer votre nom, téléphone et au moins un produit."});
 let totalUsd=0,totalCdf=0,clean=[];
 for (const item of items) {
  const p=db.prepare("SELECT id,brand,model,price_usd,price_cdf,stock FROM products WHERE id=? AND active=1").get(Number(item.product_id));
  const qty=Math.max(1,Math.min(20,Number(item.quantity)||1));
  if (!p || p.stock < qty) return res.status(400).json({error:"Un produit n'est plus disponible en quantité suffisante."});
  totalUsd += p.price_usd*qty; totalCdf += p.price_cdf*qty;
  clean.push({product_id:p.id,name:p.brand+" "+p.model,quantity:qty,price_usd:p.price_usd,price_cdf:p.price_cdf});
 }
 const info=db.prepare(`INSERT INTO orders(user_id,customer_name,phone,address,items,total_usd,total_cdf,payment_method)
 VALUES(?,?,?,?,?,?,?,?)`).run(req.session.user?.id||null,customer_name,phone,address||"",JSON.stringify(clean),totalUsd,totalCdf,payment_method||"À la livraison");
 res.json({ok:true,order_id:info.lastInsertRowid});
});
app.get("/api/my-orders", requireAuth, (req,res) => {
 const rows=db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC").all(req.session.user.id);
 res.json(rows.map(o=>({...o,items:JSON.parse(o.items)})));
});
app.get("/api/admin/orders", requireAdmin, (req,res) => {
 const rows=db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all();
 res.json(rows.map(o=>({...o,items:JSON.parse(o.items)})));
});
app.patch("/api/admin/orders/:id", requireAdmin, (req,res) => {
 const allowed=["En attente","Confirmée","En préparation","Expédiée","Livrée","Annulée"];
 if (!allowed.includes(req.body.status)) return res.status(400).json({error:"Statut non valide."});
 const info=db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
 res.json({ok:info.changes>0});
});
app.get("/api/admin/stats", requireAdmin, (_,res) => {
 res.json({products:db.prepare("SELECT COUNT(*) n FROM products WHERE active=1").get().n,
 orders:db.prepare("SELECT COUNT(*) n FROM orders").get().n,
 pending:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='En attente'").get().n});
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT, () => console.log(`DIGITAL PRINT disponible sur http://localhost:${PORT}`));
