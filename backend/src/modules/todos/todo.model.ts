import { Schema, model, Document, Types } from 'mongoose';

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface ISubtask {
  _id?: Types.ObjectId;
  title: string;
  completed: boolean;
}

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  tags: string[];
  dueDate?: Date | null;
  subtasks: ISubtask[];
  deviceId?: string;
  userId?: Types.ObjectId | null;
  sourceMessageId?: Types.ObjectId | null;
  prompt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskSchema = new Schema<ISubtask>(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
);

const TodoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    prompt: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    tags: { type: [String], default: [] },
    dueDate: { type: Date, default: null },
    subtasks: { type: [SubtaskSchema], default: [] },
    deviceId: { type: String, default: '', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sourceMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true }
);

export const TodoModel = model<ITodo>('Todo', TodoSchema);
