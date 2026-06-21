import type { OnboardingUserInfo } from '@lobechat/context-engine';
import { type MarkdownPatchHunk } from '@lobechat/markdown-patch';
import { type PartialDeep } from 'type-fest';

import { getLobehubQueryClient } from '@/libs/prest/client';
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
    const db = await getLobehubQueryClient();
    const rows = await db.select('users', { size: 1 });
    const row = Array.isArray(rows)
      ? (rows[0] as { createdAt: string; updatedAt: string } | undefined)
      : undefined;
    if (!row) {
      return { createdAt: '', duration: 0, updatedAt: '' };
    }
    const createdAt = new Date(row.createdAt);
    const duration = Date.now() - createdAt.getTime();
    return { createdAt: row.createdAt, duration, updatedAt: row.updatedAt };
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
    const db = await getLobehubQueryClient();
    await db.update('users', {}, { avatar } as any);
  };

  updateInterests = async (interests: string[]) => {
    const db = await getLobehubQueryClient();
    await db.update('user_settings', {}, { interests } as any);
  };

  updateFullName = async (fullName: string) => {
    const db = await getLobehubQueryClient();
    await db.update('users', {}, { full_name: fullName } as any);
  };

  updateUsername = async (username: string) => {
    const db = await getLobehubQueryClient();
    await db.update('users', {}, { username } as any);
  };

  /**
   * Update user preference (jsonb column).
   *
   * Tier 1 update on `user_settings.preference`. Auto-scoped by user_id
   * via [[auth.user_id_filters]]. The BFF handler also creates the row
   * on first call; pREST's update silently succeeds on zero rows.
   */
  updatePreference = async (preference: Partial<UserPreference>) => {
    const db = await getLobehubQueryClient();
    await db.update('user_settings', {}, { preference } as any);
  };

  /**
   * Update user guide (jsonb column).
   *
   * Tier 1 update on `user_settings.guide`. Same auto-scope pattern.
   */
  updateGuide = async (guide: Partial<UserGuide>) => {
    const db = await getLobehubQueryClient();
    await db.update('user_settings', {}, { guide } as any);
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
    const db = await getLobehubQueryClient();
    await db.update('user_settings', {}, { settings: {} } as any);
  };
}

export const userService = new UserService();
