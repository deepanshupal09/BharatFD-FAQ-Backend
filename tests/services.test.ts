import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { FAQDocument } from '../model/faqModel';
import * as cacheService from '../service/cacheService';
import { translateFAQ } from '../service/translationService';
import { redisClient } from '../config/redis';
import {
    getCacheTranslation,
    setCacheTranslation,
    invalidateCache,
  } from '../service/cacheService';

describe('TranslationService', () => {
  let faqStub: FAQDocument;
  let axiosPostStub: sinon.SinonStub;
  let setCacheStub: sinon.SinonStub;

  beforeEach(() => {
    // Mock FAQ document
    faqStub = {
      _id: '123',
      question: 'Sample question',
      answer: '<p>Sample answer</p>',
      translations: new Map(),
      save: sinon.stub().resolvesThis(),
    } as unknown as FAQDocument;

    // Stub external dependencies
    axiosPostStub = sinon.stub(axios, 'post');
    setCacheStub = sinon.stub(cacheService, 'setCacheTranslation').resolves();
    
    // Setup environment variable
    process.env.GOOGLE_TRANSLATE_KEY = 'test-key';
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.GOOGLE_TRANSLATE_KEY;
  });

  describe('translateFAQ', () => {
    it('should translate FAQ to all target languages and cache results', async () => {
      // Mock successful API responses
      axiosPostStub.resolves({
        data: {
          data: {
            translations: [{
              translatedText: 'Translated text'
            }]
          }
        }
      });

      await translateFAQ(faqStub);

      // Verify number of API calls (2 per language: question + answer)
      expect(axiosPostStub.callCount).to.equal(8); // 4 languages * 2 calls

      // Verify cache calls
      expect(setCacheStub.callCount).to.equal(4); // 4 languages

      // Verify translations map updates
      expect(faqStub.translations?.size).to.equal(4);
      expect(faqStub.translations?.get('hi')).to.equal('Translated text');
      
      // Verify FAQ save
      sinon.assert.calledOnce(faqStub.save as sinon.SinonStub);
    });

    it('should initialize translations map if not present', async () => {

    delete faqStub.translations;
 
      axiosPostStub.resolves({
        data: {
          data: {
            translations: [{
              translatedText: 'Translated text'
            }]
          }
        }
      });

      await translateFAQ(faqStub);
      
      expect(faqStub.translations).to.be.instanceOf(Map);
      if (!faqStub.translations) {
        faqStub.translations = new Map<string, string>();
      }
      expect(faqStub.translations.size).to.equal(4);
          });

    it('should throw error when API call fails', async () => {
      axiosPostStub.rejects(new Error('API Error'));
      
      try {
        await translateFAQ(faqStub);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect((err as Error).message).to.equal('Translation failed');
      }
    });

    it('should handle Axios error responses', async () => {
      const errorResponse = {
        response: {
          data: {
            error: 'Invalid API key'
          }
        },
        isAxiosError: true
      };
      axiosPostStub.rejects(errorResponse);

      try {
        await translateFAQ(faqStub);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect((err as Error).message).to.equal('Translation failed');
      }
    });

    it('should handle cache service failures gracefully', async () => {
      axiosPostStub.resolves({
        data: {
          data: {
            translations: [{
              translatedText: 'Translated text'
            }]
          }
        }
      });
      setCacheStub.resolves();

      await translateFAQ(faqStub);

      // Should still complete translations despite cache errors
      expect(faqStub.translations?.size).to.equal(4);
      sinon.assert.calledOnce(faqStub.save as sinon.SinonStub);
    });

    it('should handle missing API key', async () => {
      delete process.env.GOOGLE_TRANSLATE_KEY;
      
      try {
        await translateFAQ(faqStub);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect((err as Error).message).to.equal('Translation failed');
      }
    });

    it('should handle unexpected API response format', async () => {
      axiosPostStub.resolves({
        data: {
          invalid: 'response'
        }
      });

      try {
        await translateFAQ(faqStub);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect((err as Error).message).to.equal('Translation failed');
      }
    });

    it('should handle FAQ save failure', async () => {
      axiosPostStub.resolves({
        data: {
          data: {
            translations: [{
              translatedText: 'Translated text'
            }]
          }
        }
      });
      (faqStub.save as sinon.SinonStub).rejects(new Error('Save failed'));

      try {
        await translateFAQ(faqStub);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect((err as Error).message).to.equal('Translation failed');
      }
    });
  });
});

