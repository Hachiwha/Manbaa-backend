import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('uses Argon2id and verifies the password', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(service.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false);
  });
});
