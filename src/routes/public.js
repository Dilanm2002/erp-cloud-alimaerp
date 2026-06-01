const express = require('express');
const pool = require('../config/db');

const router = express.Router();

const getCategoryFromCode = (code) => {
  if (!code) return { key: 'GEN', label: 'General', emoji: '📦', color: '#6b7280' };
  const prefix = code.split('-')[0].replace(/\d+/g, '').toUpperCase();
  const direct = {
    ACE: { label: 'Aceites',     emoji: '🫙', color: '#ca8a04' },
    BEB: { label: 'Bebidas',     emoji: '🥤', color: '#2563eb' },
    LAC: { label: 'Lácteos',     emoji: '🥛', color: '#0891b2' },
    GRA: { label: 'Granos',      emoji: '🌾', color: '#d97706' },
    ENL: { label: 'Enlatados',   emoji: '🥫', color: '#15803d' },
    CON: { label: 'Condimentos', emoji: '🧂', color: '#dc2626' },
    CAR: { label: 'Carnes',      emoji: '🥩', color: '#991b1b' },
    PES: { label: 'Mariscos',    emoji: '🐟', color: '#0e7490' },
    DUL: { label: 'Dulces',      emoji: '🍬', color: '#db2777' },
    PRD: { label: 'Variedad',    emoji: '📦', color: '#7c3aed' },
    TEC: { label: 'Electrónica', emoji: '💻', color: '#2563eb' },
    OFC: { label: 'Oficina',     emoji: '📄', color: '#7c3aed' },
    LIC: { label: 'Licores',     emoji: '🍾', color: '#4c1d95' },
    MAQ: { label: 'Maquinaria',  emoji: '⚙️', color: '#374151' },
    INS: { label: 'Insumos',     emoji: '🧴', color: '#16a34a' },
  };
  if (direct[prefix]) return { key: prefix, ...direct[prefix] };
  const longMap = {
    ACE: ['ACEITE'], GRA: ['ARROZ','AVENA','FIDEO','MAIZ','QUINUA'],
    CON: ['AZUCAR','SAL','VINAGRE','MOSTAZA'], INS: ['JABON','DETERGENTE','SHAMPOO'],
    ENL: ['ATUN','SARDINA','CONSERVA'], LAC: ['LECHE','QUESO','YOGUR'],
    BEB: ['COCA','CERVEZA','JUGO','AGUA'], TEC: ['MOUSE','TECLADO','LAPTOP','MONITOR','TONER'],
    OFC: ['SILLA','PAPEL','ESCRITORIO','ARCHIV'], LIC: ['LICOR','VINO','RON','WHISKY'],
  };
  for (const [key, prefixes] of Object.entries(longMap)) {
    if (prefixes.some(p => prefix.startsWith(p))) return { key, ...direct[key] };
  }
  return { key: 'GEN', label: 'General', emoji: '📦', color: '#6b7280' };
};

const CATEGORY_PATTERNS = {
  ACE: ['ACE%','ACEITE%'], BEB: ['BEB%','COCA%','CERVEZA%','JUGO%','AGUA%'],
  LAC: ['LAC%','LECHE%','QUESO%','YOGUR%'], GRA: ['GRA%','ARROZ%','AVENA%','FIDEO%','MAIZ%','QUINUA%'],
  ENL: ['ENL%','ATUN%','SARDINA%','CONSERVA%'], CON: ['CON%','AZUCAR%','SAL%','VINAGRE%','MOSTAZA%'],
  CAR: ['CAR%'], PES: ['PES%'], DUL: ['DUL%'], PRD: ['PRD%'],
  TEC: ['TEC%','MOUSE%','TECLADO%','LAPTOP%','MONITOR%','TONER%'],
  OFC: ['OFC%','SILLA%','PAPEL%','ESCRITORIO%','ARCHIV%'],
  LIC: ['LIC%','LICOR%','VINO%','RON%','WHISKY%'], MAQ: ['MAQ%'],
  INS: ['INS%','JABON%','DETERGENTE%','SHAMPOO%'],
};
const ALL_KNOWN_PATTERNS = Object.values(CATEGORY_PATTERNS).flat();

