import { model, Schema, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId?: Types.ObjectId | null;
  senderName: string;
  deviceId?: string;
  deviceLabel?: string;
  kind: 'text' | 'link' | 'image';
  text: string;
  url?: string;
  mime?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema: Schema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      default: 'Guest',
    },
    deviceId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    deviceLabel: {
      type: String,
      default: '',
      trim: true,
    },
    kind: {
      type: String,
      enum: ['text', 'link', 'image'],
      default: 'text',
    },
    text: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      default: '',
    },
    mime: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const MessageModel = model<IMessage>('Message', messageSchema);
