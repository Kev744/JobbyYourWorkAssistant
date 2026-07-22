import { comparePassword, hashPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('stores new passwords with bcrypt and verifies them', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(comparePassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(comparePassword('wrong password', hash)).resolves.toBe(false);
  });
});
