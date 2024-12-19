let currentQuestion = 1;
let startTime = null;
let testActive = true;
let testData = null;

function updateTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const progress = (1 - timeLeft / testData.timeLimit) * 100;
    document.querySelector('.timer-ring').style.transform = 
        `rotate(${progress * 3.6}deg)`;
}

function updateProgress() {
    const progress = (currentQuestion / testData.totalQuestions) * 100;
    document.getElementById('progress').textContent = 
        `Question ${currentQuestion}/${testData.totalQuestions}`;
    document.getElementById('progress-bar').style.width = `${progress}%`;

    // Add pulse animation
    const display = document.querySelector('.question-display');
    display.classList.add('pulse');
    setTimeout(() => display.classList.remove('pulse'), 500);
}

function recordQuestion(isWrong = false, category = null) {
    const questionData = {
        test_id: testData.testId,
        question_number: currentQuestion,
        time: Math.floor(Date.now() / 1000) - testData.startTime
    };

    if (isWrong && category) {
        questionData.wrong_data = { category };
    }

    fetch('/api/record-question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentQuestion++;
            updateProgress();
            
            if (currentQuestion > testData.totalQuestions) {
                endTest();
            }
        }
    })
    .catch(error => console.error('Error:', error));
}

function endTest() {
    testActive = false;
    clearInterval(timer);
    window.location.href = `/results/${testData.testId}`;
}

function loadCategories() {
    fetch('/api/categories')
        .then(response => response.json())
        .then(data => {
            const categorySelect = document.getElementById('categorySelect');
            categorySelect.innerHTML = data.categories.map(category => `
                <div class="category-group">
                    <h6>${category.name}</h6>
                    <div class="subcategory-list">
                        ${category.subcategories.map(sub => `
                            <div class="subcategory-item">
                                <label>
                                    <input type="radio" name="category" value="${category.name}/${sub}">
                                    ${sub}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading categories:', error);
            document.getElementById('categorySelect').innerHTML = `
                <div class="alert alert-danger">
                    Error loading categories. Please try again.
                </div>
            `;
        });
}

function initializeTest() {
    // Get test_id from URL if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('test_id');

    fetch(`/test/data${testId ? `/${testId}` : ''}`)
        .then(response => response.json())
        .then(data => {
            testData = data;
            currentQuestion = 1;
            startTime = new Date();
            
            updateProgress();
            
            // Start timer
            let timeLeft = testData.timeLimit;
            const timer = setInterval(() => {
                if (testActive) {
                    timeLeft--;
                    updateTimer(timeLeft);
                    
                    if (timeLeft <= 0) {
                        endTest();
                    }
                }
            }, 1000);
        })
        .catch(error => {
            console.error('Error loading test data:', error);
            document.querySelector('.test-container').innerHTML = `
                <div class="alert alert-danger">
                    Error loading test. Please try again later.
                </div>
            `;
        });

    // Load categories for the wrong question modal
    loadCategories();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!testActive) return;
        
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            recordQuestion();
        } else if (e.key.toLowerCase() === 'w' && !e.repeat) {
            e.preventDefault();
            const modal = new bootstrap.Modal(document.getElementById('wrongQuestionModal'));
            modal.show();
        } else if (e.key.toLowerCase() === 'e' && !e.repeat) {
            e.preventDefault();
            endTest();
        }
    });

    // Button handlers
    document.getElementById('wrong-answer').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('wrongQuestionModal'));
        modal.show();
    });

    document.getElementById('end-test').addEventListener('click', endTest);

    document.getElementById('saveCategoryBtn').addEventListener('click', () => {
        const selectedCategory = document.querySelector('input[name="category"]:checked');
        if (selectedCategory) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('wrongQuestionModal'));
            modal.hide();
            recordQuestion(true, selectedCategory.value);
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTest);
