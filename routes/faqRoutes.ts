import { Router } from 'express';
import { FAQController } from '../controller/faqController';

const router = Router();

router.post('/', FAQController.createFaq);
router.get('/', FAQController.getFAQ);
router.put('/', FAQController.updateFAQ);
router.delete('/', FAQController.deleteFAQ);

export default router;