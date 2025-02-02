import { Request, Response } from 'express';
import { FAQ, FAQDocument } from '../model/faqModel';
import { translateFAQ } from '../service/translationService';
import { getCacheTranslation, invalidateCache, setCacheTranslation } from '../service/cacheService';

export class FAQController {
    public static async createFaq(req: Request, res: Response): Promise<void> {
        try {
            const { question, answer } = req.body;
            if (!question || !answer) {
                res.status(400).json({ error: 'Missing required fields' });
            }
            const newFAQ: FAQDocument = new FAQ({
                question,
                answer
            });
            const savedFAQ = await newFAQ.save();
            translateFAQ(savedFAQ).catch(error => console.error('Translation Failed: ', error));
            res.status(201).json({
                id: savedFAQ._id,
                question: savedFAQ.question,
                answer: savedFAQ.answer,
                message: 'FAQ created. Translations in progress.'
            });
        } catch (error) {
            console.error('Error creating FAQ:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    public static async getFAQ(req: Request, res: Response) {
        try {
            const lang = req.query.lang as string || 'en';
            const faqs = await FAQ.find();

            const response = await Promise.all(faqs.map(async (faq) => {
                const cachedTranslation = await getCacheTranslation(faq._id.toString(), lang);

                return {
                    id: faq._id,
                    question: faq.getTranslatedQuestion(lang),
                    answer: cachedTranslation || faq.answer
                };
            }));

            res.json(response);
        } catch (error) {
            console.error('Get FAQs error: ', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    public static async updateFAQ(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.query;
            const { question, answer } = req.body;

            const faq = await FAQ.findById(id);
            if (!faq) {
                res.status(404).json({ message: 'FAQ not found' });
                return;
            }

            if (question) faq.question = question;
            if (answer) faq.answer = answer;

            const updatedFaq = await faq.save();
            await invalidateCache(id as string);
            translateFAQ(faq).catch(error => console.error('Retranslation Failed: ', error));

            res.json({
                id: updatedFaq._id,
                question: updatedFaq.question,
                answer: updatedFaq.answer,
                message: 'FAQ updated. Retranslating content'

            });
        } catch (error) {
            console.error('Update FAQ error: ', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }

    public static async deleteFAQ(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.query;
            const deletedFaq = await FAQ.findByIdAndDelete(id);
            if (!deletedFaq) {
                res.status(404).json({ message: 'FAQ not found' });
                return;
            }
            await invalidateCache(id as string);
            res.json({
                message: 'FAQ deleted',
                deletedId: deletedFaq._id
            });
        } catch (error) {
            console.error('Delete FAQ error: ', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}