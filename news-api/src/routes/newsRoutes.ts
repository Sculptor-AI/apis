import { Router, Request, Response } from 'express';
import { getStorageService } from '../services/storageService';
import { NewsGenerationService } from '../services/newsGenerationService';
import { ConfigService } from '../services/configService';
import { SchedulerService } from '../services/schedulerService';
import { 
  GetNewsRequest, 
  GenerateNewsRequest,
  NewsApiResponse,
  GetNewsResponse,
  GenerateNewsResponse,
  NewsStats
} from '../types';
import { ERROR_MESSAGES } from '../constants';
import logger from '../utils/logger';

const router = Router();
const storageService = getStorageService();
const generationService = NewsGenerationService.getInstance();
const configService = ConfigService.getInstance();
const schedulerService = SchedulerService.getInstance();

// GET /api/news - Get news articles
router.get('/news', async (req: Request, res: Response) => {
  try {
    const query: GetNewsRequest = {
      topicId: req.query.topicId as string,
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      sortBy: (req.query.sortBy as 'publishedAt' | 'topicId') || 'publishedAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    };

    const articles = await storageService.getArticles(query);
    const total = await storageService.getArticleCount();

    const response: NewsApiResponse<GetNewsResponse> = {
      success: true,
      data: {
        articles,
        total,
        limit: query.limit!,
        offset: query.offset!
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching news', { error });
    res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/:id - Get single article
router.get('/news/:id', async (req: Request, res: Response) => {
  try {
    const article = await storageService.getArticle(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.ARTICLE_NOT_FOUND,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      data: article,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching article', { error, id: req.params.id });
    return res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/news/topic/:topicId - Get articles by topic
router.get('/news/topic/:topicId', async (req: Request, res: Response) => {
  try {
    const articles = await storageService.getArticlesByTopic(req.params.topicId);
    
    res.json({
      success: true,
      data: {
        articles,
        total: articles.length,
        topicId: req.params.topicId
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching articles by topic', { error, topicId: req.params.topicId });
    res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/generate - Trigger news generation
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const request: GenerateNewsRequest = req.body;
    
    if (generationService.isCurrentlyGenerating() && !request.force) {
      return res.status(409).json({
        success: false,
        error: ERROR_MESSAGES.GENERATION_IN_PROGRESS,
        timestamp: new Date().toISOString()
      });
    }

    // If specific topic requested, generate single article
    if (request.topicId) {
      const article = await generationService.generateSingleArticle(request.topicId);
      return res.json({
        success: true,
        data: {
          cycleId: 'single-article',
          tasksCreated: 1,
          message: `Article generated for topic: ${article.topicName}`,
          articleId: article.id
        },
        timestamp: new Date().toISOString()
      });
    }

    // Otherwise, start a full generation cycle
    const cycle = await generationService.generateNewsCycle(request.force);
    
    const response: NewsApiResponse<GenerateNewsResponse> = {
      success: true,
      data: {
        cycleId: cycle.id,
        tasksCreated: cycle.tasks.length,
        message: `News generation cycle started with ${cycle.tasks.length} tasks`
      },
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error generating news', { error });
    return res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.GENERATION_FAILED,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/stats - Get news statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await storageService.getStats();
    const nextGeneration = schedulerService.getNextScheduledTime();
    
    const enrichedStats: NewsStats = {
      ...stats,
      nextGenerationTime: nextGeneration || undefined
    };

    res.json({
      success: true,
      data: enrichedStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching stats', { error });
    res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/topics - Get configured topics
router.get('/topics', async (_req: Request, res: Response) => {
  try {
    const topicsConfig = configService.getTopicsConfig();
    
    res.json({
      success: true,
      data: topicsConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching topics', { error });
    res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health - Health check
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const validation = configService.validateConfig();
    const isSchedulerRunning = schedulerService.isRunning();
    const articleCount = await storageService.getArticleCount();
    
    res.json({
      success: true,
      data: {
        status: validation.valid ? 'healthy' : 'unhealthy',
        configValid: validation.valid,
        configErrors: validation.errors,
        schedulerRunning: isSchedulerRunning,
        articleCount,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in health check', { error });
    res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 