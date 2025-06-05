// News Article Types
export interface NewsArticle {
  id: string;
  topicId: string;
  topicName: string;
  headline: string;
  summary: string;
  content: string;
  publishedAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  status: 'draft' | 'published' | 'archived';
  sources: Source[];
  researchData?: AgentResearchResult[];
  metadata: ArticleMetadata;
}

export interface ArticleMetadata {
  readingTime: number; // in minutes
  wordCount: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  tags: string[];
  imageUrl?: string;
}

// Topic Configuration
export interface NewsTopic {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  priority: number; // 1 (highest) to 5 (lowest)
  minArticles: number;
  maxArticles: number;
}

export interface TopicsConfig {
  topics: NewsTopic[];
  settings: {
    balanceTopics: boolean;
    priorityWeight: number;
    randomWeight: number;
    refreshTopicsHours: number;
  };
}

// Research Agent Types (adapted from deep-research-api)
export interface NewsResearchAgent {
  name: string;
  focus: string;
  temperature: number;
  researchQuestion?: string;
}

export interface Source {
  id: number;
  uri: string;
  title: string;
}

export interface AgentResearchResult {
  agentName: string;
  researchQuestion: string;
  researchSummary: string;
  sources: Source[];
}

// News Generation Types
export interface NewsGenerationTask {
  id: string;
  topicId: string;
  topicName: string;
  status: 'pending' | 'researching' | 'writing' | 'completed' | 'failed';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  articleId?: string;
}

export interface NewsGenerationCycle {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  articlesGenerated: number;
  articlesDeleted: number;
  tasks: NewsGenerationTask[];
}

// API Request/Response Types
export interface NewsApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface GetNewsRequest {
  topicId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'publishedAt' | 'topicId';
  sortOrder?: 'asc' | 'desc';
}

export interface GetNewsResponse {
  articles: NewsArticle[];
  total: number;
  limit: number;
  offset: number;
}

export interface GenerateNewsRequest {
  topicId?: string;
  count?: number;
  force?: boolean; // Force generation even if within limits
}

export interface GenerateNewsResponse {
  cycleId: string;
  tasksCreated: number;
  message: string;
}

export interface NewsStats {
  totalArticles: number;
  articlesByTopic: { [topicId: string]: number };
  oldestArticle?: Date;
  newestArticle?: Date;
  nextGenerationTime?: Date;
  lastGenerationCycle?: NewsGenerationCycle;
}

// Configuration Types
export interface NewsApiConfig {
  apiKey: string;
  port: number;
  nodeEnv: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  allowedOrigins: string[];
  newsGenerationSchedule: string;
  targetArticleCount: number;
  minArticleCount: number;
  maxArticleCount: number;
  articleLifetimeHours: number;
  researchAgentsPerArticle: number;
  autoStartGeneration: boolean;
  logLevel: string;
  logToFile: boolean;
  usePersistentStorage: boolean;
  databasePath: string;
  geminiTextModel: string;
  geminiSynthesisModel: string;
  maxConcurrentArticleGeneration: number;
  generationTimeoutMs: number;
}

// Error Types
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// Service Types
export interface NewsStorageService {
  getArticles(filter?: Partial<GetNewsRequest>): Promise<NewsArticle[]>;
  getArticle(id: string): Promise<NewsArticle | null>;
  saveArticle(article: NewsArticle): Promise<void>;
  updateArticle(id: string, updates: Partial<NewsArticle>): Promise<void>;
  deleteArticle(id: string): Promise<void>;
  getArticlesByTopic(topicId: string): Promise<NewsArticle[]>;
  getExpiredArticles(): Promise<NewsArticle[]>;
  getStats(): Promise<NewsStats>;
} 