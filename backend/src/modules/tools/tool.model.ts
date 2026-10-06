import { model, Schema, Document, Types } from 'mongoose';

export type ToolVisibility = 'public' | 'private';

export interface ITool extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  systemPrompt: string;
  icon?: string;
  isBuiltin?: boolean;
  visibility: ToolVisibility;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const toolSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    systemPrompt: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: 'auto_awesome',
    },
    isBuiltin: {
      type: Boolean,
      default: false,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const ToolModel = model<ITool>('Tool', toolSchema);
