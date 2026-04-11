import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { getRuntimeBootstrapConfig } from './runtimeConfigService';

const getDbKey = (): Buffer => {
  const vaultConfig = getRuntimeBootstrapConfig().vault;
  return pbkdf2Sync(
    vaultConfig.archivePassword,
    vaultConfig.archiveSalt,
    vaultConfig.kdfIterations,
    32,
    'sha256'
  );
};

export const encryptSqliteBuffer = async (buffer: Uint8Array): Promise<Buffer> => {
  const key = getDbKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(buffer)),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: [IV (12)] + [AuthTag (16)] + [Ciphertext]
  return Buffer.concat([iv, authTag, encrypted]);
};

export const decryptSqliteBuffer = async (protectedBuffer: Buffer): Promise<Uint8Array> => {
  if (protectedBuffer.length < 28) {
    throw new Error('Buffer too small to contain valid encrypted payload');
  }

  const key = getDbKey();
  const iv = protectedBuffer.subarray(0, 12);
  const authTag = protectedBuffer.subarray(12, 28);
  const ciphertext = protectedBuffer.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return new Uint8Array(decrypted);
};
