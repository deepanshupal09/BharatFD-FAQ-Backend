import { Document, model, Schema, Model, ObjectId } from 'mongoose';

export interface IFAQ extends Document {
    _id: ObjectId;
  question: string;                                     //original eng questions
  answer: string;                                      //content from WYSIWYG (in form of HTML)
  translations?: Map<string, string>;                  //key: language code, value: translated question
  getTranslatedQuestion: (lang: string) => string;
}

// FAQ model schema
const faqSchema = new Schema<IFAQ>({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  translations: { 
    type: Map,
    of: String,
    default: new Map()
  }
});

interface FAQModel extends Model<IFAQ> {}

// Translated question get method
faqSchema.methods.getTranslatedQuestion = function(lang: string): string {
  return this.translations.get(lang) || this.question;
};

export const FAQ = model<IFAQ, FAQModel>('FAQ', faqSchema);
export type FAQDocument = IFAQ;  //type format of IFAQ