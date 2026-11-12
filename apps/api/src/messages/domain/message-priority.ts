export const MessagePriority = {
  NORMAL: 'NORMAL',
  URGENT: 'URGENT',
} as const;

export type MessagePriority = (typeof MessagePriority)[keyof typeof MessagePriority];

export const MESSAGE_PRIORITIES = Object.values(MessagePriority);
