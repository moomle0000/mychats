import { model, Schema, Document } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: any;
  updatedAt: Date;
  createdAt: Date;
}

const settingSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SettingModel = model<ISetting>('Setting', settingSchema);
