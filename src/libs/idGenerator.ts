import { customAlphabet } from 'nanoid/non-secure';

const createNanoId = (size = 12) =>
  customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', size);

const prefixes = {
  agentSkills: 'skl',
  agents: 'agt',
  documents: 'docs',
  files: 'file',
  memory: 'mem',
  messages: 'msg',
  sessions: 'ssn',
  topics: 'tpc',
} as const;

export const idGenerator = (namespace: keyof typeof prefixes, size = 12): string => {
  const hash = createNanoId(size);
  const prefix = prefixes[namespace];

  if (!prefix) throw new Error(`Invalid namespace: ${namespace}`);

  return `${prefix}_${hash()}`;
};
