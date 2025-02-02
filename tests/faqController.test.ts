import sinon from 'sinon';
import { Request, Response } from 'express';
import { FAQ, FAQDocument } from '../model/faqModel';
import * as cacheService from '../service/cacheService';
import * as translationService from '../service/translationService';
import { FAQController } from '../controller/faqController';

describe('FAQController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let faqSaveStub: sinon.SinonStub;
  let faqFindStub: sinon.SinonStub;
  let faqFindByIdStub: sinon.SinonStub;
  let faqFindByIdAndDeleteStub: sinon.SinonStub;
  let getCacheStub: sinon.SinonStub;
  let invalidateCacheStub: sinon.SinonStub;
  let translateFAQStub: sinon.SinonStub;

  beforeEach(() => {
    req = { body: {}, query: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };

    // Stub FAQ model methods
    faqSaveStub = sinon.stub(FAQ.prototype, 'save');
    faqFindStub = sinon.stub(FAQ, 'find');
    faqFindByIdStub = sinon.stub(FAQ, 'findById');
    faqFindByIdAndDeleteStub = sinon.stub(FAQ, 'findByIdAndDelete');

    // Stub service methods
    getCacheStub = sinon.stub(cacheService, 'getCacheTranslation');
    invalidateCacheStub = sinon.stub(cacheService, 'invalidateCache');
    translateFAQStub = sinon.stub(translationService, 'translateFAQ').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createFaq', () => {
    it('should create a new FAQ and return 201 status', async () => {
      req.body = { question: 'Q1', answer: 'A1' };
      const mockFAQ = { _id: '1', question: 'Q1', answer: 'A1' };
      faqSaveStub.resolves(mockFAQ);

      await FAQController.createFaq(req as Request, res as Response);

      sinon.assert.calledOnce(faqSaveStub);
      sinon.assert.calledWith(res.status as sinon.SinonStub, 201);
      sinon.assert.calledWith(res.json as sinon.SinonStub, {
        id: '1',
        question: 'Q1',
        answer: 'A1',
        message: 'FAQ created. Translations in progress.',
      });
      sinon.assert.calledOnce(translateFAQStub);
    });

    it('should return 400 if question or answer is missing', async () => {
      req.body = { question: 'Q1' }; // Missing answer

      await FAQController.createFaq(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 400);
    });

    it('should handle database errors', async () => {
      req.body = { question: 'Q1', answer: 'A1' };
      faqSaveStub.rejects(new Error('Database error'));

      await FAQController.createFaq(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 500);
    });
  });

  describe('getFAQ', () => {
    it('should return FAQs with default language and original answers', async () => {
      const mockFAQs = [{
        _id: '1',
        question: 'Q1',
        answer: 'A1',
        translations: new Map(),
        getTranslatedQuestion: (lang: string) => 'Q1',
      }] as unknown as FAQDocument[];
      faqFindStub.resolves(mockFAQs);
      getCacheStub.resolves(null);

      await FAQController.getFAQ(req as Request, res as Response);

      sinon.assert.calledOnce(faqFindStub);
      sinon.assert.calledWith(res.json as sinon.SinonStub, [{
        id: '1',
        question: 'Q1',
        answer: 'A1',
      }]);
    });

    it('should return cached answer and translated question', async () => {
      const mockFAQs = [{
        _id: '1',
        question: 'Q1',
        answer: 'A1',
        translations: new Map([['es', 'Q1_es']]),
        getTranslatedQuestion: function (lang: string) {
          return this.translations.get(lang) || this.question;
        },
      }] as unknown as FAQDocument[];
      faqFindStub.resolves(mockFAQs);
      getCacheStub.resolves('Cached Answer');
      req.query = { lang: 'es' };

      await FAQController.getFAQ(req as Request, res as Response);

      sinon.assert.calledWith(res.json as sinon.SinonStub, [{
        id: '1',
        question: 'Q1_es',
        answer: 'Cached Answer',
      }]);
    });

    it('should return 500 if database access fails', async () => {
      faqFindStub.rejects(new Error('Database error'));

      await FAQController.getFAQ(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 500);
    });
  });

  describe('updateFAQ', () => {
    it('should update FAQ and invalidate cache', async () => {
      const mockFAQ = {
        _id: '1',
        question: 'Old Q',
        answer: 'Old A',
        save: sinon.stub().resolvesThis(),
      };
      faqFindByIdStub.resolves(mockFAQ);
      req.query = { id: '1' };
      req.body = { question: 'New Q' };

      await FAQController.updateFAQ(req as Request, res as Response);

      sinon.assert.calledOnce(mockFAQ.save);
      sinon.assert.calledWith(invalidateCacheStub, '1');
      sinon.assert.calledOnce(translateFAQStub);
      sinon.assert.calledWith(res.json as sinon.SinonStub, {
        id: '1',
        question: 'New Q',
        answer: 'Old A',
        message: 'FAQ updated. Retranslating content',
      });
    });

    it('should return 404 if FAQ not found', async () => {
      faqFindByIdStub.resolves(null);
      req.query = { id: 'invalid' };

      await FAQController.updateFAQ(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 404);
    });

    it('should handle database errors', async () => {
      faqFindByIdStub.rejects(new Error('Database error'));
      req.query = { id: '1' };

      await FAQController.updateFAQ(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 500);
    });
  });

  describe('deleteFAQ', () => {
    it('should delete FAQ and invalidate cache', async () => {
      faqFindByIdAndDeleteStub.resolves({ _id: '1' });
      req.query = { id: '1' };

      await FAQController.deleteFAQ(req as Request, res as Response);

      sinon.assert.calledWith(invalidateCacheStub, '1');
      sinon.assert.calledWith(res.json as sinon.SinonStub, {
        message: 'FAQ deleted',
        deletedId: '1',
      });
    });

    it('should return 404 if FAQ not found', async () => {
      faqFindByIdAndDeleteStub.resolves(null);
      req.query = { id: 'invalid' };

      await FAQController.deleteFAQ(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 404);
    });

    it('should handle database errors', async () => {
      faqFindByIdAndDeleteStub.rejects(new Error('Database error'));
      req.query = { id: '1' };

      await FAQController.deleteFAQ(req as Request, res as Response);

      sinon.assert.calledWith(res.status as sinon.SinonStub, 500);
    });
  });
});