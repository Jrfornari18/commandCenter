const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token de acesso requerido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.full_name, u.avatar_initials, u.is_active,
              r.name as role_name, r.label as role_label, r.level as role_level
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE`, [decoded.userId]);
    if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sessão expirada' });
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = { authenticate };
