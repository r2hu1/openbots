export type Connection = {
  id: string;
  provider: string;
  externalAccountId: string;
  status: string;
  createdAt: string;
};

export interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accountId: string;
}