describe('CacheService', () => {
    let redisGetStub: sinon.SinonStub;
    let redisSetStub: sinon.SinonStub;
    let redisKeysStub: sinon.SinonStub;
    let redisDelStub: sinon.SinonStub;
  
    beforeEach(() => {
      // Stub Redis client methods
      redisGetStub = sinon.stub(redisClient, 'get');
      redisSetStub = sinon.stub(redisClient, 'set');
      redisKeysStub = sinon.stub(redisClient, 'keys');
      redisDelStub = sinon.stub(redisClient, 'del');
    });
  
    afterEach(() => {
      sinon.restore();
    });
  
    describe('getCacheTranslation', () => {
      it('should return cached translation if it exists', async () => {
        const id = '123';
        const lang = 'es';
        const cachedAnswer = 'Cached answer';
        redisGetStub.resolves(cachedAnswer);
  
        const result = await getCacheTranslation(id, lang);
  
        expect(result).to.equal(cachedAnswer);
        sinon.assert.calledOnceWithExactly(redisGetStub, `faq:${id}:${lang}`);
      });
  
      it('should return null if cache key does not exist', async () => {
        const id = '123';
        const lang = 'es';
        redisGetStub.resolves(null);
  
        const result = await getCacheTranslation(id, lang);
  
        expect(result).to.be.null;
        sinon.assert.calledOnceWithExactly(redisGetStub, `faq:${id}:${lang}`);
      });
  
      it('should return null and log error if Redis get fails', async () => {
        const id = '123';
        const lang = 'es';
        const error = new Error('Redis connection failed');
        redisGetStub.rejects(error);
  
        const result = await getCacheTranslation(id, lang);
  
        expect(result).to.be.null;
        sinon.assert.calledOnceWithExactly(redisGetStub, `faq:${id}:${lang}`);
      });
    });
  
    describe('setCacheTranslation', () => {
      it('should set cache translation with expiration', async () => {
        const id = '123';
        const lang = 'es';
        const answer = 'Translated answer';
  
        await setCacheTranslation(id, lang, answer);
  
        sinon.assert.calledOnceWithExactly(
          redisSetStub,
          `faq:${id}:${lang}`,
          answer,
          { EX: 3600 }
        );
      });
  
      it('should log error if Redis set fails', async () => {
        const id = '123';
        const lang = 'es';
        const answer = 'Translated answer';
        const error = new Error('Redis connection failed');
        redisSetStub.rejects(error);
  
        await setCacheTranslation(id, lang, answer);
  
        sinon.assert.calledOnceWithExactly(
          redisSetStub,
          `faq:${id}:${lang}`,
          answer,
          { EX: 3600 }
        );
      });
    });
  
    describe('invalidateCache', () => {
      it('should delete all cache keys matching the pattern', async () => {
        const id = '123';
        const pattern = `faq:${id}:*`;
        const keys = [`faq:${id}:es`, `faq:${id}:fr`];
        redisKeysStub.resolves(keys);
        redisDelStub.resolves(1);
  
        await invalidateCache(id);
  
        sinon.assert.calledOnceWithExactly(redisKeysStub, pattern);
        sinon.assert.calledOnceWithExactly(redisDelStub, keys);
      });
  
      it('should do nothing if no keys match the pattern', async () => {
        const id = '123';
        const pattern = `faq:${id}:*`;
        redisKeysStub.resolves([]);
  
        await invalidateCache(id);
  
        sinon.assert.calledOnceWithExactly(redisKeysStub, pattern);
        sinon.assert.notCalled(redisDelStub);
      });
  
      it('should log error if Redis keys or del fails', async () => {
        const id = '123';
        const pattern = `faq:${id}:*`;
        const error = new Error('Redis connection failed');
        redisKeysStub.rejects(error);
  
        await invalidateCache(id);
  
        sinon.assert.calledOnceWithExactly(redisKeysStub, pattern);
        sinon.assert.notCalled(redisDelStub);
      });
    });
  });