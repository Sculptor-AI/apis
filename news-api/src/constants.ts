import { NewsApiConfig } from './types';

// Default configuration values
export const DEFAULT_CONFIG: Partial<NewsApiConfig> = {
  port: 3001,
  nodeEnv: 'development',
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: 100,
  allowedOrigins: ['http://localhost:3001', 'http://localhost:5173'],
  newsGenerationSchedule: '0 */6 * * *', // Every 6 hours
  targetArticleCount: 20,
  minArticleCount: 10,
  maxArticleCount: 30,
  articleLifetimeHours: 72,
  researchAgentsPerArticle: 5,
  autoStartGeneration: false,
  logLevel: 'info',
  logToFile: true,
  usePersistentStorage: false,
  databasePath: './data/news.db',
  geminiTextModel: 'gemini-2.5-flash-preview-04-17',
  geminiSynthesisModel: 'gemini-2.5-pro-preview-05-06',
  maxConcurrentArticleGeneration: 3,
  generationTimeoutMs: 300000, // 5 minutes
};

// Gemini Model Names
export const GEMINI_FLASH_MODEL = 'gemini-2.5-flash-preview-04-17';
export const GEMINI_PRO_MODEL = 'gemini-2.5-pro-preview-05-06';

// Agent Configuration
export const MAX_RESEARCH_AGENTS = 5;
export const MIN_RESEARCH_AGENTS = 1;
export const DEFAULT_AGENT_TEMPERATURE = 0.7;

// News Generation Prompts
export const NEWS_TOPIC_ANALYSIS_PROMPT = (topic: string, keywords: string[]) => `
Analyze the following news topic and generate a compelling, current news angle:

Topic: ${topic}
Keywords: ${keywords.join(', ')}

Your task is to:
1. Identify the most newsworthy and current aspect of this topic
2. Generate a specific news angle that would be relevant today
3. Suggest a headline that captures attention
4. Provide 3-5 specific research questions that agents should investigate

Format your response as JSON:
{
  "newsAngle": "Specific current angle for the story",
  "suggestedHeadline": "Compelling headline",
  "researchQuestions": [
    "Question 1",
    "Question 2",
    "Question 3"
  ]
}
`;

export const RESEARCH_AGENT_PROMPT = (agentName: string, focus: string, question: string) => `
You are ${agentName}, a specialized news research agent.

Your focus: ${focus}
Your specific research question: ${question}

Conduct thorough research using Google Search to answer your research question. 
Focus on:
- Recent developments (within the last week if possible)
- Credible sources and official statements
- Specific facts, figures, and quotes
- Multiple perspectives on the issue

Provide a comprehensive research summary that directly addresses your research question.
`;

export const NEWS_SYNTHESIS_PROMPT = `
You are a professional news writer for a modern digital news platform. 

Based on the research provided by multiple agents, write a compelling news article that:

1. **Headline**: Create an attention-grabbing but accurate headline
2. **Lead**: Write a strong opening paragraph that summarizes the key news
3. **Body**: 
   - Present the information in inverted pyramid style (most important first)
   - Include relevant quotes and statistics from the research
   - Provide context and background
   - Present multiple perspectives where appropriate
   - Use clear, concise language suitable for a general audience
4. **Conclusion**: End with implications or what to expect next

Style Guidelines:
- Write in third person
- Use active voice
- Keep paragraphs short (2-3 sentences)
- Include specific details and examples
- Maintain objectivity and balance
- Target length: 500-800 words

Format the article in Markdown with proper structure.
Include citations in the format [1], [2], etc. for sources.
`;

export const AGENT_CONFIGURATION_PROMPT = (topic: string, researchQuestions: string[]) => `
Based on the news topic "${topic}" and these research questions:
${researchQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Configure ${researchQuestions.length} specialized research agents. For each agent, provide:
- A unique, descriptive name
- A specific research focus that addresses one of the questions
- An appropriate temperature (0.3-0.9) based on the type of research needed

Return as JSON:
{
  "agents": [
    {
      "name": "Agent Name",
      "focus": "Specific research focus",
      "temperature": 0.7
    }
  ]
}
`;

// API Endpoints
export const API_ENDPOINTS = {
  NEWS: '/api/news',
  NEWS_BY_ID: '/api/news/:id',
  NEWS_BY_TOPIC: '/api/news/topic/:topicId',
  GENERATE: '/api/generate',
  STATS: '/api/stats',
  TOPICS: '/api/topics',
  HEALTH: '/api/health',
  DOCS: '/docs',
  API_DOCS: '/api-docs',
};

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_API_KEY: 'Invalid or missing API key',
  ARTICLE_NOT_FOUND: 'Article not found',
  TOPIC_NOT_FOUND: 'Topic not found',
  GENERATION_IN_PROGRESS: 'News generation already in progress',
  GENERATION_FAILED: 'Failed to generate news article',
  INVALID_REQUEST: 'Invalid request parameters',
  INTERNAL_ERROR: 'Internal server error',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
};

// Validation Constants
export const VALIDATION = {
  MIN_HEADLINE_LENGTH: 10,
  MAX_HEADLINE_LENGTH: 200,
  MIN_CONTENT_LENGTH: 100,
  MAX_CONTENT_LENGTH: 10000,
  MIN_SUMMARY_LENGTH: 50,
  MAX_SUMMARY_LENGTH: 500,
};

// Cron Schedule Presets
export const CRON_PRESETS = {
  EVERY_30_MINUTES: '*/30 * * * *',
  HOURLY: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  TWICE_DAILY: '0 9,18 * * *',
  DAILY: '0 0 * * *',
};

// Storage Keys
export const STORAGE_KEYS = {
  ARTICLES: 'news:articles',
  GENERATION_CYCLES: 'news:cycles',
  LAST_GENERATION: 'news:last_generation',
  STATS: 'news:stats',
}; 