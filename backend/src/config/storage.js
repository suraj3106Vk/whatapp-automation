const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const railwayDetected = Boolean(
  process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID
);
const configuredRoot = process.env.DATA_PATH || (railwayDetected ? '/data' : path.resolve(__dirname, '../../data'));
const dataPath = path.resolve(configuredRoot);
let verificationPromise;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getDataPath() { return dataPath; }
function getWhatsAppAuthPath() { return path.resolve(process.env.WHATSAPP_AUTH_PATH || path.join(dataPath, 'whatsapp-auth')); }
function getMemoryPath() { return path.resolve(process.env.MEMORY_PATH || path.join(dataPath, 'memory')); }
function getUploadsPath() { return path.resolve(process.env.UPLOADS_PATH || path.join(dataPath, 'uploads')); }
function getFilesPath() { return path.resolve(process.env.FILES_PATH || path.join(dataPath, 'files')); }
function getSchedulerPath() { return path.resolve(process.env.SCHEDULER_PATH || path.join(dataPath, 'scheduler')); }
function getDatabasePath() { return path.resolve(process.env.DATABASE_PATH || path.join(dataPath, 'database.sqlite')); }
function isRailway() { return railwayDetected; }

function validateRailwayPaths() {
  if (!railwayDetected) return;
  if (dataPath !== path.resolve('/data') || !isInside(dataPath, getWhatsAppAuthPath())) {
    throw new Error(`CRITICAL: Railway WhatsApp auth is not stored on persistent volume. Current path: ${getWhatsAppAuthPath()} Required path: /data/whatsapp-auth`);
  }
}

async function verifyPersistentStorage() {
  if (verificationPromise) return verificationPromise;
  verificationPromise = verifyPersistentStorageInternal();
  try { return await verificationPromise; } catch (error) { verificationPromise = null; throw error; }
}

async function verifyPersistentStorageInternal() {
  validateRailwayPaths();
  await fs.ensureDir(dataPath);
  const probe = path.join(dataPath, `.storage-write-test-${process.pid}-${Date.now()}`);
  await fs.writeFile(probe, `${os.hostname()}\n`, 'utf8');
  await fs.readFile(probe, 'utf8');
  await fs.remove(probe);
  await Promise.all([
    fs.ensureDir(getWhatsAppAuthPath()),
    fs.ensureDir(getMemoryPath()),
    fs.ensureDir(getUploadsPath()),
    fs.ensureDir(getFilesPath()),
    fs.ensureDir(getSchedulerPath()),
  ]);
  console.log(`[Storage] Railway detected: ${railwayDetected ? 'YES' : 'NO'}`);
  console.log(`[Storage] Persistent root: ${dataPath}`);
  console.log('[Storage] Writable: YES');
}

module.exports = {
  getDataPath,
  getWhatsAppAuthPath,
  getMemoryPath,
  getUploadsPath,
  getFilesPath,
  getSchedulerPath,
  getDatabasePath,
  isRailway,
  verifyPersistentStorage,
};