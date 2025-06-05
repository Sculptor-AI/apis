import { v4 as uuidv4 } from 'uuid';
import { addHours } from 'date-fns';
import {
  NewsArticle,
  NewsGenerationTask,
  NewsGenerationCycle,
  NewsTopic,
  Source
} from '../types';
import {
  analyzeNewsTopic,
  configureNewsAgents,
  runNewsResearchAgent,
  synthesizeNewsArticle,
  extractHeadlineFromContent
} from './geminiService';
import { getStorageService } from './storageService';
import { ConfigService } from './configService';
import logger from '../utils/logger';

export class NewsGenerationService {
  private static instance: NewsGenerationService;
  private isGenerating: boolean = false;
  private currentCycle: NewsGenerationCycle | null = null;
  private configService: ConfigService;
  private storageService = getStorageService();

  private constructor() {
    this.configService = ConfigService.getInstance();
  }

  static getInstance(): NewsGenerationService {
    if (!NewsGenerationService.instance) {
      NewsGenerationService.instance = new NewsGenerationService();
    }
    return NewsGenerationService.instance;
  }

  async generateNewsCycle(force: boolean = false): Promise<NewsGenerationCycle> {
    if (this.isGenerating && !force) {
      throw new Error('News generation already in progress');
    }

    this.isGenerating = true;
    const config = this.configService.getConfig();
    const topicsConfig = this.configService.getTopicsConfig();

    const cycle: NewsGenerationCycle = {
      id: uuidv4(),
      startedAt: new Date(),
      status: 'running',
      articlesGenerated: 0,
      articlesDeleted: 0,
      tasks: []
    };

    this.currentCycle = cycle;
    await this.storageService.saveGenerationCycle(cycle);

    try {
      // Clean up expired articles first
      const expiredArticles = await this.storageService.getExpiredArticles();
      for (const article of expiredArticles) {
        await this.storageService.deleteArticle(article.id);
        cycle.articlesDeleted++;
      }

      // Determine which topics need articles
      const topicsNeedingArticles = await this.determineTopicsNeedingArticles(topicsConfig.topics);
      
      // Create generation tasks
      const tasks: NewsGenerationTask[] = [];
      for (const { topic, count } of topicsNeedingArticles) {
        for (let i = 0; i < count; i++) {
          const task: NewsGenerationTask = {
            id: uuidv4(),
            topicId: topic.id,
            topicName: topic.name,
            status: 'pending',
            progress: 0,
            startedAt: new Date()
          };
          tasks.push(task);
          cycle.tasks.push(task);
        }
      }

      // Process tasks with concurrency limit
      const maxConcurrent = config.maxConcurrentArticleGeneration;
      const results = await this.processTasksConcurrently(tasks, maxConcurrent);

      // Update cycle stats
      cycle.articlesGenerated = results.filter(r => r.success).length;
      cycle.completedAt = new Date();
      cycle.status = 'completed';

      await this.storageService.saveGenerationCycle(cycle);
      logger.info('News generation cycle completed', {
        cycleId: cycle.id,
        generated: cycle.articlesGenerated,
        deleted: cycle.articlesDeleted
      });

    } catch (error) {
      cycle.status = 'failed';
      cycle.completedAt = new Date();
      await this.storageService.saveGenerationCycle(cycle);
      logger.error('News generation cycle failed', { error, cycleId: cycle.id });
      throw error;
    } finally {
      this.isGenerating = false;
      this.currentCycle = null;
    }

    return cycle;
  }

  private async determineTopicsNeedingArticles(
    topics: NewsTopic[]
  ): Promise<{ topic: NewsTopic; count: number }[]> {
    const config = this.configService.getConfig();
    const topicsConfig = this.configService.getTopicsConfig();
    const currentCount = await this.storageService.getArticleCount();
    
    const result: { topic: NewsTopic; count: number }[] = [];
    
    // If we're below minimum, generate articles for all topics
    if (currentCount < config.minArticleCount) {
      const articlesNeeded = config.targetArticleCount - currentCount;
      const articlesPerTopic = Math.ceil(articlesNeeded / topics.length);
      
      for (const topic of topics) {
        const topicCount = await this.storageService.getArticleCountByTopic(topic.id);
        const needed = Math.min(
          articlesPerTopic,
          topic.maxArticles - topicCount
        );
        if (needed > 0) {
          result.push({ topic, count: needed });
        }
      }
      return result;
    }

    // Otherwise, check each topic's requirements
    for (const topic of topics) {
      const topicCount = await this.storageService.getArticleCountByTopic(topic.id);
      
      if (topicCount < topic.minArticles) {
        // Topic is below minimum
        result.push({ 
          topic, 
          count: topic.minArticles - topicCount 
        });
      } else if (currentCount < config.targetArticleCount && topicCount < topic.maxArticles) {
        // We're below target and topic has room
        const weight = topicsConfig.settings.balanceTopics
          ? (topic.priority / 5) * topicsConfig.settings.priorityWeight + 
            Math.random() * topicsConfig.settings.randomWeight
          : 1;
        
        if (weight > 0.5) {
          result.push({ topic, count: 1 });
        }
      }
    }

    return result;
  }

