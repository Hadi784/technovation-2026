import path from 'node:path';
import { isIPv4 } from 'node:net';

export function readConfig(env = process.env) {
  const origin = new URL(env.PUBLIC_ORIGIN || 'http://localhost:3000');
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 3000);
  if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL before starting TECHNOVATION.');
  if (!/^[a-f0-9]{64}$/i.test(env.APP_SECRET || '')) {
    throw new Error('Set APP_SECRET to 32 random bytes encoded as 64 hexadecimal characters.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Set PORT to a valid TCP port.');
  if (!/^https?:$/.test(origin.protocol) || origin.href !== `${origin.origin}/` || origin.username || origin.password) {
    throw new Error('Set PUBLIC_ORIGIN to the external HTTP or HTTPS origin without a path.');
  }
  if (production && origin.protocol !== 'https:') throw new Error('Production requires an HTTPS PUBLIC_ORIGIN.');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) throw new Error('TRUST_PROXY must be a nonnegative hop count.');
  const lanHost = env.LAN_QR_HOST || '';
  if (lanHost && (production || !isIPv4(lanHost) || lanHost === '0.0.0.0' || lanHost.startsWith('127.'))) {
    throw new Error('LAN_QR_HOST must be a specific non-loopback IPv4 address in development.');
  }
  const publicQrOrigin = env.QR_PUBLIC_ORIGIN ? new URL(env.QR_PUBLIC_ORIGIN) : null;
  if (publicQrOrigin && (publicQrOrigin.protocol !== 'https:' || publicQrOrigin.href !== `${publicQrOrigin.origin}/`)) {
    throw new Error('Set QR_PUBLIC_ORIGIN to an HTTPS origin without credentials or a path.');
  }
  return {
    port,
    host: env.HOST || '127.0.0.1',
    production,
    origin: origin.origin,
    lanHost,
    qrOrigin: publicQrOrigin?.origin ?? (lanHost ? `http://${lanHost}:${port}` : origin.origin),
    secureCookies: origin.protocol === 'https:',
    secret: Buffer.from(env.APP_SECRET, 'hex'),
    trustProxy,
    uploadDirectory: path.resolve(env.UPLOAD_DIRECTORY || './data/uploads'),
  };
}
