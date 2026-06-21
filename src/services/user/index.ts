import type { OnboardingUserInfo } from '@lobechat/context-engine';
import { type MarkdownPatchHunk } from '@lobechat/markdown-patch';
import { type PartialDeep } from 'type-fest';

import { getPrestClient } from '@/libs/prest/client';
import { lambdaClient } from '@/libs/trpc/client';
import {
  type SaveUserQuestionInput,
  type UserAgentOnboarding,
  type UserAgentOnboardingContext,
  type UserGuide,
  type UserInitializationState,
  type UserOnboarding,
  type UserPreference,
} from '@/types/user';
import { type UserSettings } from '@/types/user/settings';

export class UserService {
  getUserRegistrationDuration = async (): Promise<{
    createdAt: string;
    duration: number;
    updatedAt: string;
  }> => {
    const client = await getPrestClient();
    const rows = await client.select<{ created_at: string; updated_at: string }>(
      'lobehub',
      'public',
      'users',
      { size: 1 },
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) {
      return { createdAt: '', duration: 0, updatedAt: '' };
    }
    const createdAt = new Date(row.created_at);
    const duration = Date.now() - createdAt.getTime();
    return { createdAt: row.created_at, duration, updatedAt: row.updated_at };
  };

  getUserState = async (): Promise<UserInitializationState> => {
    return lambdaClient.user.getUserState.query();
  };

  getOrCreateOnboardingState = async (): Promise<{
    agentId: string;
    agentOnboarding: UserAgentOnboarding;
    context: UserAgentOnboardingContext;
    feedbackSubmitted: boolean;
    topicId: string;
  }> => {
    return lambdaClient.user.getOrCreateOnboardingState.query();
  };

  getOnboardingBootstrapState = async (): Promise<{
    agentId: string;
    agentOnboarding: UserAgentOnboarding;
    context: UserAgentOnboardingContext;
    feedbackSubmitted: boolean;
    hasMessages: boolean;
    topicId: string | null;
  }> => {
    return lambdaClient.user.getOnboardingBootstrapState.query();
  };

  sendOnboardingFirstMessage = async (input: { agentId: string }) => {
    return lambdaClient.user.sendOnboardingFirstMessage.mutate(input);
  };

  getOnboardingAgentContext = async (): Promise<{
    personaContent: string | null;
    phaseGuidance: string;
    soulContent: string | null;
    userInfo?: OnboardingUserInfo;
  }> => {
    return lambdaClient.user.getOnboardingAgentContext.query();
  };

  saveUserQuestion = async (params: SaveUserQuestionInput) => {
    return lambdaClient.user.saveUserQuestion.mutate(
      params as Parameters<typeof lambdaClient.user.saveUserQuestion.mutate>[0],
    );
  };

  finishOnboarding = async () => {
    return lambdaClient.user.finishOnboarding.mutate({});
  };

  readOnboardingDocument = async (type: 'soul' | 'persona') => {
    return lambdaClient.user.readOnboardingDocument.query({ type });
  };

  updateOnboardingDocument = async (type: 'soul' | 'persona', content: string) => {
    return lambdaClient.user.updateOnboardingDocument.mutate({ content, type });
  };

  patchOnboardingDocument = async (type: 'soul' | 'persona', hunks: MarkdownPatchHunk[]) => {
    return lambdaClient.user.patchOnboardingDocument.mutate({ hunks, type });
  };

  makeUserOnboarded = async () => {
    return lambdaClient.user.makeUserOnboarded.mutate();
  };

  resetAgentOnboarding = async () => {
    return lambdaClient.user.resetAgentOnboarding.mutate();
  };

  updateAgentOnboarding = async (agentOnboarding: UserAgentOnboarding) => {
    return lambdaClient.user.updateAgentOnboarding.mutate(agentOnboarding);
  };

  updateOnboarding = async (onboarding: UserOnboarding) => {
    return lambdaClient.user.updateOnboarding.mutate(onboarding);
  };

  updateAvatar = async (avatar: string) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'users', {}, { avatar });
  };

  updateInterests = async (interests: string[]) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'user_settings', {}, { interests });
  };

  updateFullName = async (fullName: string) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'users', {}, { full_name: fullName });
  };

  updateUsername = async (username: string) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'users', {}, { username });
  };

  /**
   * Update user preference (jsonb column).
   *
   * Tier 1 update on `user_settings.preference`. Auto-scoped by user_id
   * via [[auth.user_id_filters]]. The BFF handler also creates the row
   * on first call; pREST's update silently succeeds on zero rows.
   */
  updatePreference = async (preference: Partial<UserPreference>) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'user_settings', {}, { preference });
  };

  /**
   * Update user guide (jsonb column).
   *
   * Tier 1 update on `user_settings.guide`. Same auto-scope pattern.
   */
  updateGuide = async (guide: Partial<UserGuide>) => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'user_settings', {}, { guide });
  };

  /**
   * Update user settings (settings jsonb).
   *
   * Stays on lambdaClient — callers pass `signal` for abort-support on
   * auto-save keystrokes. pREST doesn't expose AbortSignal yet.
   */
  updateUserSettings = async (value: PartialDeep<UserSettings>, signal?: AbortSignal) => {
    return lambdaClient.user.updateSettings.mutate(value, { signal });
  };

  resetUserSettings = async () => {
    const client = await getPrestClient();
    await client.update('lobehub', 'public', 'user_settings', {}, { settings: {} });
  };
}

export const userService = new UserService();
