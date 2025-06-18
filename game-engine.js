/**
 * 偏好识别游戏引擎
 * 专为8-10岁儿童设计的简单有趣的偏好识别系统
 * 支持两种游戏模式：快速选择和精确对比
 */

class PreferenceGameEngine {
    constructor() {
        this.currentChild = null;
        this.gameBooks = [];
        this.selectedBooks = [];
        this.gameState = 'idle'; // idle, playing, completed
        this.preferences = {};
        this.gameMode = 'grid'; // 'grid' 或 'comparison'
        
        // 游戏配置
        this.config = {
            grid: {
                minSelections: 3,
                maxSelections: 5,
                booksToShow: 12,
                gameTimeLimit: 300000 // 5分钟
            },
            comparison: {
                totalComparisons: 20,
                booksToCompare: 16,
                gameTimeLimit: 600000 // 10分钟
            }
        };
        
        // 对比模式专用数据
        this.comparisonData = {
            currentPair: null,
            comparisonIndex: 0,
            bookScores: new Map(), // ELO评分系统
            comparisonHistory: []
        };
        
        this.startTime = null;
        this.callbacks = {};
    }

    /**
     * 注册回调函数
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event](data);
        }
    }

    /**
     * 开始游戏
     * @param {string} childId - 孩子ID ('sister' 或 'younger')
     * @param {number} childAge - 孩子年龄
     * @param {string} mode - 游戏模式 ('grid' 或 'comparison')
     */
    startGame(childId, childAge, mode = 'grid') {
        this.currentChild = childId;
        this.gameState = 'playing';
        this.gameMode = mode;
        this.selectedBooks = [];
        this.preferences = {};
        this.startTime = Date.now();

        // 根据年龄和模式选择适合的书籍
        this.gameBooks = this.selectGameBooks(childAge);
        
        if (mode === 'comparison') {
            this.initializeComparisonMode();
        }
        
        this.emit('gameStarted', {
            child: childId,
            books: this.gameBooks,
            config: this.config[mode],
            mode: mode,
            ...(mode === 'comparison' ? { 
                currentPair: this.comparisonData.currentPair,
                progress: this.getComparisonProgress()
            } : {})
        });

        // 设置游戏时间限制
        const timeLimit = this.config[mode].gameTimeLimit;
        setTimeout(() => {
            if (this.gameState === 'playing') {
                this.emit('gameTimeout', {
                    selectedCount: this.selectedBooks.length,
                    minRequired: mode === 'grid' ? this.config.grid.minSelections : 0,
                    mode: mode
                });
            }
        }, timeLimit);

        return this.gameBooks;
    }

    /**
     * 选择游戏用书籍
     * @param {number} age - 孩子年龄
     * @returns {Array} 游戏书籍列表
     */
    selectGameBooks(age) {
        // 获取适合年龄的书籍
        const ageAppropriateBooks = getBooksByAge(age, 1);
        
        // 确保类型多样性
        const genreGroups = this.groupBooksByGenre(ageAppropriateBooks);
        const selectedBooks = [];

        // 从每个类型中选择1-2本书
        const genres = Object.keys(genreGroups);
        genres.forEach(genre => {
            const booksInGenre = genreGroups[genre];
            const count = Math.min(2, booksInGenre.length);
            const randomBooks = getRandomBooks(booksInGenre, count);
            selectedBooks.push(...randomBooks);
        });

        // 根据游戏模式确定需要的书籍数量
        const targetCount = this.gameMode === 'comparison' ? 
            this.config.comparison.booksToCompare : 
            this.config.grid.booksToShow;

        // 如果书籍不够，随机补充
        if (selectedBooks.length < targetCount) {
            const remaining = targetCount - selectedBooks.length;
            const additionalBooks = getRandomBooks(
                ageAppropriateBooks.filter(book => 
                    !selectedBooks.find(selected => selected.id === book.id)
                ),
                remaining
            );
            selectedBooks.push(...additionalBooks);
        }

        // 随机打乱顺序
        return getRandomBooks(selectedBooks, targetCount);
    }

    /**
     * 按类型分组书籍
     * @param {Array} books - 书籍列表
     * @returns {Object} 按类型分组的书籍
     */
    groupBooksByGenre(books) {
        return books.reduce((groups, book) => {
            const genre = book.genre;
            if (!groups[genre]) {
                groups[genre] = [];
            }
            groups[genre].push(book);
            return groups;
        }, {});
    }

