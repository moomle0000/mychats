import { Service } from 'typedi';
import axios from 'axios';
import { SettingModel } from './setting.model';
import { AI_API_URL } from '@config';
import { logger } from '@utils/logger';

export interface AISettingsDTO {
  aiBaseUrl: string;
  defaultModel: string;
  apiKey?: string;
}

export interface ModelOption {
  id: string;
  owned_by?: string;
  created?: number;
}

@Service()
export class SettingService {
  /**
   * Retrieves the current AI configuration.
   * If not stored in MongoDB, falls back to the environment configuration.
   */
  public async getAISettings(): Promise<AISettingsDTO> {
    const settingDoc = await SettingModel.findOne({ key: 'ai_config' }).lean().exec();
    if (settingDoc && settingDoc.value) {
      return {
        aiBaseUrl: settingDoc.value.aiBaseUrl || AI_API_URL,
        defaultModel: settingDoc.value.defaultModel || '',
        apiKey: settingDoc.value.apiKey || '',
      };
    }

    return {
      aiBaseUrl: AI_API_URL,
      defaultModel: '',
      apiKey: '',
    };
  }

  /**
   * Saves or updates the AI configuration in MongoDB.
   * Cleans trailing slashes and validates the URL format.
   */
  public async updateAISettings(data: { aiBaseUrl?: string; defaultModel?: string; apiKey?: string }): Promise<AISettingsDTO> {
    let cleanBaseUrl = data.aiBaseUrl?.trim();
    if (cleanBaseUrl) {
      // Remove trailing slash if present
      cleanBaseUrl = cleanBaseUrl.replace(/\/+$/, '');
    }

    const current = await this.getAISettings();
    const updatedValue: AISettingsDTO = {
      aiBaseUrl: cleanBaseUrl || current.aiBaseUrl,
      defaultModel: data.defaultModel !== undefined ? data.defaultModel.trim() : current.defaultModel,
      apiKey: data.apiKey !== undefined ? data.apiKey.trim() : (current.apiKey || ''),
    };

    await SettingModel.findOneAndUpdate(
      { key: 'ai_config' },
      { key: 'ai_config', value: updatedValue },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    logger.info(`[Settings] AI Config updated: baseUrl=${updatedValue.aiBaseUrl}, defaultModel=${updatedValue.defaultModel}`);
    return updatedValue;
  }

  /**
   * Fetches models directly from the provided or configured OpenAI-compatible /v1/models endpoint.
   */
  public async fetchAvailableModels(targetBaseUrl?: string, customApiKey?: string): Promise<ModelOption[]> {
    const current = await this.getAISettings();
    let baseUrl = (targetBaseUrl?.trim() || current.aiBaseUrl).replace(/\/+$/, '');
    const effectiveKey = customApiKey !== undefined ? customApiKey.trim() : (current.apiKey || '');

    // OpenAI standard endpoint is <baseUrl>/models or <baseUrl> if already ends with /models
    const modelsUrl = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (effectiveKey) {
      headers['Authorization'] = `Bearer ${effectiveKey}`;
    }

    try {
      const response = await axios.get(modelsUrl, {
        headers,
        timeout: 10000,
      });

      if (Array.isArray(response.data?.data)) {
        return response.data.data.map((m: any) => ({
          id: m.id || m.name || String(m),
          owned_by: m.owned_by,
          created: m.created,
        }));
      }

      if (Array.isArray(response.data)) {
        return response.data.map((m: any) => ({
          id: m.id || m.name || String(m),
          owned_by: m.owned_by,
          created: m.created,
        }));
      }

      return [];
    } catch (error: any) {
      logger.warn(`[Settings] Failed to fetch models from ${modelsUrl}: ${error?.message || error}`);
      throw new Error(`Failed to load models from ${modelsUrl}: ${error?.message || 'Network error'}`);
    }
  }
}
