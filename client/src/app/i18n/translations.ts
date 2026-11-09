export type Language = 'en' | 'zhTW';

export interface Translations {
  home: string;
  topHeadlines: string;
  country: string;
  category: string;
  search: string;
  searchPlaceholder: string;
  allCategories: string;
  technology: string;
  business: string;
  science: string;
  health: string;
  lifestyle: string;
  climate: string;
  sports: string;
  general: string;
  english: string;
  bahasa: string;
  zhSimplified: string;
  zhTraditional: string;
  sentiment: string;
  positive: string;
  neutral: string;
  negative: string;
  trending: string;
  trendingTopics: string;
  audienceEngagement: string;
  sentimentDistribution: string;
  source: string;
  author: string;
  publishedAt: string;
  readMore: string;
  loading: string;
  loadMore: string;
  previous: string;
  next: string;
  goToSlide: string;
  page: string;
  of: string;
  account: string;
  bookmarks: string;
  bookmark: string;
  bookmarked: string;
  settings: string;
  language: string;
  signIn: string;
  signOut: string;
  appearance: string;
  changePhoto: string;
  removePhoto: string;
  darkMode: string;
  lightMode: string;
  profile: string;
  viewProfile: string;
  editProfile: string;
  usernameLabel: string;
  saveChanges: string;
  profileUpdated: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  passwordChanged: string;
  googleAccount: string;
  googleLinked: string;
  googleNotLinked: string;
  linkGoogle: string;
  disconnectGoogle: string;
  googleDisconnectWarning: string;
  showPassword: string;
  hidePassword: string;
  deleteAccount: string;
  deleteAccountWarning: string;
  confirmDelete: string;
  memberSince: string;
  lastActive: string;
  avatarUpdated: string;
  avatarInvalid: string;
  myPosts: string;
  cancel: string;
  createAccount: string;
  addAccount: string;
  loggedInAs: string;
  scrollToTop: string;
  articleSentiment: string;
  emotionBreakdown: string;
  topicKeywords: string;
  comments: string;
  writeComment: string;
  reply: string;
  joy: string;
  sadness: string;
  anger: string;
  fear: string;
  surprise: string;
  backToHome: string;
  filterByCountry: string;
  selectLanguage: string;
  noResults: string;
  translating: string;
  autoTranslated: string;
  translateAll: string;
  noTranslation: string;
  quoteOfDay: string;
  filter: string;
  filters: string;
  byCategory: string;
  bySource: string;
  bySentiment: string;
  sort: string;
  topStories: string;
  newestFirst: string;
  oldestFirst: string;
  mostRelevant: string;
  allSources: string;
  allSentiment: string;
  clearFilters: string;
  sources: string;
  metricsGlossaryTitle: string;
  aiConfidenceTerm: string;
  aiConfidenceDesc: string;
  toxicityTerm: string;
  toxicityDesc: string;
  readingGradeTerm: string;
  readingGradeDesc: string;
  fleschTerm: string;
  fleschDesc: string;
  smogTerm: string;
  smogDesc: string;
  sentimentMathTitle: string;
  sentimentMathDesc: string;
  // Shell / X-layout
  posts: string;
  pulse: string;
  insights: string;
  viewAllPosts: string;
  postsComingSoon: string;
  whatsHappening: string;
  signInToPost: string;
  post: string;
  postFailed: string;
  deletePost: string;
  articleUnavailable: string;
  quoteThis: string;
  attachedArticle: string;
  noPostsYet: string;
  askAI: string;
  askModel: string;
  chatAbout: string;
  chatWelcome: string;
  chatPlaceholder: string;
  clearChat: string;
  chatSources: string;
  chatClose: string;
  chatSend: string;
  chatGrounded: string;
  chatSuggestions: string[];
  translateNews: string;
  translateNewsOff: string;
  translateNewsOn: string;
  confidenceNote: string;
  labelRuleNote: string;
  sentimentFallbackRule: string;
  insightsNote: string;
  methodologyTitle: string;
  reportIssue: string;
  reportIssueTitle: string;
  reportIssueHint: string;
  reportReasons: string[];
  reportMessagePlaceholder: string;
  reportSubmit: string;
  reportSent: string;
  reportFailed: string;
  newsOriginalShort: string;
  aiUnavailable: string;
  pageNotFound: string;
  errorTitle: string;
  fetchFailed: string;
  tryDifferent: string;
  newsLabel: string;
  googleCompleteSignup: string;
  menu: string;
  // Markets (Business view)
  markets: string;
  delayedData: string;
  businessTrend: string;
  articlesPerDay: string;
  avgTone: string;
  // Footer
  footerTagline: string;
  navigate: string;
  newsSources: string;
  legalInfo: string;
  termsOfService: string;
  privacyPolicy: string;
  poweredByNLP: string;
  allRightsReserved: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    home: 'Home',
    topHeadlines: 'Top Headlines',
    country: 'Country',
    category: 'Category',
    search: 'Search',
    searchPlaceholder: 'Search news, topics, sources...',
    allCategories: 'All Categories',
    technology: 'Technology',
    business: 'Business',
    science: 'Science',
    health: 'Health',
    lifestyle: 'Lifestyle',
    climate: 'Climate',
    sports: 'Sports',
    general: 'General',
    english: 'English',
    bahasa: 'Bahasa Indonesia',
    zhSimplified: '简体中文',
    zhTraditional: '繁體中文',
    sentiment: 'Sentiment',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    trending: 'Trending',
    trendingTopics: 'Trending topics',
    audienceEngagement: 'Audience Engagement',
    sentimentDistribution: 'Sentiment distribution',
    source: 'Source',
    author: 'Author',
    publishedAt: 'Published At',
    readMore: 'Read More',
    loading: 'Loading...',
    loadMore: 'Load More',
    previous: 'Previous',
    next: 'Next',
    goToSlide: 'Go to slide',
    page: 'Page',
    of: 'of',
    account: 'Account',
    bookmarks: 'Bookmarks',
    bookmark: 'Bookmark',
    bookmarked: 'Saved',
    settings: 'Settings',
    language: 'Language',
    signIn: 'Sign in',
    signOut: 'Sign out',
    appearance: 'Appearance',
    changePhoto: 'Change photo',
    removePhoto: 'Remove photo',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    profile: 'Profile',
    viewProfile: 'View profile',
    editProfile: 'Edit profile',
    usernameLabel: 'Username',
    saveChanges: 'Save changes',
    profileUpdated: 'Profile updated',
    changePassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    passwordChanged: 'Password changed',
    googleAccount: 'Google account',
    googleLinked: 'Connected for sign-in',
    googleNotLinked: 'Not connected',
    linkGoogle: 'Link Google account',
    disconnectGoogle: 'Disconnect Google account',
    googleDisconnectWarning:
      'You will sign in with your NewsAgg email and password after disconnecting.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    deleteAccount: 'Delete account',
    deleteAccountWarning:
      'This permanently deletes your account, bookmarks and posts. This cannot be undone.',
    confirmDelete: 'Yes, delete my account',
    memberSince: 'Joined',
    lastActive: 'Last active',
    avatarUpdated: 'Photo updated',
    avatarInvalid: 'Could not read that image',
    myPosts: 'My Posts',
    cancel: 'Cancel',
    createAccount: 'Create New Account',
    addAccount: 'Add Existing Account',
    loggedInAs: 'Logged in as',
    scrollToTop: 'Scroll to top',
    articleSentiment: 'Article sentiment',
    emotionBreakdown: 'Sentiment probabilities',
    topicKeywords: 'Topic Keywords',
    comments: 'Comments',
    writeComment: 'Write a comment...',
    reply: 'Reply',
    joy: 'Joy',
    sadness: 'Sadness',
    anger: 'Anger',
    fear: 'Fear',
    surprise: 'Surprise',
    backToHome: 'Back to Home',
    filterByCountry: 'Filter by Country',
    selectLanguage: 'Language',
    noResults: 'No results found',
    translating: 'Translating…',
    autoTranslated: 'Auto-translated',
    translateAll: 'Translate',
    noTranslation: 'Translation unavailable',
    quoteOfDay: 'Quote of the Day',
    filter: 'Filter',
    filters: 'Filters',
    // Filter panel tabs: one short word each, so they fit on one line.
    byCategory: 'Category',
    bySource: 'Source',
    bySentiment: 'Sentiment',
    sort: 'Sort',
    topStories: 'Top stories',
    newestFirst: 'Newest first',
    oldestFirst: 'Oldest first',
    mostRelevant: 'Most relevant',
    allSources: 'All Sources',
    allSentiment: 'All Sentiment',
    clearFilters: 'Clear',
    sources: 'Sources',
    metricsGlossaryTitle: 'Understanding these metrics',
    aiConfidenceTerm: 'AI confidence',
    aiConfidenceDesc:
      'How sure the classification model is that this article belongs to its detected topic, from 0 to 100%. Higher means a clearer topic match.',
    toxicityTerm: 'Toxicity score',
    toxicityDesc:
      'Likelihood that the text contains rude, disrespectful, or harmful language, scored 0 to 100% by a moderation model. Most news sits very low.',
    readingGradeTerm: 'Reading grade (Flesch–Kincaid)',
    readingGradeDesc:
      'The US school grade level needed to read the text easily. 8 means a typical 8th-grader can follow it; higher numbers are harder.',
    fleschTerm: 'Flesch reading ease',
    fleschDesc:
      'A 0–100 readability score — higher is easier. 60–70 is plain English; below 30 is dense and academic.',
    smogTerm: 'SMOG index',
    smogDesc:
      'Estimates the years of education needed to understand the text, based on sentence length and complex words. Lower is more accessible.',
    sentimentMathTitle: 'How sentiment is decided',
    sentimentMathDesc:
      'XLM-RoBERTa (FinBERT for English business stories) scores up to three 1,400-character passages of each article (first, middle, last) for positive, neutral and negative probability, weighted by passage length. Polarity is positive minus negative, and the gradient bar plots it. The label is chosen by these rules, in order:',
    posts: 'Posts',
    pulse: 'Pulse',
    insights: 'Insights',
    viewAllPosts: 'View all posts',
    postsComingSoon: 'Posts are coming soon',
    whatsHappening: "What's happening?",
    signInToPost: 'Sign in to post',
    post: 'Post',
    postFailed: 'Could not publish your post',
    deletePost: 'Delete post',
    articleUnavailable: 'Article no longer available',
    quoteThis: 'Quote this',
    attachedArticle: 'Attached article',
    noPostsYet: 'No posts yet — be the first to share something',
    askAI: 'Ask AI',
    askModel: 'Ask {model}',
    chatAbout: 'About:',
    chatWelcome: "Ask me anything about this article and I'll answer based on its content.",
    chatPlaceholder: 'Ask about this article...',
    clearChat: 'Clear chat',
    chatSources: 'Source passages',
    chatClose: 'Close chat',
    chatSend: 'Send message',
    chatGrounded: 'Answers use only this article.',
    chatSuggestions: ['Summarise this article', 'What are the key facts?', 'Why does this matter?'],
    translateNews: 'Translate news',
    translateNewsOff: 'Off — stories stay in the language they were published in.',
    translateNewsOn: 'On — headlines and articles are translated into the interface language.',
    confidenceNote: 'Confidence is the probability the model gave its chosen label. It is not measured accuracy and does not say whether the story is true.',
    labelRuleNote: 'The label follows an ordered rule (neutral band first, then polarity ±0.10), so it can differ from the largest bar.',
    sentimentFallbackRule: 'Otherwise: the class with the highest probability',
    insightsNote: 'Counts describe NewsAgg\'s published dataset from four publishers. Sentiment describes wording, not truth, publisher ideology or public opinion. Trending ranks keyword frequency; it is not a forecast.',
    methodologyTitle: 'How NewsAgg works',
    reportIssue: 'Report an issue',
    reportIssueTitle: 'Report a problem with this article',
    reportIssueHint: 'Tell the team what looks wrong. People review every report; nothing on the article changes automatically.',
    reportReasons: ['Sentiment looks wrong', 'Wrong topic', 'Summary misses or distorts something', 'Translation problem', 'Text extraction problem', 'Something else'],
    reportMessagePlaceholder: 'Optional details (up to 1,000 characters)',
    reportSubmit: 'Send report',
    reportSent: 'Thanks — the team will review it.',
    reportFailed: 'The report could not be sent. Please try again later.',
    newsOriginalShort: 'Original',
    aiUnavailable: 'Sorry, the AI assistant is unavailable right now.',
    pageNotFound: 'Page not found',
    errorTitle: 'Error',
    fetchFailed: 'Failed to fetch news. Please check your connection.',
    tryDifferent: 'Try a different search or category',
    newsLabel: 'News',
    googleCompleteSignup: 'Almost there — set a password to finish creating your account',
    menu: 'Menu',
    markets: 'Markets',
    delayedData: 'Delayed',
    businessTrend: 'Business pulse — 14 days',
    articlesPerDay: 'Articles/day',
    avgTone: 'Avg tone',
    footerTagline: 'Automated Multilingual News Aggregation with NLP Sentiment Analysis and Topic Insights Dashboard',
    navigate: 'Navigate',
    newsSources: 'Sources',
    legalInfo: 'Legal & info',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    poweredByNLP: 'Powered by NLP Sentiment Analysis',
    allRightsReserved: 'All rights reserved.',
  },
  zhTW: {
    home: '首頁',
    topHeadlines: '頭條新聞',
    country: '國家',
    category: '分類',
    search: '搜尋',
    searchPlaceholder: '搜尋新聞、話題、來源...',
    allCategories: '所有分類',
    technology: '科技',
    business: '商業',
    science: '科學',
    health: '健康',
    lifestyle: '生活',
    climate: '氣候',
    sports: '體育',
    general: '綜合',
    english: 'English',
    bahasa: 'Bahasa Indonesia',
    zhSimplified: '简体中文',
    zhTraditional: '繁體中文',
    sentiment: '情緒',
    positive: '正面',
    neutral: '中性',
    negative: '負面',
    trending: '熱門',
    trendingTopics: '熱門話題',
    audienceEngagement: '受眾參與度',
    sentimentDistribution: '情緒分布',
    source: '來源',
    author: '作者',
    publishedAt: '發布時間',
    readMore: '閱讀更多',
    loading: '載入中...',
    loadMore: '載入更多',
    previous: '上一頁',
    next: '下一頁',
    goToSlide: '跳轉到第',
    page: '第',
    of: '頁，共',
    account: '帳戶',
    bookmarks: '書籤',
    bookmark: '收藏',
    bookmarked: '已收藏',
    settings: '設定',
    language: '語言',
    signIn: '登入',
    signOut: '登出',
    appearance: '外觀',
    changePhoto: '更換頭像',
    removePhoto: '移除頭像',
    darkMode: '深色模式',
    lightMode: '淺色模式',
    profile: '個人資料',
    viewProfile: '查看資料',
    editProfile: '編輯資料',
    usernameLabel: '用戶名',
    saveChanges: '儲存變更',
    profileUpdated: '資料已更新',
    changePassword: '修改密碼',
    currentPassword: '目前密碼',
    newPassword: '新密碼',
    passwordChanged: '密碼已修改',
    googleAccount: 'Google 帳戶',
    googleLinked: '已連結用於登入',
    googleNotLinked: '尚未連結',
    linkGoogle: '連結 Google 帳戶',
    disconnectGoogle: '中斷 Google 帳戶連結',
    googleDisconnectWarning: '中斷後，請使用 NewsAgg 電子郵件與密碼登入。',
    showPassword: '顯示密碼',
    hidePassword: '隱藏密碼',
    deleteAccount: '刪除帳戶',
    deleteAccountWarning: '這將永久刪除您的帳戶、書籤和貼文，無法復原。',
    confirmDelete: '是的，刪除我的帳戶',
    memberSince: '加入於',
    lastActive: '最近活躍',
    avatarUpdated: '頭像已更新',
    avatarInvalid: '無法讀取該圖片',
    myPosts: '我的貼文',
    cancel: '取消',
    createAccount: '建立新帳戶',
    addAccount: '新增現有帳戶',
    loggedInAs: '登入身份',
    scrollToTop: '返回頂部',
    articleSentiment: '文章情緒',
    emotionBreakdown: '情緒機率',
    topicKeywords: '關鍵詞',
    comments: '評論',
    writeComment: '寫評論...',
    reply: '回覆',
    joy: '喜悅',
    sadness: '悲傷',
    anger: '憤怒',
    fear: '恐懼',
    surprise: '驚訝',
    backToHome: '返回首頁',
    filterByCountry: '按國家篩選',
    selectLanguage: '語言',
    noResults: '未找到結果',
    translating: '翻譯中…',
    autoTranslated: '自動翻譯',
    translateAll: '翻譯',
    noTranslation: '暫無翻譯',
    quoteOfDay: '每日一句',
    filter: '篩選',
    filters: '篩選',
    byCategory: '分類',
    bySource: '來源',
    bySentiment: '情緒',
    sort: '排序',
    topStories: '熱門報導',
    newestFirst: '最新優先',
    oldestFirst: '最早優先',
    mostRelevant: '最相關',
    allSources: '所有來源',
    allSentiment: '所有情緒',
    clearFilters: '清除',
    sources: '來源',
    metricsGlossaryTitle: '了解這些指標',
    aiConfidenceTerm: 'AI 信心度',
    aiConfidenceDesc:
      '分類模型判定該文章屬於所偵測主題的把握程度，範圍 0 到 100%。數值越高，主題匹配越明確。',
    toxicityTerm: '毒性評分',
    toxicityDesc:
      '文字包含粗魯、不敬或有害語言的可能性，由審核模型評為 0 到 100%。大多數新聞都非常低。',
    readingGradeTerm: '閱讀年級（Flesch–Kincaid）',
    readingGradeDesc: '輕鬆閱讀該文字所需的美國年級水準。8 表示八年級學生即可理解；數字越高越難。',
    fleschTerm: 'Flesch 易讀度',
    fleschDesc: '0–100 的易讀性評分——越高越易讀。60–70 為通俗英語；低於 30 則艱澀且學術。',
    smogTerm: 'SMOG 指數',
    smogDesc: '根據句子長度和複雜詞彙，估算理解文字所需的受教育年數。越低越易懂。',
    sentimentMathTitle: '情緒如何判定',
    sentimentMathDesc:
      'XLM-RoBERTa（英文商業新聞使用 FinBERT）對每篇文章最多三段 1,400 字元的片段（開頭、中段、結尾）評出正面、中性與負面機率，並依片段長度加權。polarity 為正面減負面，漸層條即按此繪製。標籤依下列規則依序判定：',
    posts: '貼文',
    pulse: '動態',
    insights: '洞察',
    viewAllPosts: '查看全部貼文',
    postsComingSoon: '貼文功能即將上線',
    whatsHappening: '有什麼新鮮事？',
    signInToPost: '登入後發文',
    post: '發布',
    postFailed: '貼文發布失敗',
    deletePost: '刪除貼文',
    articleUnavailable: '文章已不可用',
    quoteThis: '引用此文章',
    attachedArticle: '附加文章',
    noPostsYet: '還沒有貼文 — 成為第一個分享的人吧',
    askAI: 'AI 問答',
    askModel: '問 {model}',
    chatAbout: '關於：',
    chatWelcome: '隨便問我關於這篇文章的問題，我會根據內容回答。',
    chatPlaceholder: '詢問這篇文章...',
    clearChat: '清空對話',
    chatSources: '來源段落',
    chatClose: '關閉對話',
    chatSend: '傳送訊息',
    chatGrounded: '回答僅依據這篇文章。',
    chatSuggestions: ['總結這篇文章', '有哪些關鍵事實？', '為什麼這很重要？'],
    translateNews: '翻譯新聞',
    translateNewsOff: '關閉：新聞保持原文語言。',
    translateNewsOn: '開啟：標題與內文翻譯成介面語言。',
    confidenceNote: '信心值是模型給所選標籤的機率，不是實測準確率，也不代表新聞是否屬實。',
    labelRuleNote: '標籤依序套用規則（先判斷中性區間，再看 polarity ±0.10），因此可能與最長的條不同。',
    sentimentFallbackRule: '其餘情況：取機率最高的類別',
    insightsNote: '數據來自 NewsAgg 已發布的四家媒體新聞。情緒反映用詞，不代表真偽、媒體立場或民意；熱門話題依關鍵詞次數排序，並非預測。',
    methodologyTitle: 'NewsAgg 如何運作',
    reportIssue: '回報問題',
    reportIssueTitle: '回報這篇文章的問題',
    reportIssueHint: '告訴團隊哪裡看起來有誤。每則回報都由人工審閱，文章不會自動更改。',
    reportReasons: ['情緒看起來不對', '主題錯誤', '摘要遺漏或扭曲內容', '翻譯問題', '正文擷取問題', '其他'],
    reportMessagePlaceholder: '補充說明（選填，最多 1,000 字）',
    reportSubmit: '送出回報',
    reportSent: '謝謝，團隊會審閱。',
    reportFailed: '回報未能送出，請稍後再試。',
    newsOriginalShort: '原文',
    aiUnavailable: '抱歉，AI 助手暫時不可用。',
    pageNotFound: '找不到頁面',
    errorTitle: '錯誤',
    fetchFailed: '載入新聞失敗，請檢查網路連線。',
    tryDifferent: '試試其他搜尋或分類',
    newsLabel: '新聞',
    googleCompleteSignup: '快完成了——設定密碼即可完成註冊',
    menu: '選單',
    markets: '市場',
    delayedData: '延遲',
    businessTrend: '商業脈搏 — 14 天',
    articlesPerDay: '每日文章',
    avgTone: '平均情緒',
    footerTagline: '自動化多語新聞聚合，結合 NLP 情感分析與主題洞察儀表板',
    navigate: '導覽',
    newsSources: '來源',
    legalInfo: '法律與資訊',
    termsOfService: '服務條款',
    privacyPolicy: '隱私政策',
    poweredByNLP: '由 NLP 情緒分析驅動',
    allRightsReserved: '版權所有。',
  },
};