    /**
     * 选择/取消选择书籍 (网格模式)
     * @param {number} bookId - 书籍ID
     * @returns {Object} 操作结果
     */
    toggleBookSelection(bookId) {
        if (this.gameState !== 'playing' || this.gameMode !== 'grid') {
            return { success: false, reason: 'Game not active or wrong mode' };
        }

        const book = this.gameBooks.find(b => b.id === bookId);
        if (!book) {
            return { success: false, reason: 'Book not found' };
        }

        const isSelected = this.selectedBooks.includes(bookId);
        
        if (isSelected) {
            // 取消选择
            this.selectedBooks = this.selectedBooks.filter(id => id !== bookId);
            this.emit('bookDeselected', { bookId, book, selectedCount: this.selectedBooks.length });
        } else {
            // 检查是否已达到最大选择数
            if (this.selectedBooks.length >= this.config.grid.maxSelections) {
                return { 
                    success: false, 
                    reason: `最多只能选择${this.config.grid.maxSelections}本书` 
                };
            }
            
            // 选择书籍
            this.selectedBooks.push(bookId);
            this.emit('bookSelected', { bookId, book, selectedCount: this.selectedBooks.length });
        }

        // 检查是否可以完成游戏
        const canFinish = this.selectedBooks.length >= this.config.grid.minSelections;
        this.emit('selectionChanged', {
            selectedCount: this.selectedBooks.length,
            minRequired: this.config.grid.minSelections,
            maxAllowed: this.config.grid.maxSelections,
            canFinish: canFinish
        });

        return { success: true, selectedCount: this.selectedBooks.length, canFinish };
    }

    /**
     * 处理对比选择 (对比模式)
     * @param {number} winnerId - 获胜书籍ID
     * @returns {Object} 操作结果
     */
    makeComparison(winnerId) {
        if (this.gameState !== 'playing' || this.gameMode !== 'comparison') {
            return { success: false, reason: 'Game not active or wrong mode' };
        }

        if (!this.comparisonData.currentPair) {
            return { success: false, reason: 'No current comparison pair' };
        }

        const { book1, book2 } = this.comparisonData.currentPair;
        const loserId = winnerId === book1.id ? book2.id : book1.id;

        // 更新ELO评分
        this.updateEloScores(winnerId, loserId);

        // 记录对比历史
        this.comparisonData.comparisonHistory.push({
            winner: winnerId,
            loser: loserId,
            timestamp: Date.now()
        });

        this.comparisonData.comparisonIndex++;

        // 检查是否完成所有对比
        if (this.comparisonData.comparisonIndex >= this.config.comparison.totalComparisons) {
            return this.finishComparisonGame();
        }

        // 生成下一对比
        this.generateNextComparison();

        this.emit('comparisonMade', {
            winner: winnerId,
            loser: loserId,
            currentPair: this.comparisonData.currentPair,
            progress: this.getComparisonProgress()
        });

        return { success: true, progress: this.getComparisonProgress() };
    }

    /**
     * 完成游戏 (网格模式)
     * @returns {Object} 游戏结果
     */
    finishGame() {
        if (this.gameState !== 'playing') {
            return { success: false, reason: 'Game not active' };
        }

        if (this.gameMode === 'grid' && this.selectedBooks.length < this.config.grid.minSelections) {
            return { 
                success: false, 
                reason: `至少需要选择${this.config.grid.minSelections}本书` 
            };
        }

        this.gameState = 'completed';
        const endTime = Date.now();
        const gameTime = endTime - this.startTime;

        // 分析偏好
        this.analyzePreferences();

        const result = {
            success: true,
            child: this.currentChild,
            selectedBooks: this.selectedBooks,
            preferences: this.preferences,
            gameTime: gameTime,
            efficiency: this.calculateEfficiency(gameTime)
        };

        this.emit('gameCompleted', result);
        return result;
    }

