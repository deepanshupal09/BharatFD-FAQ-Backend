import { Document, model, Schema, Model, ObjectId } from 'mongoose';

export interface IFAQ extends Document {
  _id: ObjectId;
  question: string;                                     
  answer: string;                                     
  translations?: Map<string, string>;                 
  getTranslatedQuestion: (lang: string) => string;
}

const faqSchema = new Schema<IFAQ>({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  translations: {
    type: Map,
    of: String,
    default: new Map()
  }
});

interface FAQModel extends Model<IFAQ> { }

faqSchema.methods.getTranslatedQuestion = function (lang: string): string {
  return this.translations.get(lang) || this.question;
};

export const FAQ = model<IFAQ, FAQModel>('FAQ', faqSchema);
export type FAQDocument = IFAQ; 