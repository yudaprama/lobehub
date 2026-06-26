/**
 * This file contains the root router of Lobe Chat tRPC-backend
 */
import { pageShareRouter } from '@/business/server/lambda-routers/pageShare';
import { taskTemplateRouter } from '@/business/server/lambda-routers/taskTemplate';
import { workspaceRouter } from '@/business/server/lambda-routers/workspace';
import { workspaceCredsRouter } from '@/business/server/lambda-routers/workspaceCreds';
import { publicProcedure, router } from '@/libs/trpc/lambda';

import { agentRouter } from './agent';
import { agentBotProviderRouter } from './agentBotProvider';
import { agentDocumentRouter } from './agentDocument';
import { agentGroupRouter } from './agentGroup';
import { agentSignalRouter } from './agentSignal';
import { agentSkillsRouter } from './agentSkills';
import { aiAgentRouter } from './aiAgent';
import { aiChatRouter } from './aiChat';
import { aiProviderRouter } from './aiProvider';
import { apiKeyRouter } from './apiKey';
import { botMessageRouter } from './botMessage';
import { briefRouter } from './brief';
import { chunkRouter } from './chunk';
import { composioRouter } from './composio';
import { configRouter } from './config';
import { connectorRouter } from './connector';
import { deviceRouter } from './device';
import { documentRouter } from './document';
import { exporterRouter } from './exporter';
import { fileRouter } from './file';
import { generationTopicRouter } from './generationTopic';
import { homeRouter } from './home';
import { imageRouter } from './image';
import { importerRouter } from './importer';
import { knowledgeBaseRouter } from './knowledgeBase';
import { marketRouter } from './market';
import { messageRouter } from './message';
import { messengerRouter } from './messenger';
import { notebookRouter } from './notebook';
import { oauthDeviceFlowRouter } from './oauthDeviceFlow';
import { ragEvalRouter } from './ragEval';
import { searchRouter } from './search';
import { sessionRouter } from './session';
import { shareRouter } from './share';
import { taskRouter } from './task';
import { threadRouter } from './thread';
import { topicRouter } from './topic';
import { userRouter } from './user';
import { userMemoriesRouter } from './userMemories';
import { userMemoryRouter } from './userMemory';
import { verifyRouter } from './verify';
import { videoRouter } from './video';
import { webBrowsingRouter } from './webBrowsing';

export const lambdaRouter = router({
  agent: agentRouter,
  agentBotProvider: agentBotProviderRouter,
  botMessage: botMessageRouter,
  agentDocument: agentDocumentRouter,
  agentSkills: agentSkillsRouter,
  agentSignal: agentSignalRouter,
  task: taskRouter,
  brief: briefRouter,
  aiAgent: aiAgentRouter,
  aiChat: aiChatRouter,
  aiProvider: aiProviderRouter,
  apiKey: apiKeyRouter,
  chunk: chunkRouter,
  config: configRouter,
  connector: connectorRouter,
  device: deviceRouter,
  document: documentRouter,
  exporter: exporterRouter,
  file: fileRouter,
  generationTopic: generationTopicRouter,
  group: agentGroupRouter,
  healthcheck: publicProcedure.query(() => "i'm live!"),
  home: homeRouter,
  image: imageRouter,
  importer: importerRouter,
  composio: composioRouter,
  knowledgeBase: knowledgeBaseRouter,
  market: marketRouter,
  message: messageRouter,
  messenger: messengerRouter,
  notebook: notebookRouter,
  oauthDeviceFlow: oauthDeviceFlowRouter,
  ragEval: ragEvalRouter,
  search: searchRouter,
  session: sessionRouter,
  share: shareRouter,
  thread: threadRouter,
  topic: topicRouter,
  user: userRouter,
  userMemories: userMemoriesRouter,
  userMemory: userMemoryRouter,
  verify: verifyRouter,
  video: videoRouter,
  webBrowsing: webBrowsingRouter,
  workspace: workspaceRouter,
  workspaceCreds: workspaceCredsRouter,
  pageShare: pageShareRouter,
  taskTemplate: taskTemplateRouter,
});

export type LambdaRouter = typeof lambdaRouter;