router.get('/productos', async (req, res) => {
  try {
    const { categoria, search, sucursal_id } = req.query;
    const sucursalId = sucursal_id ? parseInt(sucursal_id) : null;
    let query = sucursalId
      ? `SELECT ep.id_producto, ep.prd_codigo, ep.prd_descripcion, ep.prd_umventa, ep.prd_precioventa,
                COALESCE(ss.cantidad, 0) AS prd_saldoactual
         FROM erp_productos ep
         LEFT JOIN stock_sucursal ss ON ep.id_producto = ss.id_producto AND ss.id_sucursal = ${sucursalId}
         WHERE ep.estado_prd='ACT'`
      : "SELECT id_producto, prd_codigo, prd_descripcion, prd_umventa, prd_precioventa, prd_saldoactual FROM erp_productos WHERE estado_prd='ACT' AND prd_saldoactual >= 0";
    const params = [];
    if (search) { params.push(`%${search}%`); query += ` AND prd_descripcion ILIKE $${params.length}`; }
    if (categoria && categoria !== 'TODOS') {
      if (categoria === 'GEN') {
        const notClauses = ALL_KNOWN_PATTERNS.map(p => { params.push(p); return `prd_codigo NOT ILIKE $${params.length}`; });
        query += ` AND (${notClauses.join(' AND ')})`;
      } else {
        const patterns = CATEGORY_PATTERNS[categoria] || [`${categoria}%`];
        const orClauses = patterns.map(p => { params.push(p); return `prd_codigo ILIKE $${params.length}`; });
        query += ` AND (${orClauses.join(' OR ')})`;
      }
    }
    query += ' ORDER BY prd_descripcion LIMIT 60';
    const result = await pool.query(query, params);
    res.json(result.rows.map(p => ({ ...p, categoria: getCategoryFromCode(p.prd_codigo) })));
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

router.get('/categorias', async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT prd_codigo FROM erp_productos WHERE estado_prd='ACT' ORDER BY prd_codigo");
    const seen = new Set();
    const cats = [{ key: 'TODOS', label: 'Todos los Productos', emoji: '🛒', color: '#374151' }];
    result.rows.forEach(r => {
      const cat = getCategoryFromCode(r.prd_codigo);
      if (!seen.has(cat.key)) { seen.add(cat.key); cats.push(cat); }
    });
    res.json(cats);
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [prods, clientes, facturas] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM erp_productos WHERE estado_prd='ACT'"),
      pool.query("SELECT COUNT(*) as total FROM ven_clientes WHERE estado_cli='ACT'"),
      pool.query("SELECT COUNT(*) as total FROM ven_facturas WHERE estado_fac='EMI'"),
    ]);
    res.json({ productos: parseInt(prods.rows[0].total), clientes: parseInt(clientes.rows[0].total), facturas: parseInt(facturas.rows[0].total) });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

router.post('/registro', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nombre, cedula, email, telefono, provincia, direccion, password } = req.body;
    if (!nombre || !cedula || !email || !password)
      return res.status(400).json({ message: 'Nombre, cédula, email y contraseña son requeridos' });
    if (password.length < 4)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres' });
    const dupUser = await client.query("SELECT id_usuario FROM usuarios WHERE TRIM(user_cedula)=$1", [cedula.trim()]);
    if (dupUser.rows.length > 0) return res.status(409).json({ message: 'Ya existe una cuenta con esa cédula/RUC' });
    const cliRes = await client.query(
      `INSERT INTO ven_clientes (cli_razonsocial, cli_ruc, cli_email, cli_telefono, cli_provincia, cli_direccion, estado_cli, cli_fechacreacion, cli_usuario)
       VALUES ($1,$2,$3,$4,$5,$6,'ACT',NOW(),'REGISTRO_WEB') RETURNING id_cliente`,
      [nombre, cedula.trim(), email, telefono || null, provincia || null, direccion || null]
    );
    await client.query(
      `INSERT INTO usuarios (user_cedula, usu_nombrecompleto, usu_rol, estado_usu, usu_password, id_cliente)
       VALUES ($1,$2,'CLIENTE','ACT',$3,$4)`,
      [cedula.trim(), nombre, password, cliRes.rows[0].id_cliente]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Cuenta creada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: error.message || 'Error al registrar' });
  } finally {
    client.release();
  }
});

