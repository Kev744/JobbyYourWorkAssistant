export class SecretVaultUnavailableError extends Error {
  constructor() {
    super('Encrypted credential storage is not configured yet.');
    this.name = 'SecretVaultUnavailableError';
  }
}

export class SecretVault {
  async encrypt(value: string): Promise<string> {
    void value;
    throw new SecretVaultUnavailableError();
  }

  async decrypt(value: string): Promise<string> {
    void value;
    throw new SecretVaultUnavailableError();
  }
}
