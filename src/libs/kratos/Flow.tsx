'use client';

import type {
  LoginFlow,
  RecoveryFlow,
  RegistrationFlow,
  SettingsFlow,
  UiNode,
  UpdateLoginFlowBody,
  UpdateRecoveryFlowBody,
  UpdateRegistrationFlowBody,
  UpdateSettingsFlowBody,
  UpdateVerificationFlowBody,
  VerificationFlow,
} from '@ory/client';
import { getNodeId, isUiNodeInputAttributes } from '@ory/integrations/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Messages } from './Messages';
import { Node } from './Node';

export type Values = Partial<
  | UpdateLoginFlowBody
  | UpdateRegistrationFlowBody
  | UpdateRecoveryFlowBody
  | UpdateSettingsFlowBody
  | UpdateVerificationFlowBody
>;

export type FlowType =
  | 'oidc'
  | 'password'
  | 'profile'
  | 'totp'
  | 'webauthn'
  | 'passkey'
  | 'link'
  | 'lookup_secret';

interface FlowProps {
  children?: React.ReactNode;
  flow?: LoginFlow | RegistrationFlow | SettingsFlow | VerificationFlow | RecoveryFlow;
  hideGlobalMessages?: boolean;
  only?: FlowType;
  onSubmit: (values: Values) => Promise<void>;
}

export function Flow({ flow, only, onSubmit, hideGlobalMessages = false, children }: FlowProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>({});
  const [loading, setLoading] = useState(false);

  const filterNodes = useCallback(
    (nodes: UiNode[]): UiNode[] => {
      if (!only) return nodes;
      return nodes.filter((n) => n.group === 'default' || n.group === only);
    },
    [only],
  );

  const nodes = useMemo(() => {
    if (!flow) return [];
    return filterNodes(flow.ui.nodes);
  }, [flow, filterNodes]);

  useEffect(() => {
    if (!flow) return;
    const initial: Values = {};
    for (const node of filterNodes(flow.ui.nodes)) {
      if (isUiNodeInputAttributes(node.attributes)) {
        if (node.attributes.type === 'button' || node.attributes.type === 'submit') continue;
        const name = node.attributes.name as keyof Values;
        (initial as any)[name] = node.attributes.value;
      }
    }
    setValues(initial);
  }, [flow, filterNodes]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (loading) return;

      const form = e.currentTarget;
      const formData = new FormData(form);
      let body: Values = Object.fromEntries(formData) as Values;

      const nativeEvent = e.nativeEvent as SubmitEvent;
      const submitter = (nativeEvent as any).submitter as HTMLInputElement;
      if (submitter) {
        (body as any)[submitter.name] = submitter.value;
      }

      body = { ...body, ...values };

      setLoading(true);
      try {
        await onSubmit(body);
      } finally {
        setLoading(false);
      }
    },
    [loading, onSubmit, values],
  );

  const setValue = useCallback(
    (key: string) => (val: any) => {
      setValues((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  const dispatchSubmit = useCallback(() => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  }, []);

  if (!flow) return null;

  return (
    <form action={flow.ui.action} method={flow.ui.method} ref={formRef} onSubmit={handleSubmit}>
      {!hideGlobalMessages && <Messages messages={flow.ui.messages} />}
      {nodes.map((node, k) => {
        const id = getNodeId(node) as keyof Values;
        return (
          <Node
            disabled={loading}
            dispatchSubmit={dispatchSubmit}
            key={`${id}-${k}`}
            node={node}
            setValue={setValue(id)}
            value={(values as any)[id]}
          />
        );
      })}
      {children}
    </form>
  );
}
