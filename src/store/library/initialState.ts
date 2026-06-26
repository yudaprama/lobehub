import { type KnowledgeBaseState } from '../library/slices/crud';
import { initialKnowledgeBaseState } from '../library/slices/crud';

export type KnowledgeBaseStoreState = KnowledgeBaseState;

export const initialState: KnowledgeBaseStoreState = {
  ...initialKnowledgeBaseState,
};
