/**
 * 主应用程序
 * 协调各个模块，处理用户交互
 */

class BookRecommenderApp {
    constructor() {
        this.children = [];
        this.currentChild = null;
        this.gameEngine = new PreferenceGameEngine();
        this.analyzer = new ReadingAnalyzer();
        this.bookDatabase = new BookDatabase();
        
        // 新增：五星评级助手
        this.ratingHelper = {
            currentBooks: [],
            currentIndex: 0,
            ratings: {},
            ratingDescriptions: {
                5: { emoji: '🌟', title: '时光飞逝', desc: '读得停不下来，一口气读完！' },
                4: { emoji: '📚', title: '津津有味', desc: '很享受阅读过程，读得很开心' },
                3: { emoji: '⏰', title: '按部就班', desc: '正常读完了，还算有趣' },
                2: { emoji: '😴', title: '昏昏欲睡', desc: '读着有点困，需要强迫自己读' },
                1: { emoji: '🚫', title: '弃书而逃', desc: '没读完就放弃了，太无聊了' }
            },
            lastRating: null,
            consecutiveSameRating: 0
        };
        
        this.initializeApp();
    }

    /**
     * 初始化应用
     */
    initializeApp() {
        this.setupEventListeners();
        this.setupGameEngine();
        this.showSection('home');
        
        // 新增：初始化评级助手
        this.setupRatingHelper();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 孩子选择
        document.querySelectorAll('.child-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const childId = card.dataset.child;
                this.selectChild(childId);
            });
        });

        // 文件上传
        this.setupFileUpload();

        // 按钮事件
        document.getElementById('instantBtn').addEventListener('click', () => {
            this.generateInstantRecommendations();
        });

        document.getElementById('gameBtn').addEventListener('click', () => {
            this.startPreferenceGame();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveSession();
        });

        document.getElementById('loadBtn').addEventListener('click', () => {
            this.toggleSavedSessions();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportResults();
        });

        // 评级按钮
        document.getElementById('ratingBtn').addEventListener('click', () => {
            this.showSection('rating');
        });

        // 游戏模式选择
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                this.selectGameMode(mode);
            });
        });

        document.getElementById('backToMainBtn').addEventListener('click', () => {
            this.backToMain();
        });

        // 游戏控制按钮
        document.getElementById('finishGameBtn').addEventListener('click', () => {
            this.finishGame();
        });

        document.getElementById('cancelGameBtn').addEventListener('click', () => {
            this.cancelGame();
        });
    }

    /**
     * 设置文件上传
     */
    setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // 点击上传
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        // 文件选择
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
    }

    /**
     * 设置游戏引擎
     */
    setupGameEngine() {
        this.gameEngine.on('gameStarted', (data) => {
            this.showGameInterface(data);
        });

        this.gameEngine.on('bookSelected', (data) => {
            this.updateBookCard(data.bookId, true);
            this.updateGameProgress();
        });

        this.gameEngine.on('bookDeselected', (data) => {
            this.updateBookCard(data.bookId, false);
            this.updateGameProgress();
        });

        this.gameEngine.on('selectionChanged', (data) => {
            this.updateGameControls(data);
        });

        this.gameEngine.on('comparisonMade', (data) => {
            // 更新对比进度
            this.updateComparisonProgress(data.progress);
            // 显示下一对比对
            this.displayComparisonPair(data.currentPair);
        });

        this.gameEngine.on('gameCompleted', (data) => {
            this.handleGameCompleted(data);
        });

        this.gameEngine.on('gameCancelled', () => {
            this.hideGameInterface();
        });

        this.gameEngine.on('gameTimeout', (data) => {
            this.handleGameTimeout(data);
        });
    }

    /**
     * 选择孩子
     * @param {string} childId - 孩子ID
     */
    selectChild(childId) {
        // 初始化孩子数据结构
        if (!this.children.find(child => child.id === childId)) {
            const childNames = {
                sister: { name: '姐姐', age: 10 },
                younger: { name: '妹妹', age: 8 },
                both: { name: '共同推荐', age: null }
            };
            
            this.children.push({
                id: childId,
                name: childNames[childId].name,
                age: childNames[childId].age,
                readingHistory: [],
                preferences: {},
                gameHistory: []
            });
        }
        
        this.currentChild = this.children.find(child => child.id === childId);

        // 更新UI
        document.querySelectorAll('.child-card').forEach(card => {
            card.classList.remove('active');
        });
        document.getElementById(`child-${childId}`).classList.add('active');

        // 更新选择信息
        const childNames = {
            sister: '姐姐（10岁）',
            younger: '妹妹（8岁）',
            both: '两个孩子共同推荐'
        };

        document.getElementById('currentSelection').textContent = 
            `当前选择：${childNames[childId]}`;

        // 启用/禁用按钮
        document.getElementById('instantBtn').disabled = false;
        document.getElementById('gameBtn').disabled = childId === 'both';

        // 隐藏推荐结果
        document.getElementById('recommendationsSection').classList.remove('active');
    }

    /**
     * 处理文件上传
     * @param {File} file - 上传的文件
     */
    async handleFileUpload(file) {
        this.showLoading('正在解析文件...');

        try {
            const content = await this.readFile(file);
            const books = this.parseFileContent(content, file.name);
            
            this.currentChild.readingHistory = books;
            this.analyzer.loadReadingHistory(books);
            this.updateStats();
            this.updateUploadUI(file.name, books.length);
            
        } catch (error) {
            alert('文件解析失败：' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    /**
     * 解析文件内容
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @returns {Array} 解析后的书籍列表
     */
    parseFileContent(content, filename) {
        let books = [];

        if (filename.endsWith('.json')) {
            books = JSON.parse(content);
        } else if (filename.endsWith('.csv')) {
            books = this.parseCSV(content);
        } else {
            // 简单文本格式，每行一本书
            books = content.split('\n')
                .filter(line => line.trim())
                .map((line, index) => ({
                    id: index + 1,
                    title: line.trim(),
                    author: '未知作者',
                    genre: this.guessGenre(line.trim()),
                    borrowDate: new Date().toISOString().split('T')[0]
                }));
        }

        return books;
    }

    /**
     * 解析CSV内容
     * @param {string} content - CSV内容
     * @returns {Array} 书籍列表
     */
    parseCSV(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        return lines.slice(1)
            .filter(line => line.trim())
            .map((line, index) => {
                const values = line.split(',').map(v => v.trim());
                const book = { id: index + 1 };
                
                headers.forEach((header, i) => {
                    if (header.includes('title') || header.includes('书名')) {
                        book.title = values[i] || '';
                    } else if (header.includes('author') || header.includes('作者')) {
                        book.author = values[i] || '';
                    } else if (header.includes('date') || header.includes('日期')) {
                        book.borrowDate = values[i] || '';
                    } else if (header.includes('genre') || header.includes('类型')) {
                        book.genre = values[i] || '';
                    }
                });
                
                if (!book.genre) {
                    book.genre = this.guessGenre(book.title);
                }
                
                return book;
            });
    }

    /**
     * 猜测书籍类型
     * @param {string} title - 书名
     * @returns {string} 猜测的类型
     */
    guessGenre(title) {
        const genreKeywords = {
            '幻想': ['魔法', '巫师', '龙', '精灵', '魔幻', '奇幻', '哈利'],
            '科幻': ['太空', '机器人', '未来', '星球', '科技', '时间'],
            '冒险': ['探险', '寻宝', '历险', '冒险', '漂流'],
            '成长': ['成长', '青春', '校园', '友谊', '小豆豆'],
            '动物故事': ['动物', '猫', '狗', '马', '鸟', '夏洛'],
            '传记': ['日记', '传记', '自传', '回忆']
        };

        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            if (keywords.some(keyword => title.includes(keyword))) {
                return genre;
            }
        }

        return '文学';
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        const analysis = this.analyzer.exportAnalysis();
        
        document.getElementById('totalBooks').textContent = analysis.summary.totalBooks;
        document.getElementById('uniqueAuthors').textContent = analysis.summary.uniqueAuthors;
        document.getElementById('topGenre').textContent = 
            Object.entries(this.analyzer.patterns.genrePreferences)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';
        document.getElementById('readingLevel').textContent = analysis.summary.readingLevel;
    }

    /**
     * 更新上传UI
     * @param {string} filename - 文件名
     * @param {number} bookCount - 书籍数量
     */
    updateUploadUI(filename, bookCount) {
        const uploadArea = document.getElementById('uploadArea');
        const uploadContent = document.getElementById('uploadContent');
        
        uploadContent.innerHTML = `
            <p style="color: #48bb78; font-weight: bold;">✅ ${filename} 上传成功</p>
            <p style="font-size: 12px; color: #718096;">解析了 ${bookCount} 本书的记录</p>
        `;
        uploadArea.classList.add('has-file');
    }

    /**
     * 加载示例数据
     */
    loadSampleData() {
        // 模拟借书记录
        const sampleHistory = [
            {id: 1, title: "哈利·波特与魔法石", author: "J.K.罗琳", genre: "幻想", borrowDate: "2024-01-15"},
            {id: 2, title: "小王子", author: "圣埃克苏佩里", genre: "哲学", borrowDate: "2024-01-20"},
            {id: 3, title: "夏洛的网", author: "E.B.怀特", genre: "动物故事", borrowDate: "2024-02-01"},
            {id: 4, title: "窗边的小豆豆", author: "黑柳彻子", genre: "成长", borrowDate: "2024-02-10"},
            {id: 5, title: "秘密花园", author: "弗朗西丝·霍奇森·伯内特", genre: "成长", borrowDate: "2024-02-15"},
            {id: 6, title: "绿野仙踪", author: "弗兰克·鲍姆", genre: "冒险", borrowDate: "2024-02-20"},
            {id: 7, title: "汤姆·索亚历险记", author: "马克·吐温", genre: "冒险", borrowDate: "2024-03-01"},
            {id: 8, title: "爱丽丝梦游仙境", author: "路易斯·卡罗尔", genre: "奇幻", borrowDate: "2024-03-05"}
        ];

        this.currentChild.readingHistory = sampleHistory;
        this.analyzer.loadReadingHistory(sampleHistory);
        this.updateStats();
    }

    /**
     * 生成即时推荐
     */
    generateInstantRecommendations() {
        if (!this.currentChild) {
            alert('请先选择要推荐的孩子');
            return;
        }

        this.showLoading('正在生成推荐...');

        setTimeout(() => {
            try {
                const recommendations = this.generateRecommendations();
                this.displayRecommendations(recommendations);
            } catch (error) {
                alert('推荐生成失败：' + error.message);
            } finally {
                this.hideLoading();
            }
        }, 1000); // 模拟处理时间
    }

    /**
     * 生成推荐
     * @returns {Array} 推荐列表
     */
    generateRecommendations() {
        if (this.currentChild === 'both') {
            return this.generateSharedRecommendations();
        } else {
            return this.generateIndividualRecommendations(this.currentChild);
        }
    }

    /**
     * 生成个人推荐
     * @param {string} childId - 孩子ID
     * @returns {Array} 推荐列表
     */
    generateIndividualRecommendations(childId) {
        const child = this.childProfiles[childId];
        const age = child.age;
        
        // 获取适合年龄的书籍
        let candidates = getBooksByAge(age, 1);
        
        // 基于历史偏好调整
        const historyPrefs = this.analyzer.preferences;
        
        // 基于游戏偏好调整
        const gamePrefs = child.preferences;
        
        // 计算推荐分数
        candidates = candidates.map(book => ({
            ...book,
            score: this.calculateRecommendationScore(book, childId, historyPrefs, gamePrefs),
            reason: this.generateRecommendationReason(book, childId, historyPrefs, gamePrefs)
        }));

        // 排序并返回前10个
        return candidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    /**
     * 生成共同推荐
     * @returns {Array} 推荐列表
     */
    generateSharedRecommendations() {
        // 获取适合两个年龄段的书籍
        const candidates = getBooksForBothChildren(8, 10);
        
        return candidates.map(book => ({
            ...book,
            score: 70 + Math.random() * 20, // 基础分数加随机值
            reason: '适合姐妹共同阅读的优质书籍'
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }

    /**
     * 计算推荐分数
     * @param {Object} book - 书籍对象
     * @param {string} childId - 孩子ID
     * @param {Object} historyPrefs - 历史偏好
     * @param {Object} gamePrefs - 游戏偏好
     * @returns {number} 推荐分数
     */
    calculateRecommendationScore(book, childId, historyPrefs, gamePrefs) {
        let score = 50; // 基础分数

        // 基于历史偏好
        if (historyPrefs.primaryGenres && historyPrefs.primaryGenres.includes(book.genre)) {
            score += 20;
        }
        if (historyPrefs.secondaryGenres && historyPrefs.secondaryGenres.includes(book.genre)) {
            score += 10;
        }

        // 基于游戏偏好
        if (gamePrefs.genres && gamePrefs.genres[book.genre]) {
            score += gamePrefs.genres[book.genre] * 15;
        }

        // 年龄适配
        const age = this.childProfiles[childId].age;
        const ageMatch = Math.max(0, 10 - Math.abs(age - (book.ageRange[0] + book.ageRange[1]) / 2));
        score += ageMatch;

        // 复杂度适配
        if (gamePrefs.averageComplexity) {
            const complexityMatch = Math.max(0, 5 - Math.abs(book.complexity - gamePrefs.averageComplexity));
            score += complexityMatch;
        }

        return Math.min(95, Math.max(30, score));
    }

    /**
     * 生成推荐理由
     * @param {Object} book - 书籍对象
     * @param {string} childId - 孩子ID
     * @param {Object} historyPrefs - 历史偏好
     * @param {Object} gamePrefs - 游戏偏好
     * @returns {string} 推荐理由
     */
    generateRecommendationReason(book, childId, historyPrefs, gamePrefs) {
        const childName = this.childProfiles[childId].name;
        
        if (gamePrefs.genres && gamePrefs.genres[book.genre]) {
            return `基于${childName}在偏好游戏中对${book.genre}类书籍的选择`;
        }
        
        if (historyPrefs.primaryGenres && historyPrefs.primaryGenres.includes(book.genre)) {
            return `基于${childName}对${book.genre}类书籍的历史偏好`;
        }
        
        return `适合${childName}当前阅读水平的优质书籍`;
    }

    /**
     * 显示推荐结果
     * @param {Array} recommendations - 推荐列表
     */
    displayRecommendations(recommendations) {
        const section = document.getElementById('recommendationsSection');
        const list = document.getElementById('recommendationsList');
        const childName = this.currentChild === 'both' ? '两个孩子' : 
                         this.childProfiles[this.currentChild].name;
        
        document.getElementById('recommendChildName').textContent = childName;
        
        list.innerHTML = recommendations.map(book => `
            <div class="recommendation-item">
                <div class="recommendation-content">
                    <div class="recommendation-title">${book.title}</div>
                    <div class="recommendation-meta">作者：${book.author} | 类型：${book.genre}</div>
                    <div class="recommendation-reason">${book.reason}</div>
                </div>
                <div class="recommendation-score">${Math.round(book.score)}%</div>
            </div>
        `).join('');
        
        section.classList.add('active');
        this.currentRecommendations = recommendations;
    }

    /**
     * 开始偏好游戏 - 显示模式选择
     */
    startPreferenceGame() {
        if (!this.currentChild || this.currentChild === 'both') {
            alert('偏好游戏需要选择具体的孩子');
            return;
        }

        this.showGameModeSelection();
    }

    /**
     * 显示游戏模式选择界面
     */
    showGameModeSelection() {
        const modeSection = document.getElementById('gameModeSelection');
        const childName = this.childProfiles[this.currentChild].name;
        
        document.getElementById('modeChildName').textContent = childName;
        
        // 显示模式选择界面
        modeSection.classList.add('active');
        
        // 滚动到模式选择区域
        modeSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 选择游戏模式并开始游戏
     * @param {string} mode - 游戏模式 ('grid' 或 'comparison')
     */
    selectGameMode(mode) {
        const child = this.childProfiles[this.currentChild];
        
        // 隐藏模式选择界面
        document.getElementById('gameModeSelection').classList.remove('active');
        
        // 开始对应模式的游戏
        this.gameEngine.startGame(this.currentChild, child.age, mode);
    }

    /**
     * 返回主界面
     */
    backToMain() {
        document.getElementById('gameModeSelection').classList.remove('active');
    }

    /**
     * 显示游戏界面
     * @param {Object} data - 游戏数据
     */
    showGameInterface(data) {
        const gameSection = document.getElementById('preferenceGame');
        const childName = this.childProfiles[data.child].name;
        
        document.getElementById('gameChildName').textContent = childName;
        
        // 根据游戏模式显示不同界面
        if (data.mode === 'comparison') {
            this.setupComparisonMode(data);
        } else {
            this.setupGridMode(data);
        }
        
        // 显示游戏界面
        gameSection.classList.add('active');
        
        // 滚动到游戏区域
        gameSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 设置网格模式界面
     * @param {Object} data - 游戏数据
     */
    setupGridMode(data) {
        // 更新游戏描述
        document.getElementById('gameDescription').textContent = 
            '从下面选择3-5本感兴趣的书，帮助优化推荐算法（大约3分钟）';
        
        // 显示网格进度，隐藏对比进度
        document.getElementById('gridProgress').style.display = 'block';
        document.getElementById('comparisonProgress').style.display = 'none';
        
        // 显示书籍网格，隐藏对比界面
        document.getElementById('gameBooks').style.display = 'grid';
        document.getElementById('bookComparison').style.display = 'none';
        
        // 显示游戏书籍
        this.displayGameBooks(data.books);
    }

    /**
     * 设置对比模式界面
     * @param {Object} data - 游戏数据
     */
    setupComparisonMode(data) {
        // 更新游戏描述
        document.getElementById('gameDescription').textContent = 
            '通过两两对比选择更喜欢的书籍，精确识别阅读偏好（大约5-8分钟）';
        
        // 隐藏网格进度，显示对比进度
        document.getElementById('gridProgress').style.display = 'none';
        document.getElementById('comparisonProgress').style.display = 'block';
        
        // 隐藏书籍网格，显示对比界面
        document.getElementById('gameBooks').style.display = 'none';
        document.getElementById('bookComparison').style.display = 'block';
        
        // 更新对比进度
        this.updateComparisonProgress(data.progress);
        
        // 显示当前对比对
        this.displayComparisonPair(data.currentPair);
    }

    /**
     * 显示游戏书籍
     * @param {Array} books - 书籍列表
     */
    displayGameBooks(books) {
        const container = document.getElementById('gameBooks');
        
        container.innerHTML = books.map(book => `
            <div class="book-card" data-book-id="${book.id}" id="game-book-${book.id}">
                <div class="book-title">${book.title}</div>
                <div class="book-author">${book.author}</div>
                <div class="book-genre">${book.genre}</div>
            </div>
        `).join('');
        
        // 添加点击事件
        container.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = parseInt(card.dataset.bookId);
                const result = this.gameEngine.toggleBookSelection(bookId);
                
                if (!result.success && result.reason) {
                    // 显示提示信息
                    this.showToast(result.reason);
                }
            });
        });
    }

    /**
     * 更新书籍卡片状态
     * @param {number} bookId - 书籍ID
     * @param {boolean} selected - 是否选中
     */
    updateBookCard(bookId, selected) {
        const card = document.getElementById(`game-book-${bookId}`);
        if (card) {
            if (selected) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        }
    }

    /**
     * 更新游戏进度
     */
    updateGameProgress() {
        const state = this.gameEngine.getGameState();
        if (state.mode === 'comparison') {
            this.updateComparisonProgress(state.progress);
        } else {
            document.getElementById('selectedCount').textContent = state.selectedCount;
        }
    }

    /**
     * 更新对比进度
     * @param {Object} progress - 进度信息
     */
    updateComparisonProgress(progress) {
        if (!progress) return;
        
        document.getElementById('comparisonCurrent').textContent = progress.current;
        document.getElementById('comparisonTotal').textContent = progress.total;
        document.getElementById('comparisonPercent').textContent = progress.percentage;
        document.getElementById('progressFill').style.width = progress.percentage + '%';
    }

    /**
     * 显示对比书籍对
     * @param {Object} pair - 书籍对
     */
    displayComparisonPair(pair) {
        if (!pair) return;
        
        const book1Element = document.getElementById('comparisonBook1');
        const book2Element = document.getElementById('comparisonBook2');
        
        // 设置第一本书
        book1Element.querySelector('.book-title').textContent = pair.book1.title;
        book1Element.querySelector('.book-author').textContent = pair.book1.author;
        book1Element.querySelector('.book-genre').textContent = pair.book1.genre;
        book1Element.dataset.bookId = pair.book1.id;
        
        // 设置第二本书
        book2Element.querySelector('.book-title').textContent = pair.book2.title;
        book2Element.querySelector('.book-author').textContent = pair.book2.author;
        book2Element.querySelector('.book-genre').textContent = pair.book2.genre;
        book2Element.dataset.bookId = pair.book2.id;
        
        // 添加点击事件
        book1Element.onclick = () => this.makeComparison(pair.book1.id);
        book2Element.onclick = () => this.makeComparison(pair.book2.id);
    }

    /**
     * 进行对比选择
     * @param {number} winnerId - 选择的书籍ID
     */
    makeComparison(winnerId) {
        const result = this.gameEngine.makeComparison(winnerId);
        
        if (!result.success) {
            this.showToast(result.reason || '对比失败');
            return;
        }
        
        // 如果游戏完成，result会包含完成信息
        if (result.success && result.child) {
            this.handleGameCompleted(result);
        }
    }

    /**
     * 更新游戏控制按钮
     * @param {Object} data - 选择状态数据
     */
    updateGameControls(data) {
        const finishBtn = document.getElementById('finishGameBtn');
        finishBtn.disabled = !data.canFinish;
        
        if (data.canFinish) {
            finishBtn.textContent = '完成游戏 ✨';
        } else {
            finishBtn.textContent = `完成游戏 (${data.selectedCount}/${data.minRequired})`;
        }
    }

    /**
     * 完成游戏
     */
    finishGame() {
        const result = this.gameEngine.finishGame();
        
        if (!result.success) {
            alert(result.reason);
            return;
        }
        
        this.handleGameCompleted(result);
    }

    /**
     * 处理游戏完成
     * @param {Object} result - 游戏结果
     */
    handleGameCompleted(result) {
        // 保存偏好到孩子档案
        this.childProfiles[result.child].preferences = result.preferences;
        this.childProfiles[result.child].gameHistory.push({
            timestamp: new Date().toISOString(),
            gameTime: result.gameTime,
            efficiency: result.efficiency,
            selectedBooks: result.selectedBooks,
            preferences: result.preferences
        });

        // 隐藏游戏界面
        this.hideGameInterface();

        // 自动生成推荐
        this.generateInstantRecommendations();

        // 显示完成提示
        this.showToast(`${this.childProfiles[result.child].name}的偏好识别完成！推荐已根据游戏结果进行优化。`);
    }

    /**
     * 取消游戏
     */
    cancelGame() {
        this.gameEngine.cancelGame();
        this.hideGameInterface();
    }

    /**
     * 隐藏游戏界面
     */
    hideGameInterface() {
        document.getElementById('preferenceGame').classList.remove('active');
    }

    /**
     * 处理游戏超时
     * @param {Object} data - 超时数据
     */
    handleGameTimeout(data) {
        if (data.selectedCount >= data.minRequired) {
            // 如果已选择足够的书，自动完成游戏
            this.finishGame();
        } else {
            // 提示用户时间到了
            alert(`游戏时间到了！请至少选择${data.minRequired}本书。`);
        }
    }

    /**
     * 保存会话
     */
    saveSession() {
        const sessionData = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            currentChild: this.currentChild,
            childProfiles: this.childProfiles,
            recommendations: this.currentRecommendations,
            readingHistoryCount: this.currentChild.readingHistory.length
        };

        let savedSessions = JSON.parse(localStorage.getItem('bookRecommenderSessions') || '[]');
        savedSessions.unshift(sessionData);
        
        // 只保留最近10个会话
        if (savedSessions.length > 10) {
            savedSessions = savedSessions.slice(0, 10);
        }

        localStorage.setItem('bookRecommenderSessions', JSON.stringify(savedSessions));
        this.loadSavedSessions();
        this.showToast('会话已保存！');
    }

    /**
     * 加载保存的会话
     */
    loadSavedSessions() {
        const savedSessions = JSON.parse(localStorage.getItem('bookRecommenderSessions') || '[]');
        const container = document.getElementById('sessionsList');
        
        if (savedSessions.length === 0) {
            container.innerHTML = '<p style="color: #718096; text-align: center;">暂无保存的会话</p>';
            return;
        }

        container.innerHTML = savedSessions.map(session => `
            <div class="session-item">
                <div class="session-info">
                    <div class="session-title">
                        ${session.currentChild === 'both' ? '共同推荐' : 
                          (session.currentChild === 'sister' ? '姐姐推荐' : '妹妹推荐')}
                    </div>
                    <div class="session-meta">
                        ${new Date(session.timestamp).toLocaleString()} | 
                        ${session.recommendations?.length || 0}个推荐
                    </div>
                </div>
                <div class="session-actions">
                    <button class="button" onclick="app.loadSession(${session.id})">加载</button>
                    <button class="button secondary" onclick="app.deleteSession(${session.id})">删除</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 加载指定会话
     * @param {number} sessionId - 会话ID
     */
    loadSession(sessionId) {
        const savedSessions = JSON.parse(localStorage.getItem('bookRecommenderSessions') || '[]');
        const session = savedSessions.find(s => s.id === sessionId);
        
        if (session) {
            this.currentChild = session.currentChild;
            this.childProfiles = { ...this.childProfiles, ...session.childProfiles };
            this.currentRecommendations = session.recommendations || [];
            
            // 更新UI
            this.selectChild(this.currentChild);
            if (this.currentRecommendations.length > 0) {
                this.displayRecommendations(this.currentRecommendations);
            }
            
            this.showToast('会话已加载！');
        }
    }

    /**
     * 删除会话
     * @param {number} sessionId - 会话ID
     */
    deleteSession(sessionId) {
        let savedSessions = JSON.parse(localStorage.getItem('bookRecommenderSessions') || '[]');
        savedSessions = savedSessions.filter(s => s.id !== sessionId);
        localStorage.setItem('bookRecommenderSessions', JSON.stringify(savedSessions));
        this.loadSavedSessions();
    }

    /**
     * 切换保存的会话显示
     */
    toggleSavedSessions() {
        const element = document.getElementById('savedSessions');
        element.classList.toggle('active');
        
        if (element.classList.contains('active')) {
            this.loadSavedSessions();
        }
    }

    /**
     * 导出结果
     */
    exportResults() {
        if (this.currentRecommendations.length === 0) {
            alert('没有推荐结果可导出');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            child: this.currentChild,
            childName: this.currentChild === 'both' ? '共同推荐' : 
                      this.childProfiles[this.currentChild].name,
            readingHistoryCount: this.currentChild.readingHistory.length,
            recommendations: this.currentRecommendations.map(book => ({
                title: book.title,
                author: book.author,
                genre: book.genre,
                score: Math.round(book.score),
                reason: book.reason
            })),
            childProfile: this.currentChild !== 'both' ? this.childProfiles[this.currentChild] : null
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `book-recommendations-${this.currentChild}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    /**
     * 加载保存的数据
     */
    loadSavedData() {
        const savedProfiles = localStorage.getItem('childProfiles');
        if (savedProfiles) {
            this.childProfiles = { ...this.childProfiles, ...JSON.parse(savedProfiles) };
        }
    }

    /**
     * 保存数据
     */
    saveData() {
        const data = {
            children: this.children,
            currentChildId: this.currentChild ? this.currentChild.id : null
        };
        localStorage.setItem('bookRecommenderData', JSON.stringify(data));
    }

    /**
     * 保存孩子数据
     */
    saveChildren() {
        this.saveData();
    }

    /**
     * 显示加载提示
     * @param {string} message - 提示信息
     */
    showLoading(message = '正在处理...') {
        const overlay = document.getElementById('loadingOverlay');
        const content = overlay.querySelector('.loading-content p');
        content.textContent = message;
        overlay.classList.add('active');
    }

    /**
     * 隐藏加载提示
     */
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    /**
     * 显示指定的页面区域
     * @param {string} sectionId - 区域ID
     */
    showSection(sectionId) {
        // 隐藏所有区域
        document.querySelectorAll('.main-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // 显示指定区域
        const targetSection = document.getElementById(sectionId + 'Section') || 
                            document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
        
        // 特殊处理评级界面
        if (sectionId === 'rating') {
            document.getElementById('ratingInterface').style.display = 'none';
            document.getElementById('ratingComplete').style.display = 'none';
        }
    }

    /**
     * 显示提示信息
     * @param {string} message - 提示信息
     * @param {number} duration - 显示时长（毫秒）
     */
    showToast(message, duration = 3000) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    /**
     * 设置评级助手
     */
    setupRatingHelper() {
        // 评级助手按钮事件
        const startRatingBtn = document.getElementById('startRatingBtn');
        if (startRatingBtn) {
            startRatingBtn.addEventListener('click', () => {
                this.startRatingSession();
            });
        }

        // 评级按钮事件
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rating = parseInt(e.target.dataset.rating);
                this.rateCurrentBook(rating);
            });
        });

        // 其他控制按钮
        const skipBtn = document.getElementById('skipRatingBtn');
        const prevBtn = document.getElementById('prevRatingBtn');
        const exportBtn = document.getElementById('exportRatingsBtn');

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipCurrentBook());
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPreviousBook());
        }
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportRatings());
        }
    }

    /**
     * 开始评级会话
     */
    startRatingSession() {
        if (!this.currentChild) {
            this.showToast('请先选择一个孩子');
            return;
        }

        // 获取孩子的阅读历史（先加载示例数据用于演示）
        if (!this.currentChild.readingHistory || this.currentChild.readingHistory.length === 0) {
            this.loadSampleData();
        }

        const readBooks = this.currentChild.readingHistory || [];
        if (readBooks.length === 0) {
            this.showToast('请先添加一些阅读历史');
            return;
        }

        // 过滤出未评级的书籍
        const unratedBooks = readBooks.filter(book => !book.rating);
        if (unratedBooks.length === 0) {
            this.showToast('所有书籍都已评级！');
            return;
        }

        // 初始化评级会话
        this.ratingHelper.currentBooks = [...unratedBooks];
        this.ratingHelper.currentIndex = 0;
        this.ratingHelper.ratings = {};
        this.ratingHelper.lastRating = null;
        this.ratingHelper.consecutiveSameRating = 0;

        // 显示评级界面
        this.showSection('rating');
        document.getElementById('ratingInterface').style.display = 'block';
        this.displayCurrentRatingBook();
    }

    /**
     * 显示当前要评级的书籍
     */
    displayCurrentRatingBook() {
        const { currentBooks, currentIndex } = this.ratingHelper;
        
        if (currentIndex >= currentBooks.length) {
            this.completeRatingSession();
            return;
        }

        const book = currentBooks[currentIndex];
        
        // 更新界面
        document.getElementById('ratingBookTitle').textContent = book.title;
        document.getElementById('ratingBookAuthor').textContent = book.author;
        document.getElementById('ratingBookGenre').textContent = book.genre || '';
        document.getElementById('ratingProgress').textContent = 
            `第 ${currentIndex + 1} 本，共 ${currentBooks.length} 本`;

        // 更新进度条
        const progress = ((currentIndex + 1) / currentBooks.length) * 100;
        document.getElementById('ratingProgressBar').style.width = `${progress}%`;

        // 重置评级按钮状态
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // 更新控制按钮状态
        document.getElementById('prevRatingBtn').disabled = currentIndex === 0;
        
        // 显示提示信息
        this.updateRatingHint();
    }

    /**
     * 更新评级提示
     */
    updateRatingHint() {
        const { consecutiveSameRating, lastRating } = this.ratingHelper;
        const hintElement = document.getElementById('ratingHint');
        
        if (consecutiveSameRating >= 3 && lastRating) {
            const ratingInfo = this.ratingHelper.ratingDescriptions[lastRating];
            hintElement.innerHTML = `
                <div class="rating-warning">
                    🤔 你已经连续给了${consecutiveSameRating}本书"${ratingInfo.title}"评分
                    <br>想想这本书是否真的和前面的书一样？
                </div>
            `;
            hintElement.style.display = 'block';
        } else {
            hintElement.style.display = 'none';
        }
    }

    /**
     * 评级当前书籍
     */
    rateCurrentBook(rating) {
        const { currentBooks, currentIndex } = this.ratingHelper;
        const book = currentBooks[currentIndex];
        
        // 记录评级
        this.ratingHelper.ratings[book.id] = {
            rating: rating,
            timestamp: Date.now()
        };

        // 更新连续相同评级计数
        if (rating === this.ratingHelper.lastRating) {
            this.ratingHelper.consecutiveSameRating++;
        } else {
            this.ratingHelper.consecutiveSameRating = 1;
        }
        this.ratingHelper.lastRating = rating;

        // 视觉反馈
        const ratingBtn = document.querySelector(`[data-rating="${rating}"]`);
        ratingBtn.classList.add('selected');
        
        // 显示评级反馈
        const ratingInfo = this.ratingHelper.ratingDescriptions[rating];
        this.showRatingFeedback(ratingInfo);

        // 延迟跳转到下一本书
        setTimeout(() => {
            this.nextBook();
        }, 1500);
    }

    /**
     * 显示评级反馈
     */
    showRatingFeedback(ratingInfo) {
        const feedbackElement = document.getElementById('ratingFeedback');
        feedbackElement.innerHTML = `
            <div class="rating-feedback-content">
                <div class="rating-emoji">${ratingInfo.emoji}</div>
                <div class="rating-title">${ratingInfo.title}</div>
                <div class="rating-desc">${ratingInfo.desc}</div>
            </div>
        `;
        feedbackElement.style.display = 'block';
        
        // 添加动画效果
        feedbackElement.classList.add('fade-in');
        setTimeout(() => {
            feedbackElement.classList.remove('fade-in');
        }, 1000);
    }

    /**
     * 下一本书
     */
    nextBook() {
        this.ratingHelper.currentIndex++;
        document.getElementById('ratingFeedback').style.display = 'none';
        this.displayCurrentRatingBook();
    }

    /**
     * 跳过当前书籍
     */
    skipCurrentBook() {
        this.nextBook();
    }

    /**
     * 返回上一本书
     */
    goToPreviousBook() {
        if (this.ratingHelper.currentIndex > 0) {
            this.ratingHelper.currentIndex--;
            
            // 移除上一本书的评级
            const book = this.ratingHelper.currentBooks[this.ratingHelper.currentIndex];
            delete this.ratingHelper.ratings[book.id];
            
            document.getElementById('ratingFeedback').style.display = 'none';
            this.displayCurrentRatingBook();
        }
    }

    /**
     * 完成评级会话
     */
    completeRatingSession() {
        const totalRated = Object.keys(this.ratingHelper.ratings).length;
        const totalBooks = this.ratingHelper.currentBooks.length;
        
        // 更新孩子的阅读历史
        this.updateReadingHistoryWithRatings();
        
        // 显示完成界面
        document.getElementById('ratingComplete').style.display = 'block';
        document.getElementById('ratingInterface').style.display = 'none';
        
        document.getElementById('ratingStats').innerHTML = `
            <div class="rating-stats">
                <h3>🎉 评级完成！</h3>
                <p>总共评级了 <strong>${totalRated}</strong> 本书</p>
                <div class="rating-distribution">
                    ${this.generateRatingDistribution()}
                </div>
            </div>
        `;
    }

    /**
     * 生成评级分布统计
     */
    generateRatingDistribution() {
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        Object.values(this.ratingHelper.ratings).forEach(rating => {
            distribution[rating.rating]++;
        });
        
        return Object.entries(distribution)
            .filter(([rating, count]) => count > 0)
            .map(([rating, count]) => {
                const info = this.ratingHelper.ratingDescriptions[rating];
                return `
                    <div class="rating-stat-item">
                        <span class="rating-emoji">${info.emoji}</span>
                        <span class="rating-title">${info.title}</span>
                        <span class="rating-count">${count}本</span>
                    </div>
                `;
            }).join('');
    }

    /**
     * 更新阅读历史中的评级
     */
    updateReadingHistoryWithRatings() {
        const ratings = this.ratingHelper.ratings;
        
        this.currentChild.readingHistory.forEach(book => {
            if (ratings[book.id]) {
                book.rating = ratings[book.id].rating;
                book.ratedAt = ratings[book.id].timestamp;
            }
        });
        
        // 保存到本地存储
        this.saveChildren();
    }

    /**
     * 导出评级数据
     */
    exportRatings() {
        const ratingsData = this.prepareGoodreadsExport();
        this.downloadCSV(ratingsData, `${this.currentChild.name}_ratings.csv`);
        this.showToast('评级数据已导出！');
    }

    /**
     * 准备Goodreads导出格式
     */
    prepareGoodreadsExport() {
        const headers = ['Title', 'Author', 'My Rating', 'Date Read'];
        const rows = [headers];
        
        this.currentChild.readingHistory
            .filter(book => book.rating)
            .forEach(book => {
                const dateRead = book.ratedAt ? 
                    new Date(book.ratedAt).toISOString().split('T')[0] : 
                    new Date().toISOString().split('T')[0];
                
                rows.push([
                    book.title,
                    book.author,
                    book.rating,
                    dateRead
                ]);
            });
        
        return rows;
    }

    /**
     * 下载CSV文件
     */
    downloadCSV(data, filename) {
        const csvContent = data.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// 创建全局应用实例
const app = new BookRecommenderApp();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('家庭智能图书推荐系统已启动');
}); 