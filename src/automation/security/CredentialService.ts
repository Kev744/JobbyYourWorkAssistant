export interface CredentialMetadata {
  rootDomain: string;
  label: string;
  lastUsedAt?: string;
}

export class CredentialService {
  async findByRootDomain(rootDomain: string): Promise<CredentialMetadata | null> {
    void rootDomain;
    return null;
  }
}
