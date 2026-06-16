'use client';

import type { UiNode, UiNodeInputAttributes, UiText } from '@ory/client';

interface NodeInputProps {
  disabled: boolean;
  dispatchSubmit: () => void;
  messages?: UiText[] | null;
  node: UiNode & { attributes: UiNodeInputAttributes };
  setValue: (v: any) => void;
  value: any;
}

export function NodeInput({
  node,
  value,
  disabled,
  dispatchSubmit,
  setValue,
  messages,
}: NodeInputProps) {
  const { attributes } = node;
  const attrs = attributes;

  if (attrs.type === 'hidden') {
    return <input name={attrs.name} type="hidden" value={attrs.value || ''} />;
  }

  if (attrs.type === 'submit' && node.group === 'oidc') {
    return (
      <div style={{ marginBottom: 8, width: '100%' }}>
        <button
          disabled={disabled}
          name={attrs.name}
          type="submit"
          value={attrs.value || ''}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            background: '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onClick={() => dispatchSubmit()}
        >
          {node.meta?.label?.text || attrs.label?.text || 'Continue'}
        </button>
      </div>
    );
  }

  if (attrs.type === 'submit') {
    return (
      <button
        disabled={disabled}
        name={attrs.name}
        type="submit"
        value={attrs.value || ''}
        style={{
          width: '100%',
          padding: '10px 16px',
          border: 'none',
          borderRadius: 6,
          background: disabled ? '#d9d9d9' : '#1677ff',
          color: '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 15,
          marginBottom: 8,
        }}
        onClick={() => dispatchSubmit()}
      >
        {node.meta?.label?.text || attrs.label?.text || 'Submit'}
      </button>
    );
  }

  if (attrs.type === 'button') {
    return (
      <button
        disabled={disabled}
        name={attrs.name}
        type="button"
        value={attrs.value || ''}
        style={{
          width: '100%',
          padding: '10px 16px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          background: '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 15,
          marginBottom: 8,
        }}
        onClick={() => dispatchSubmit()}
      >
        {node.meta?.label?.text || attrs.label?.text || 'Button'}
      </button>
    );
  }

  if (attrs.type === 'checkbox') {
    const checked = !!value;
    return (
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            checked={checked}
            disabled={disabled}
            name={attrs.name}
            type="checkbox"
            onChange={() => setValue(attrs.value)}
          />
          {node.meta?.label?.text || attrs.label?.text}
        </label>
        {messages && messages.length > 0 && <MessagesInline messages={messages} />}
      </div>
    );
  }

  const label = node.meta?.label?.text || attrs.label?.text || attrs.name;
  const placeholder = attrs.name === 'identifier' ? 'Email' : attrs.name;

  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: 4,
            fontSize: 14,
            fontWeight: 500,
            color: '#333',
          }}
        >
          {label}
          {attrs.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
        </label>
      )}
      <input
        autoComplete={attrs.autocomplete || undefined}
        disabled={disabled}
        name={attrs.name}
        placeholder={placeholder}
        required={attrs.required}
        type={attrs.type === 'password' ? 'password' : 'text'}
        value={value ?? ''}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          fontSize: 14,
          boxSizing: 'border-box',
          background: disabled ? '#f5f5f5' : '#fff',
        }}
        onChange={(e) => setValue(e.target.value)}
      />
      {messages && messages.length > 0 && <MessagesInline messages={messages} />}
    </div>
  );
}

function MessagesInline({ messages }: { messages: UiText[] }) {
  return (
    <div style={{ marginTop: 4 }}>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{ fontSize: 12, color: m.type === 'error' ? '#cf1322' : '#389e0d', marginTop: 2 }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
