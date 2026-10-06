import { model, Schema, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  _id: Types.ObjectId;
  status: 'live' | 'archived' | 'translator' | 'tool';
  isPinned?: boolean;
  toolId?: Types.ObjectId | null;
  deviceId?: string | null;
  title: string;
  messageCount: number;
  startedAt: Date;
  archivedAt?: Date | null;
  previewText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema: Schema = new Schema(
  {
    status: {
      type: String,
      enum: ['live', 'archived', 'translator', 'tool'],
      default: 'live',
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    toolId: {
      type: Schema.Types.ObjectId,
      ref: 'Tool',
      default: null,
      index: true,
    },
    deviceId: {
      type: String,
      default: null,
      index: true,
    },
    title: {
      type: String,
      default: 'Live Chat',
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    previewText: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ status: 1, isPinned: -1, archivedAt: -1 });
conversationSchema.index({ status: 1, archivedAt: -1 });
conversationSchema.index({ status: 1, toolId: 1, deviceId: 1 });

export const ConversationModel = model<IConversation>('Conversation', conversationSchema);
