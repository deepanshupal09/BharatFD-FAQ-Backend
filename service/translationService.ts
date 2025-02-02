import { FAQDocument } from "../model/faqModel";
import dotenv from "dotenv";
import axios from 'axios';
import { setCacheTranslation } from "./cacheService";

dotenv.config();

interface TranslationResponse {
    data: {
        translations: Array<{
            translatedText: string;
            detectedSourceLanguage?: string;
        }>;
    }
}

export const translateFAQ = async (faq: FAQDocument) => {
    const targetLangs = ['hi', 'bn', 'es', 'fr'];
    try {
        if (!faq.translations) {
            faq.translations = new Map();
        }
        for (const lang of targetLangs) {
            const questionResponse = await axios.post<TranslationResponse>(
                'https://translation.googleapis.com/language/translate/v2',
                {
                    q: faq.question,
                    target: lang,
                    format: 'text'
                },
                {
                    params: {
                        key: process.env.GOOGLE_TRANSLATE_KEY,
                        alt: 'json'
                    }
                }
            );

            // Translate answer
            const answerResponse = await axios.post<TranslationResponse>(
                'https://translation.googleapis.com/language/translate/v2',
                {
                    q: faq.answer,
                    target: lang,
                    format: 'html'
                },
                {
                    params: {
                        key: process.env.GOOGLE_TRANSLATE_KEY,
                        alt: 'json'
                    }
                }
            );

            const questionTranslation = questionResponse.data.data.translations[0].translatedText;
            const answerTranslation = answerResponse.data.data.translations[0].translatedText;

            faq.translations.set(lang, questionTranslation);
            await setCacheTranslation(faq._id.toString(), lang, answerTranslation);
        }
        await faq.save();
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Translation error details:', error.response?.data || error.message);
        } else {
            console.error('Translation error details:', (error as Error).message);
        }
        throw new Error('Translation failed');
    }
}