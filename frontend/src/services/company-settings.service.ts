import api from './api';

/**
 * How the server describes one setting. The shape comes from the backend
 * catalog rather than a copy kept here, so adding a setting server-side makes
 * it appear in the UI without a matching frontend release — and a key can
 * never be rendered as the wrong control.
 */
export interface SettingDescriptor {
  key: string;
  type: 'boolean' | 'number' | 'enum' | 'text';
  defaultValue: string;
  min?: number;
  max?: number;
  integer?: boolean;
  /** The permitted values, for `type: 'enum'` only. */
  options?: string[];
}

class CompanySettingsService {
  async catalog(signal?: AbortSignal): Promise<SettingDescriptor[]> {
    const response = await api.get('/company-settings/catalog', { signal });
    return response.data.data;
  }

  async all(signal?: AbortSignal): Promise<Record<string, string>> {
    const response = await api.get('/company-settings', { signal });
    return response.data.data;
  }

  /** Only the keys the operator actually changed are sent. */
  async save(changes: Record<string, string>): Promise<void> {
    await api.post('/company-settings/bulk', changes);
  }
}

export const companySettingsService = new CompanySettingsService();
