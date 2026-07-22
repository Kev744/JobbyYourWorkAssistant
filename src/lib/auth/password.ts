import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePassword(password: string, rawHash: string): Promise<boolean> {
  if (!rawHash || !rawHash.startsWith('$2')) {
    return false;
  }

  return bcrypt.compare(password, rawHash);
}
