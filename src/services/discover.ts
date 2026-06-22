import {
  type CategoryItem,
  type CategoryListQuery,
  type PluginManifest,
} from '@lobehub/market-sdk';
import {
  type AgentEventRequest,
  type CallReportRequest,
  type InstallReportRequest,
  type PluginEventRequest,
} from '@lobehub/market-types';
import type { Json } from 'prest-js-sdk/lobehub';

import { getLobehubQueryClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';
import {
  type AssistantListResponse,
  type AssistantMarketSource,
  type AssistantQueryParams,
  type DiscoverAssistantDetail,
  type DiscoverAssistantItem,
  type DiscoverMcpDetail,
  type DiscoverModelDetail,
  type DiscoverModelItem,
  type DiscoverPluginDetail,
  type DiscoverProviderDetail,
  type DiscoverProviderItem,
  type DiscoverSkillDetail,
  type DiscoverUserProfile,
  type GroupAgentQueryParams,
  type IdentifiersResponse,
  type McpListResponse,
  type McpQueryParams,
  type ModelListResponse,
  type ModelQueryParams,
  type PluginListResponse,
  type PluginQueryParams,
  type ProviderListResponse,
  type ProviderQueryParams,
  type SkillCategoryItem,
  type SkillListResponse,
  type SkillQueryParams,
} from '@/types/discover';
import { type MCPPluginListParams } from '@/types/plugins';
import { cleanObject } from '@/utils/object';

// ─── SQL query row types (match exact SELECT columns in each .sql file) ───

interface MarketAssistantListRow {
  avatar: string | null;
  category: string | null;
  createdAt: string;
  description: string | null;
  identifier: string;
  tags: Json;
  title: string | null;
}

interface MarketAssistantDetailRow extends MarketAssistantListRow {
  chatConfig: Json;
  config: Json;
  model: string | null;
  openingMessage: string | null;
  openingQuestions: string[] | null;
  provider: string | null;
  systemRole: string | null;
}

interface MarketAssistantCategoriesRow {
  count: number;
  tag: string;
}

interface MarketAssistantIdentifiersRow {
  identifier: string;
  title: string | null;
  updatedAt: string;
}

interface MarketModelListRow {
  abilities: Json;
  contextWindowTokens: number | null;
  createdAt: string;
  description: string | null;
  displayName: string | null;
  enabled: boolean | null;
  id: string;
  organization: string | null;
  parameters: Json;
  pricing: Json;
  providerId: string;
  releasedAt: string | null;
  sort: number | null;
  source: string | null;
  type: string;
}

interface MarketModelDetailRow extends MarketModelListRow {
  config: Json;
  settings: Json;
}

interface MarketProviderListRow {
  checkModel: string | null;
  config: Json;
  createdAt: string;
  description: string | null;
  enabled: boolean | null;
  fetchOnClient: boolean | null;
  id: string;
  logo: string | null;
  name: string | null;
  settings: Json;
  sort: number | null;
  source: string | null;
}

interface MarketProviderDetailRow extends Omit<MarketProviderListRow, 'sort'> {
  keyVaults: string | null;
}

// ─── Row → FE type mappers (prest stored queries → discover types) ────────

function mapAssistantRow(row: MarketAssistantListRow): DiscoverAssistantItem {
  return {
    author: '',
    avatar: row.avatar ?? undefined,
    category: row.category ?? undefined,
    createdAt: row.createdAt,
    description: row.description ?? '',
    homepage: '',
    identifier: row.identifier,
    knowledgeCount: 0,
    pluginCount: 0,
    plugins: [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    title: row.title ?? '',
    tokenUsage: 0,
  } as any;
}

function mapAssistantDetail(row: MarketAssistantDetailRow): DiscoverAssistantDetail {
  return {
    ...mapAssistantRow(row),
    chatConfig: row.chatConfig ?? undefined,
    config: row.config ?? undefined,
    examples: [],
    model: row.model ?? undefined,
    openingMessage: row.openingMessage ?? undefined,
    openingQuestions: row.openingQuestions ?? undefined,
    provider: row.provider ?? undefined,
    related: [],
    systemRole: row.systemRole ?? '',
  } as any;
}

function mapModelRow(row: MarketModelListRow): DiscoverModelItem {
  return {
    abilities: row.abilities ?? undefined,
    contextWindowTokens: row.contextWindowTokens ?? undefined,
    description: row.description ?? undefined,
    displayName: row.displayName ?? row.id,
    enabled: row.enabled ?? true,
    id: row.id,
    identifier: row.id,
    organization: row.organization ?? undefined,
    pricing: row.pricing ?? undefined,
    providerCount: 1,
    providerId: row.providerId ?? undefined,
    providers: row.providerId ? [row.providerId] : [],
    releasedAt: row.releasedAt ?? undefined,
    source: row.source ?? undefined,
    type: row.type ?? undefined,
  } as any;
}

function mapModelDetail(row: MarketModelDetailRow): DiscoverModelDetail {
  return {
    ...mapModelRow(row),
    config: row.config ?? undefined,
    maxOutput: (row.parameters as Record<string, any> | null)?.max_output ?? undefined,
    providers: [],
    related: [],
    settings: row.settings ?? undefined,
  } as any;
}

function mapProviderRow(row: MarketProviderListRow): DiscoverProviderItem {
  return {
    checkModel: row.checkModel ?? undefined,
    config: row.config ?? undefined,
    description: row.description ?? undefined,
    enabled: row.enabled ?? true,
    fetchOnClient: row.fetchOnClient ?? undefined,
    id: row.id,
    identifier: row.id,
    logo: row.logo ?? undefined,
    modelCount: 0,
    models: [],
    name: row.name ?? '',
    settings: row.settings ?? undefined,
    source: row.source ?? undefined,
  } as any;
}

function mapProviderDetail(row: MarketProviderDetailRow): DiscoverProviderDetail {
  return {
    ...mapProviderRow(row),
    keyVaults: row.keyVaults ?? undefined,
    models: [],
    readme: undefined,
    related: [],
  } as any;
}

class DiscoverService {
  private _isRetrying = false;
  private _tokenRefreshPromise: Promise<void> | null = null;

  private isMarketTrustedClientEnabled = (): boolean => {
    if (typeof window === 'undefined' || !window.global_serverConfigStore) return false;
    try {
      const state = window.global_serverConfigStore.getState();
      return state.serverConfig.enableMarketTrustedClient || false;
    } catch {
      return false;
    }
  };

  safeInjectMPToken = async () => {
    // If trusted client is enabled, authentication is handled by backend
    // No need to inject M2M token from client side
    if (this.isMarketTrustedClientEnabled()) return;

    try {
      await this.injectMPToken();
    } catch (error) {
      // Log error but don't block the request
      console.warn('Failed to inject MP token, continuing without it:', error);
    }
  };

  // ============================== Assistant Market ==============================
  getAssistantCategories = async (
    params: CategoryListQuery & { source?: AssistantMarketSource } = {},
  ): Promise<CategoryItem[]> => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<MarketAssistantCategoriesRow>(
      'lobehub',
      'marketAssistantCategories',
      {},
    );
    return rows.map((r) => ({ category: r.tag, count: r.count }));
  };

  getAssistantDetail = async (params: {
    identifier: string;
    locale?: string;
    source?: AssistantMarketSource;
    version?: string;
  }): Promise<DiscoverAssistantDetail | undefined> => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<MarketAssistantDetailRow>('lobehub', 'marketAssistantDetail', {
      identifier: params.identifier,
    });
    if (!rows.length) return undefined;
    return mapAssistantDetail(rows[0]);
  };

  getAssistantIdentifiers = async (
    params: { source?: AssistantMarketSource } = {},
  ): Promise<IdentifiersResponse> => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<MarketAssistantIdentifiersRow>(
      'lobehub',
      'marketAssistantIdentifiers',
      {},
    );
    return rows.map((r) => ({ identifier: r.identifier, lastModified: r.updatedAt }));
  };

  getAssistantList = async (params: AssistantQueryParams = {}): Promise<AssistantListResponse> => {
    const db = await getLobehubQueryClient();
    const page = params.page ? Number(params.page) : 1;
    const pageSize = params.pageSize ? Number(params.pageSize) : 20;
    const offset = (page - 1) * pageSize;
    const queryParams: Record<string, string | number | boolean> = {
      size: pageSize,
      offset,
    };
    if (params.q) queryParams.q = params.q;
    if (params.category) queryParams.tag = params.category;
    const rows = await db.query<MarketAssistantListRow>(
      'lobehub',
      'marketAssistantList',
      queryParams,
    );
    const items = rows.map(mapAssistantRow);
    return {
      currentPage: page,
      items,
      pageSize,
      totalCount: rows.length,
      totalPages: Math.ceil(rows.length / pageSize),
    };
  };

  getAgentsByPlugin = async (params: {
    locale?: string;
    page?: number;
    pageSize?: number;
    pluginId: string;
  }): Promise<AssistantListResponse> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getAgentsByPlugin.query({
      ...params,
      locale,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 20,
    });
  };

  // ============================== MCP Market ==============================

  getMcpCategories = async (params: CategoryListQuery = {}): Promise<CategoryItem[]> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getMcpCategories.query({
      ...params,
      locale,
    });
  };

  getMcpDetail = async (params: {
    identifier: string;
    locale?: string;
    version?: string;
  }): Promise<DiscoverMcpDetail> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getMcpDetail.query({
      ...params,
      locale,
    });
  };

  getMcpList = async (params: McpQueryParams = {}): Promise<McpListResponse> => {
    await this.safeInjectMPToken();

    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getMcpList.query({
      ...params,
      locale,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 20,
    });
  };

  getMCPPluginList = async (params: MCPPluginListParams): Promise<McpListResponse> => {
    await this.safeInjectMPToken();

    const locale = globalHelpers.getCurrentLanguage();

    return lambdaClient.market.getMcpList.query({
      ...params,
      locale,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 21,
    });
  };

  getMcpManifest = async (params: { identifier: string; locale?: string; version?: string }) => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getMcpManifest.query({
      ...params,
      locale,
    });
  };

  getMCPPluginManifest = async (
    identifier: string,
    options: { install?: boolean } = {},
  ): Promise<PluginManifest> => {
    const locale = globalHelpers.getCurrentLanguage();

    return lambdaClient.market.getMcpManifest.query({
      identifier,
      install: options.install,
      locale,
    });
  };

  registerClient = () => {
    return lambdaClient.market.registerClientInMarketplace.mutate({});
  };

  /**
   * Report MCP plugin installation result
   */
  reportMcpInstallResult = async ({
    success,
    manifest,
    errorMessage,
    errorCode,
    ...params
  }: InstallReportRequest) => {
    // if user don't allow tracing, just not report installation
    const allow = userGeneralSettingsSelectors.telemetry(useUserStore.getState());

    if (!allow) return;
    await this.safeInjectMPToken();

    const reportData = {
      errorCode: success ? undefined : errorCode,
      errorMessage: success ? undefined : errorMessage,
      manifest: success ? manifest : undefined,
      success,
      ...params,
    };

    lambdaClient.market.reportMcpInstallResult
      .mutate(cleanObject(reportData))
      .catch((reportError) => {
        console.warn('Failed to report MCP installation result:', reportError);
      });
  };

  /**
   * Report plugin call result
   */
  reportPluginCall = async (reportData: CallReportRequest) => {
    // if user don't allow tracing , just not report calling
    const allow = userGeneralSettingsSelectors.telemetry(useUserStore.getState());

    if (!allow) return;

    await this.safeInjectMPToken();

    lambdaClient.market.reportCall.mutate(cleanObject(reportData)).catch((reportError) => {
      console.warn('Failed to report call:', reportError);
    });
  };

  reportMcpEvent = async (eventData: PluginEventRequest) => {
    const allow = userGeneralSettingsSelectors.telemetry(useUserStore.getState());
    if (!allow) return;

    await this.safeInjectMPToken();

    const payload = cleanObject({
      ...eventData,
      source: eventData.source ?? 'community/mcp',
    });

    lambdaClient.market.reportMcpEvent.mutate(payload).catch((error) => {
      console.warn('Failed to report MCP event:', error);
    });
  };

  /**
   * Report agent installation to increase install count
   */
  reportAgentInstall = async (identifier: string) => {
    // if user don't allow tracing, just not report installation
    const allow = userGeneralSettingsSelectors.telemetry(useUserStore.getState());

    if (!allow) return;

    await this.safeInjectMPToken();

    lambdaClient.market.reportAgentInstall.mutate({ identifier }).catch((reportError) => {
      console.warn('Failed to report agent installation:', reportError);
    });
  };

  reportAgentEvent = async (eventData: AgentEventRequest) => {
    const allow = userGeneralSettingsSelectors.telemetry(useUserStore.getState());
    if (!allow) return;

    await this.safeInjectMPToken();

    const payload = cleanObject({
      ...eventData,
      source: eventData.source ?? 'community/agent',
    });

    lambdaClient.market.reportAgentEvent.mutate(payload).catch((error) => {
      console.warn('Failed to report Agent event:', error);
    });
  };

  // ============================== Models ==============================

  getModelCategories = async (params: CategoryListQuery = {}): Promise<CategoryItem[]> => {
    return lambdaClient.market.getModelCategories.query(params);
  };

  getModelDetail = async (params: {
    identifier: string;
    locale?: string;
  }): Promise<DiscoverModelDetail | undefined> => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<MarketModelDetailRow>('lobehub', 'marketModelDetail', {
      id: params.identifier,
    });
    if (!rows.length) return undefined;
    return mapModelDetail(rows[0]);
  };

  getModelIdentifiers = async (): Promise<IdentifiersResponse> => {
    return lambdaClient.market.getModelIdentifiers.query();
  };

  getModelList = async (params: ModelQueryParams = {}): Promise<ModelListResponse> => {
    const db = await getLobehubQueryClient();
    const page = params.page ? Number(params.page) : 1;
    const pageSize = params.pageSize ? Number(params.pageSize) : 20;
    const offset = (page - 1) * pageSize;
    const queryParams: Record<string, string | number | boolean> = {
      size: pageSize,
      offset,
    };
    if (params.category) queryParams.providerId = params.category;
    const rows = await db.query<MarketModelListRow>('lobehub', 'marketModelList', queryParams);
    const items = rows.map(mapModelRow);
    return {
      currentPage: page,
      items,
      pageSize,
      totalCount: rows.length,
      totalPages: Math.ceil(rows.length / pageSize),
    };
  };

  // ============================== Plugin Market ==============================

  getPluginCategories = async (params: CategoryListQuery = {}): Promise<CategoryItem[]> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getPluginCategories.query({
      ...params,
      locale,
    });
  };

  getPluginDetail = async (params: {
    identifier: string;
    locale?: string;
    withManifest?: boolean;
  }): Promise<DiscoverPluginDetail | undefined> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getPluginDetail.query({
      ...params,
      locale,
    });
  };

  getPluginIdentifiers = async (): Promise<IdentifiersResponse> => {
    return lambdaClient.market.getPluginIdentifiers.query();
  };

  getPluginList = async (params: PluginQueryParams = {}): Promise<PluginListResponse> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getPluginList.query({
      ...params,
      locale,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 20,
    });
  };

  // ============================== Providers ==============================

  getProviderDetail = async (params: {
    identifier: string;
    locale?: string;
    withReadme?: boolean;
  }): Promise<DiscoverProviderDetail | undefined> => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<MarketProviderDetailRow>('lobehub', 'marketProviderDetail', {
      id: params.identifier,
    });
    if (!rows.length) return undefined;
    return mapProviderDetail(rows[0]);
  };

  getProviderIdentifiers = async (): Promise<IdentifiersResponse> => {
    return lambdaClient.market.getProviderIdentifiers.query();
  };

  getProviderList = async (params: ProviderQueryParams = {}): Promise<ProviderListResponse> => {
    const db = await getLobehubQueryClient();
    const rows = await db.query<MarketProviderListRow>('lobehub', 'marketProviderList', {});
    const items = rows.map(mapProviderRow);
    return {
      currentPage: 1,
      items,
      pageSize: items.length,
      totalCount: items.length,
      totalPages: 1,
    };
  };

  // ============================== User Profile ==============================

  getUserInfo = async (params: {
    locale?: string;
    username: string;
  }): Promise<DiscoverUserProfile | undefined> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getUserInfo.query({
      locale,
      username: params.username,
    });
  };

  // ============================== Helpers ==============================

  async injectMPToken() {
    if (typeof localStorage === 'undefined') return;

    // Check server-set status flag cookie
    const tokenStatus = this.getTokenStatusFromCookie();
    if (tokenStatus === 'active') return;

    // If a token refresh is already in progress, wait for it to complete
    if (this._tokenRefreshPromise) {
      await this._tokenRefreshPromise;
      return;
    }

    // Create a new refresh promise and execute
    this._tokenRefreshPromise = this._doRefreshToken();
    try {
      await this._tokenRefreshPromise;
    } finally {
      this._tokenRefreshPromise = null;
    }
  }

  private async _doRefreshToken() {
    let clientId: string;
    let clientSecret: string;

    // 1. Get client information from localStorage
    const item = localStorage.getItem('_mpc');
    if (!item) {
      // 2. If not exists, register client
      const clientInfo = await this.registerClient();
      clientId = clientInfo.clientId;
      clientSecret = clientInfo.clientSecret;

      // 3. Base64 encode and save to localStorage
      const clientData = JSON.stringify({ clientId, clientSecret });
      const encodedData = btoa(clientData);
      localStorage.setItem('_mpc', encodedData);
    } else {
      // 4. If exists, decode to get client information
      try {
        const decodedData = atob(item);
        const clientData = JSON.parse(decodedData);
        clientId = clientData.clientId;
        clientSecret = clientData.clientSecret;
      } catch (error) {
        console.error('Failed to decode client data:', error);
        // If decoding fails, re-register
        const clientInfo = await this.registerClient();
        clientId = clientInfo.clientId;
        clientSecret = clientInfo.clientSecret;

        const clientData = JSON.stringify({ clientId, clientSecret });
        const encodedData = btoa(clientData);
        localStorage.setItem('_mpc', encodedData);
      }
    }

    // 5. Get access token (server will automatically set HTTP-Only cookie)
    try {
      const result = await lambdaClient.market.registerM2MToken.query({
        clientId,
        clientSecret,
      });

      // Check server response result
      if (!result.success) {
        console.warn(
          'Token registration failed, client credentials may be invalid. Clearing and retrying...',
        );

        // Clear related local storage data
        localStorage.removeItem('_mpc');

        // Re-execute the complete registration process (but only retry once)
        if (!this._isRetrying) {
          this._isRetrying = true;
          try {
            await this._doRefreshToken();
          } finally {
            this._isRetrying = false;
          }
        } else {
          console.error('Failed to re-register after credential invalidation');
        }

        return;
      }

      // 6. Wait for cookie to be set by browser
      // The Set-Cookie header processing may have a tiny delay
      await this._waitForCookieSet();
    } catch (error) {
      console.error('Failed to register M2M token:', error);
    }
  }

  private async _waitForCookieSet(maxRetries = 10, interval = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      if (this.getTokenStatusFromCookie() === 'active') {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    // If cookie still not set after retries, continue anyway
    // The request might still work if the cookie was set but we couldn't detect it
    console.warn('Cookie may not be fully set, proceeding anyway');
  }

  private getTokenStatusFromCookie(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'mp_token_status') {
        return value;
      }
    }
    return null;
  }

  // ============================== Skills Market ==============================

  getSkillCategories = async (params: CategoryListQuery = {}): Promise<SkillCategoryItem[]> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.skill.getSkillCategories.query({
      ...params,
      locale,
    });
  };

  getSkillDetail = async (params: {
    identifier: string;
    locale?: string;
    version?: string;
  }): Promise<DiscoverSkillDetail> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.skill.getSkillDetail.query({
      ...params,
      locale,
    });
  };

  getSkillList = async (params: SkillQueryParams = {}): Promise<SkillListResponse> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.skill.getSkillList.query({
      ...params,
      locale,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 20,
    });
  };

  reportSkillEvent = async (eventData: { event: string; identifier: string; source?: string }) => {
    const allow = userGeneralSettingsSelectors.telemetry(useUserStore.getState());
    if (!allow) return;

    const payload = cleanObject({
      ...eventData,
      source: eventData.source ?? 'community/skill',
    });

    // Note: skill event reporting can be added when the backend supports it
    // Payload prepared for future backend integration
    void payload;
  };

  // ============================== Group Agent Market ==============================

  getGroupAgentCategories = async (params: CategoryListQuery = {}): Promise<CategoryItem[]> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getGroupAgentCategories.query({
      ...params,
      locale,
    });
  };

  getGroupAgentDetail = async (params: {
    identifier: string;
    locale?: string;
    version?: string;
  }): Promise<any> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.getGroupAgentDetail.query({
      identifier: params.identifier,
      locale,
      version: params.version,
    });
  };

  getGroupAgentIdentifiers = async (): Promise<IdentifiersResponse> => {
    return lambdaClient.market.getGroupAgentIdentifiers.query();
  };

  getGroupAgentList = async (params: GroupAgentQueryParams = {}): Promise<any> => {
    const locale = globalHelpers.getCurrentLanguage();
    return lambdaClient.market.agentGroup.getAgentGroupList.query(
      {
        ...params,
        locale,
        page: params.page ? Number(params.page) : 1,
        pageSize: params.pageSize ? Number(params.pageSize) : 20,
      },
      { context: { showNotification: false } },
    );
  };

  reportGroupAgentEvent = async (params: {
    event: 'add' | 'chat' | 'click';
    identifier: string;
    source?: string;
  }): Promise<void> => {
    await lambdaClient.market.reportGroupAgentEvent.mutate(params);
  };

  reportGroupAgentInstall = async (identifier: string): Promise<void> => {
    await lambdaClient.market.reportGroupAgentInstall.mutate({ identifier });
  };
}

export const discoverService = new DiscoverService();
