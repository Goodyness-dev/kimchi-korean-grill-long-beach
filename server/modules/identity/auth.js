import crypto from 'node:crypto';
import { queryOne, execute } from '../../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant-production-secret-key-2026';

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function createToken(payload, expiresInHours = 12) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export function authenticateStaff(username, password) {
  const hash = hashPassword(password);
  const staff = queryOne(
    'SELECT id, tenant_id, username, role, active FROM staff_memberships WHERE username = ? AND password_hash = ? AND active = 1',
    [username.toLowerCase().trim(), hash]
  );
  if (!staff) return null;

  const token = createToken({
    staffId: staff.id,
    tenantId: staff.tenant_id,
    username: staff.username,
    role: staff.role
  });

  return { token, staff };
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Staff authentication required' });
    }
    if (!allowedRoles.includes(req.staff.role)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient role permissions' });
    }
    next();
  };
}
