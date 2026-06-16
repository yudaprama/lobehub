'use client';

import type { UiText } from '@ory/client';

export function Messages({ messages }: { messages?: UiText[] | null }) {
  if (!messages || messages.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            marginBottom: 4,
            fontSize: 14,
            background: m.type === 'error' ? '#fff2f0' : '#f6ffed',
            border: `1px solid ${m.type === 'error' ? '#ffccc7' : '#b7eb8f'}`,
            color: m.type === 'error' ? '#cf1322' : '#135200',
          }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