const { authMiddleware } = require('../middleware/auth');

router.get('/mis-pedidos', authMiddleware, async (req, res) => {
  try {
    if (!req.user.id_cliente) return res.status(403).json({ message: 'No es un cliente' });
    const result = await pool.query(
      `SELECT vf.id_factura, vf.fac_numero, vf.fac_fecha, vf.fac_subtotal, vf.fac_iva, vf.fac_total, vf.estado_fac
       FROM ven_facturas vf WHERE vf.id_cliente=$1 ORDER BY vf.fac_fechacreacion DESC`,
      [req.user.id_cliente]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

router.post('/comprar', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.user.id_cliente) return res.status(403).json({ message: 'Solo clientes registrados pueden comprar' });
    await client.query('BEGIN');
    const { detalle, sucursal_id } = req.body;
    const sucursalId = sucursal_id ? parseInt(sucursal_id) : 1;
    if (!detalle || detalle.length === 0) throw new Error('El carrito está vacío');

    for (const d of detalle) {
      const s = await client.query(
        `SELECT COALESCE(ss.cantidad, 0) AS saldo, ep.prd_descripcion
         FROM erp_productos ep
         LEFT JOIN stock_sucursal ss ON ep.id_producto = ss.id_producto AND ss.id_sucursal = $2
         WHERE ep.id_producto = $1`,
        [d.id_producto, sucursalId]
      );
      if (!s.rows.length || parseFloat(s.rows[0].saldo) < parseFloat(d.det_cantidad))
        throw new Error(`Stock insuficiente en esta sucursal: ${s.rows[0]?.prd_descripcion || 'producto'}`);
    }

    let subtotal = 0;
    detalle.forEach(d => { subtotal += parseFloat(d.det_cantidad) * parseFloat(d.det_preciounitario); });
    const iva = subtotal * 0.12;
    const total = subtotal + iva;

    const facRes = await client.query(
      `INSERT INTO ven_facturas (id_cliente, fac_numero, fac_fecha, fac_subtotal, fac_descuento, fac_iva, fac_total, estado_fac, fac_fechacreacion, fac_usuario, id_sucursal)
       VALUES ($1,$2,NOW(),$3,0,$4,$5,'EMI',NOW(),$6,$7) RETURNING *`,
      [req.user.id_cliente, `FAC-WEB-${Date.now()}`, subtotal, iva, total, req.user.nombre, sucursalId]
    );

    for (let i = 0; i < detalle.length; i++) {
      const d = detalle[i];
      await client.query(
        `INSERT INTO ven_facturas_det (id_factura, id_producto, det_linea, det_cantidad, det_preciounitario, det_subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
        [facRes.rows[0].id_factura, d.id_producto, i+1, d.det_cantidad, d.det_preciounitario, parseFloat(d.det_cantidad)*parseFloat(d.det_preciounitario)]
      );
      await client.query('UPDATE stock_sucursal SET cantidad = cantidad - $1 WHERE id_producto=$2 AND id_sucursal=$3', [d.det_cantidad, d.id_producto, sucursalId]);
      await client.query('UPDATE erp_productos SET prd_saldoactual = prd_saldoactual - $1 WHERE id_producto=$2', [d.det_cantidad, d.id_producto]);
    }

    await client.query('COMMIT');
    res.status(201).json({ fac_numero: facRes.rows[0].fac_numero, fac_total: total });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: error.message || 'Error al procesar compra' });
  } finally {
    client.release();
  }
});

module.exports = router;