  private async processTasksConcurrently(
    tasks: NewsGenerationTask[],
    maxConcurrent: number
  ): Promise<{ taskId: string; success: boolean; articleId?: string }[]> {
    const results: { taskId: string; success: boolean; articleId?: string }[] = [];
    
    // Process in batches
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(task => this.generateArticleForTask(task));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const task = batch[index];
        if (result.status === 'fulfilled') {
          results.push({
            taskId: task.id,
            success: true,
            articleId: result.value
          });
        } else {
          results.push({
            taskId: task.id,
            success: false
          });
          logger.error('Article generation failed', {
            taskId: task.id,
            error: result.reason
          });
        }
      });
    }
    
    return results;
  }

  private async generateArticleForTask(task: NewsGenerationTask): Promise<string> {
    const config = this.configService.getConfig();
    const topicsConfig = this.configService.getTopicsConfig();
    const topic = topicsConfig.topics.find(t => t.id === task.topicId);
    
    if (!topic) {
      throw new Error(`Topic ${task.topicId} not found`);
    }

    try {
      // Update task status
      task.status = 'researching';
      task.progress = 10;

      // Step 1: Analyze topic and get research questions
      logger.debug('Analyzing news topic', { topic: topic.name });
      const topicAnalysis = await analyzeNewsTopic(topic);
      task.progress = 20;

      // Step 2: Configure research agents
      logger.debug('Configuring research agents', { questions: topicAnalysis.researchQuestions.length });
      const agents = await configureNewsAgents(
        topic.name,
        topicAnalysis.researchQuestions.slice(0, config.researchAgentsPerArticle)
      );
      task.progress = 30;

      // Step 3: Run research agents in parallel
      task.status = 'researching';
      logger.debug('Running research agents', { count: agents.length });
      const researchPromises = agents.map(agent => runNewsResearchAgent(agent));
      const researchResults = await Promise.all(researchPromises);
      task.progress = 70;

      // Collect all sources
      const allSources: Source[] = [];
      const sourceMap = new Map<string, Source>();
      
      for (const result of researchResults) {
        for (const source of result.sources) {
          if (!sourceMap.has(source.uri)) {
            const newSource = {
              ...source,
              id: allSources.length + 1
            };
            sourceMap.set(source.uri, newSource);
            allSources.push(newSource);
          }
        }
      }

      // Step 4: Synthesize article
      task.status = 'writing';
      logger.debug('Synthesizing article');
      const { content, summary } = await synthesizeNewsArticle(
        topicAnalysis.suggestedHeadline,
        researchResults,
        allSources
      );
      task.progress = 90;

      // Extract final headline from content
      let finalHeadline = extractHeadlineFromContent(content);
      
      // Prioritize the suggested headline if extraction fails or returns default
      if ((finalHeadline === 'Untitled Article' || !finalHeadline) && topicAnalysis.suggestedHeadline) {
        finalHeadline = topicAnalysis.suggestedHeadline;
      } else if (!finalHeadline && !topicAnalysis.suggestedHeadline) {
        // As a last resort, if both are empty, use a generic placeholder
        finalHeadline = 'Untitled Article'; 
      }

      // Calculate metadata
      const wordCount = content.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute

      // Create article
      const article: NewsArticle = {
        id: uuidv4(),
        topicId: topic.id,
        topicName: topic.name,
        headline: finalHeadline,
        summary,
        content,
        publishedAt: new Date(),
        updatedAt: new Date(),
        expiresAt: addHours(new Date(), config.articleLifetimeHours),
        status: 'published',
        sources: allSources,
        researchData: researchResults,
        metadata: {
          readingTime,
          wordCount,
          tags: topic.keywords.slice(0, 5)
        }
      };

      // Save article
      await this.storageService.saveArticle(article);
      
      // Update task
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date();
      task.articleId = article.id;

      logger.info('Article generated successfully', {
        articleId: article.id,
        topic: topic.name,
        headline: finalHeadline
      });

      return article.id;

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.completedAt = new Date();
      throw error;
    }
  }

  async generateSingleArticle(topicId: string): Promise<NewsArticle> {
    const topicsConfig = this.configService.getTopicsConfig();
    const topic = topicsConfig.topics.find(t => t.id === topicId);
    
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    const task: NewsGenerationTask = {
      id: uuidv4(),
      topicId: topic.id,
      topicName: topic.name,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    };

    const articleId = await this.generateArticleForTask(task);
    const article = await this.storageService.getArticle(articleId);
    
    if (!article) {
      throw new Error('Article generation failed');
    }

    return article;
  }

  isCurrentlyGenerating(): boolean {
    return this.isGenerating;
  }

  getCurrentCycle(): NewsGenerationCycle | null {
    return this.currentCycle;
  }
} 