    /**
     * 分析偏好
     */
    analyzePreferences() {
        const selectedBookObjects = this.selectedBooks.map(id => 
            this.gameBooks.find(book => book.id === id)
        );

        // 分析类型偏好
        const genrePrefs = {};
        const themePrefs = {};
        const complexitySum = selectedBookObjects.reduce((sum, book) => sum + book.complexity, 0);

        selectedBookObjects.forEach(book => {
            // 类型偏好
            genrePrefs[book.genre] = (genrePrefs[book.genre] || 0) + 1;
            
            // 主题偏好
            if (book.themes) {
                book.themes.forEach(theme => {
                    themePrefs[theme] = (themePrefs[theme] || 0) + 1;
                });
            }
        });

        this.preferences = {
            genres: genrePrefs,
            themes: themePrefs,
            averageComplexity: complexitySum / selectedBookObjects.length,
            preferredGenres: Object.entries(genrePrefs)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([genre]) => genre),
            preferredThemes: Object.entries(themePrefs)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([theme]) => theme)
        };
    }

    /**
     * 计算游戏效率
     * @param {number} gameTime - 游戏时间（毫秒）
     * @returns {string} 效率评级
     */
    calculateEfficiency(gameTime) {
        const minutes = gameTime / 60000;
        
        if (minutes <= 2) return '非常快';
        if (minutes <= 3) return '很快';
        if (minutes <= 4) return '正常';
        if (minutes <= 5) return '较慢';
        return '需要更多时间';
    }

    /**
     * 取消游戏
     */
    cancelGame() {
        this.gameState = 'idle';
        this.selectedBooks = [];
        this.preferences = {};
        this.emit('gameCancelled', { child: this.currentChild });
    }

    /**
     * 获取游戏状态
     * @returns {Object} 当前游戏状态
     */
    getGameState() {
        if (this.gameMode === 'comparison') {
            return {
                state: this.gameState,
                child: this.currentChild,
                mode: this.gameMode,
                progress: this.getComparisonProgress(),
                currentPair: this.comparisonData.currentPair,
                gameTime: this.startTime ? Date.now() - this.startTime : 0
            };
        }
        
        return {
            state: this.gameState,
            child: this.currentChild,
            mode: this.gameMode,
            selectedCount: this.selectedBooks.length,
            minRequired: this.config.grid.minSelections,
            maxAllowed: this.config.grid.maxSelections,
            canFinish: this.selectedBooks.length >= this.config.grid.minSelections,
            gameTime: this.startTime ? Date.now() - this.startTime : 0
        };
    }

    /**
     * 获取选中的书籍详情
     * @returns {Array} 选中的书籍对象列表
     */
    getSelectedBooksDetails() {
        return this.selectedBooks.map(id => 
            this.gameBooks.find(book => book.id === id)
        );
    }

    /**
     * 重置游戏引擎
     */
    reset() {
        this.currentChild = null;
        this.gameBooks = [];
        this.selectedBooks = [];
        this.gameState = 'idle';
        this.preferences = {};
        this.startTime = null;
    }

    /**
     * 获取游戏统计信息
     * @returns {Object} 统计信息
     */
    getGameStats() {
        if (this.gameState !== 'completed') {
            return null;
        }

        const selectedBookObjects = this.getSelectedBooksDetails();
        const genres = [...new Set(selectedBookObjects.map(book => book.genre))];
        const themes = selectedBookObjects.flatMap(book => book.themes || []);
        const uniqueThemes = [...new Set(themes)];

        return {
            totalSelected: this.selectedBooks.length,
            genresDiversity: genres.length,
            themesDiversity: uniqueThemes.length,
            averageComplexity: this.preferences.averageComplexity,
            gameTime: Date.now() - this.startTime,
            efficiency: this.calculateEfficiency(Date.now() - this.startTime),
            gameMode: this.gameMode
        };
    }

    // ========== 对比模式专用方法 ==========

    /**
     * 初始化对比模式
     */
    initializeComparisonMode() {
        // 初始化所有书籍的ELO评分
        this.comparisonData.bookScores.clear();
        this.gameBooks.forEach(book => {
            this.comparisonData.bookScores.set(book.id, 1200); // 初始ELO评分
        });

        this.comparisonData.comparisonIndex = 0;
        this.comparisonData.comparisonHistory = [];
        
        // 生成第一个对比
        this.generateNextComparison();
    }

    /**
     * 生成下一个对比对
     */
    generateNextComparison() {
        // 智能选择对比对：优先选择评分相近的书籍
        const availableBooks = [...this.gameBooks];
        const scores = Array.from(this.comparisonData.bookScores.entries());
        
        // 按评分排序
        scores.sort((a, b) => b[1] - a[1]);
        
        let book1, book2;
        
        // 尝试找到评分相近的两本书
        for (let i = 0; i < scores.length - 1; i++) {
            const candidate1 = availableBooks.find(b => b.id === scores[i][0]);
            const candidate2 = availableBooks.find(b => b.id === scores[i + 1][0]);
            
            if (candidate1 && candidate2) {
                book1 = candidate1;
                book2 = candidate2;
                break;
            }
        }
        
        // 如果没找到，随机选择
        if (!book1 || !book2) {
            const shuffled = getRandomBooks(availableBooks, 2);
            book1 = shuffled[0];
            book2 = shuffled[1];
        }

        this.comparisonData.currentPair = { book1, book2 };
    }

    /**
     * 更新ELO评分
     * @param {number} winnerId - 获胜者ID
     * @param {number} loserId - 失败者ID
     */
    updateEloScores(winnerId, loserId) {
        const K = 32; // ELO K因子
        
        const winnerScore = this.comparisonData.bookScores.get(winnerId);
        const loserScore = this.comparisonData.bookScores.get(loserId);
        
        // 计算期望得分
        const winnerExpected = 1 / (1 + Math.pow(10, (loserScore - winnerScore) / 400));
        const loserExpected = 1 / (1 + Math.pow(10, (winnerScore - loserScore) / 400));
        
        // 更新评分
        const newWinnerScore = winnerScore + K * (1 - winnerExpected);
        const newLoserScore = loserScore + K * (0 - loserExpected);
        
        this.comparisonData.bookScores.set(winnerId, newWinnerScore);
        this.comparisonData.bookScores.set(loserId, newLoserScore);
    }

    /**
     * 完成对比游戏
     * @returns {Object} 游戏结果
     */
    finishComparisonGame() {
        this.gameState = 'completed';
        const endTime = Date.now();
        const gameTime = endTime - this.startTime;

        // 分析对比偏好
        const preferences = this.analyzeComparisonPreferences();
        this.preferences = preferences;

        // 获取选中的书籍（基于ELO评分的前几名）
        const topBooks = this.getTopRatedBooks(5);
        this.selectedBooks = topBooks.map(book => book.id);

        const result = {
            success: true,
            child: this.currentChild,
            gameTime: gameTime,
            efficiency: this.calculateComparisonEfficiency(gameTime),
            selectedBooks: topBooks,
            preferences: preferences,
            gameMode: 'comparison',
            eloScores: Object.fromEntries(this.comparisonData.bookScores),
            comparisonHistory: this.comparisonData.comparisonHistory
        };

        this.emit('gameCompleted', result);
        return result;
    }

    /**
     * 分析对比偏好
     * @returns {Object} 偏好分析结果
     */
    analyzeComparisonPreferences() {
        const topBooks = this.getTopRatedBooks(8);
        const genreCount = {};
        let totalComplexity = 0;

        topBooks.forEach(book => {
            genreCount[book.genre] = (genreCount[book.genre] || 0) + 1;
            totalComplexity += book.complexity || 3;
        });

        return {
            genres: genreCount,
            averageComplexity: totalComplexity / topBooks.length,
            topBooks: topBooks.slice(0, 5),
            confidence: Math.min(0.95, this.comparisonData.comparisonIndex / this.config.comparison.totalComparisons)
        };
    }

    /**
     * 获取评分最高的书籍
     * @param {number} count - 数量
     * @returns {Array} 高评分书籍列表
     */
    getTopRatedBooks(count) {
        const scores = Array.from(this.comparisonData.bookScores.entries());
        scores.sort((a, b) => b[1] - a[1]);
        
        return scores.slice(0, count).map(([bookId, score]) => {
            const book = this.gameBooks.find(b => b.id === bookId);
            return { ...book, eloScore: score };
        });
    }

    /**
     * 获取对比进度
     * @returns {Object} 进度信息
     */
    getComparisonProgress() {
        return {
            current: this.comparisonData.comparisonIndex,
            total: this.config.comparison.totalComparisons,
            percentage: Math.round((this.comparisonData.comparisonIndex / this.config.comparison.totalComparisons) * 100)
        };
    }

    /**
     * 计算对比效率
     * @param {number} gameTime - 游戏时间
     * @returns {number} 效率分数
     */
    calculateComparisonEfficiency(gameTime) {
        const avgTimePerComparison = gameTime / this.comparisonData.comparisonIndex;
        const idealTime = 15000; // 理想情况下每次对比15秒
        
        if (avgTimePerComparison <= idealTime) return 1.0;
        if (avgTimePerComparison <= idealTime * 2) return 0.8;
        if (avgTimePerComparison <= idealTime * 3) return 0.6;
        return 0.4;
    }
}

// 创建全局游戏引擎实例
const gameEngine = new PreferenceGameEngine(); 