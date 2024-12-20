let testId = null;
let timerInterval = null;
let startTime = 0;
let questionStartTime = 0;
let currentQuestion = 0;
let totalQuestions = 25;
let times = [];
let testStarted = false;
let testFinished = false;
let wrongQuestions = [];

// Screen management
const screens = {
    setup: document.getElementById('setup-screen'),
    test: document.getElementById('test-screen'),
    results: document.getElementById('results-screen')
};

function showScreen(screenName) {
    Object.entries(screens).forEach(([name, element]) => {
        element.classList.toggle('d-none', name !== screenName);
    });
}

// Setup form handling
document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const testData = {
        testType: document.getElementById('test-type').value,
        numQuestions: document.getElementById('num-questions').value,
        timeLimit: document.getElementById('time-limit').value
    };
    
    const response = await fetch('/api/start-test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
    });
    
    const data = await response.json();
    testId = data.test_id;
    timeLimit = testData.timeLimit * 60; // Convert to seconds
    startTime = 0;
    questionStartTime = 0;
    currentQuestion = 0;
    totalQuestions = testData.numQuestions;
    times = [];
    testStarted = false;
    testFinished = false;
    wrongQuestions = [];
    
    // Update UI
    document.getElementById('progress').textContent = 
        `Question: ${currentQuestion}/${testData.numQuestions}`;
    
    // Show instructions
    const instructions = document.createElement('div');
    instructions.className = 'alert alert-info text-center mb-4';
    instructions.innerHTML = `
        <strong>Instructions:</strong><br>
        Press <kbd>Space</kbd> to mark a question as completed.<br>
        Press <kbd>W</kbd> to mark a question as wrong and select its category.
    `;
    document.querySelector('.card-body').insertBefore(
        instructions, 
        document.querySelector('.timer-container')
    );
    
    // Show test screen
    showScreen('test');
});

// Timer management
function startTimer() {
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = timeLimit - elapsed;
    
    if (remaining <= 0) {
        clearInterval(timerInterval);
        endTest();
        return;
    }
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update timer ring color based on remaining time
    const progress = (remaining / timeLimit) * 100;
    const ring = document.querySelector('.timer-ring');
    ring.style.borderTopColor = getTimerColor(progress);
}

function getTimerColor(progress) {
    if (progress > 66) return '#28a745'; // Green
    if (progress > 33) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
}

// Question recording with animation
document.addEventListener('keydown', async (e) => {
    if (screens.test.classList.contains('d-none')) return;
    
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); // Prevent scrolling
        handleSpacebar();
    } else if (e.code === 'KeyW') {
        e.preventDefault();
        showWrongQuestionModal();
    }
});

async function handleSpacebar() {
    if (!testStarted) {
        // Start the test
        startTest();
    } else if (!testFinished) {
        // Record time and move to next question
        recordTimeAndNextQuestion();
    }
}

function startTest() {
    testStarted = true;
    startTime = Date.now();
    questionStartTime = startTime;
    currentQuestion = 1;
    generateQuestion();
    updateDisplay();
    startTimer();
}

function recordTimeAndNextQuestion() {
    const currentTime = Date.now();
    const questionTime = (currentTime - questionStartTime) / 1000;
    times.push(questionTime);
    
    if (currentQuestion < totalQuestions) {
        // Move to next question
        currentQuestion++;
        questionStartTime = currentTime;
        generateQuestion();
        updateDisplay();
    } else {
        // Test is finished
        finishTest();
    }
}

function finishTest() {
    testFinished = true;
    const totalTime = (Date.now() - startTime) / 1000;
    
    // Show completion message and prompt for wrong questions
    document.getElementById('question').innerHTML = `
        Test completed in ${totalTime.toFixed(1)} seconds!<br>
        Enter any wrong question numbers (comma-separated):
        <input type="text" id="wrongQuestionInput" class="form-control mt-2">
        <button onclick="submitTest()" class="btn btn-primary mt-2">Submit</button>
    `;
    
    document.getElementById('questionNumber').textContent = 'Complete!';
    document.getElementById('timer').textContent = totalTime.toFixed(1);
}

function generateQuestion() {
    const num1 = Math.floor(Math.random() * 12) + 1;
    const num2 = Math.floor(Math.random() * 12) + 1;
    document.getElementById('question').textContent = `${num1} × ${num2} = ?`;
}

function updateDisplay() {
    document.getElementById('questionNumber').textContent = testStarted ? 
        `Question ${currentQuestion}/${totalQuestions}` : 
        'Press spacebar to start';
        
    if (testStarted && !testFinished) {
        const currentTime = (Date.now() - startTime) / 1000;
        document.getElementById('timer').textContent = currentTime.toFixed(1);
        requestAnimationFrame(updateDisplay);
    }
}

function submitTest() {
    const wrongInput = document.getElementById('wrongQuestionInput').value;
    wrongQuestions = wrongInput.split(',')
        .map(num => num.trim())
        .filter(num => num !== '')
        .map(num => parseInt(num))
        .filter(num => !isNaN(num) && num > 0 && num <= totalQuestions);
    
    // First start the test
    fetch('/api/start-test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.test_id) {
            // Then record the test results
            return fetch('/api/record-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    testId: data.test_id,
                    times: times,
                    totalTime: (Date.now() - startTime) / 1000,
                    totalQuestions: totalQuestions,
                    completedQuestions: totalQuestions,
                    wrongQuestions: wrongQuestions
                })
            });
        } else {
            throw new Error('Failed to start test');
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.test_id) {
            window.location.href = `/results/${data.test_id}`;
        } else {
            alert('Error submitting test results');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error submitting test results');
    });
}

// Show wrong question modal
function showWrongQuestionModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('wrongQuestionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wrongQuestionModal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Mark Question as Wrong</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="wrong-question-form">
                            <div class="mb-3">
                                <label class="form-label">Category</label>
                                <select class="form-select" id="category-select" required>
                                    <option value="">Select category...</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Subcategory</label>
                                <select class="form-select" id="subcategory-select" required disabled>
                                    <option value="">Select subcategory...</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="save-wrong-question">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Initialize category select
        fetch('/api/categories')
            .then(response => response.json())
            .then(categories => {
                const categorySelect = document.getElementById('category-select');
                Object.keys(categories).forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                });
                
                // Handle category change
                categorySelect.addEventListener('change', () => {
                    const subcategorySelect = document.getElementById('subcategory-select');
                    subcategorySelect.innerHTML = '<option value="">Select subcategory...</option>';
                    subcategorySelect.disabled = true;
                    
                    const category = categorySelect.value;
                    if (category && categories[category]) {
                        subcategorySelect.disabled = false;
                        categories[category].forEach(subcategory => {
                            const option = document.createElement('option');
                            option.value = subcategory;
                            option.textContent = subcategory;
                            subcategorySelect.appendChild(option);
                        });
                    }
                });
                
                // Handle save
                document.getElementById('save-wrong-question').addEventListener('click', async () => {
                    const category = document.getElementById('category-select').value;
                    const subcategory = document.getElementById('subcategory-select').value;
                    
                    if (category && subcategory) {
                        wrongQuestions.push({
                            question: currentQuestion,
                            category: category,
                            subcategory: subcategory
                        });
                        bootstrap.Modal.getInstance(modal).hide();
                    }
                });
            });
    }
    
    // Show modal
    new bootstrap.Modal(modal).show();
}

// Test completion
document.getElementById('end-test').addEventListener('click', endTest);

async function endTest() {
    clearInterval(timerInterval);
    
    // Fetch and display results
    const response = await fetch(`/api/get-results/${testId}`);
    const results = await response.json();
    
    // Update results screen
    document.getElementById('result-test-type').textContent = results.test_type;
    document.getElementById('result-questions').textContent = 
        `${results.completed_questions}/${results.total_questions}`;
    document.getElementById('result-total-time').textContent = results.total_time;
    
    // Show/hide guest banner
    const guestBanner = document.getElementById('guest-banner');
    if (results.is_guest) {
        guestBanner.classList.remove('d-none');
    } else {
        guestBanner.classList.add('d-none');
    }
    
    // Create timing breakdown list with wrong question indicators
    const timesList = document.getElementById('question-times');
    timesList.innerHTML = '';
    results.question_times.forEach((time, index) => {
        const isWrong = wrongQuestions.some(q => q.question === index + 1);
        const item = document.createElement('div');
        item.className = `list-group-item ${isWrong ? 'list-group-item-danger' : ''}`;
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>Question ${index + 1}</span>
                <div>
                    <span class="me-3">${time}</span>
                    ${isWrong ? `<span class="badge bg-danger">Wrong</span>` : ''}
                </div>
            </div>
            ${isWrong ? `
                <small class="text-muted">
                    Category: ${wrongQuestions.find(q => q.question === index + 1).category} - 
                    ${wrongQuestions.find(q => q.question === index + 1).subcategory}
                </small>
            ` : ''}
        `;
        timesList.appendChild(item);
    });
    
    // Create speed analysis chart
    createSpeedChart(results.question_times);
    
    showScreen('results');
}

function createSpeedChart(times) {
    // Convert MM:SS format to seconds for the chart
    const speedData = times.map(time => {
        const [minutes, seconds] = time.split(':').map(Number);
        return minutes * 60 + seconds;
    });
    
    // Calculate moving average for trend line
    const movingAverage = calculateMovingAverage(speedData, 3);
    
    if (speedChart) {
        speedChart.destroy();
    }
    
    const ctx = document.getElementById('speedChart').getContext('2d');
    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: speedData.map((_, index) => `Q${index + 1}`),
            datasets: [
                {
                    label: 'Time per Question',
                    data: speedData,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true
                },
                {
                    label: 'Trend',
                    data: movingAverage,
                    borderColor: '#28a745',
                    borderDash: [5, 5],
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Time Spent per Question'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Seconds'
                    }
                }
            }
        }
    });
}

function calculateMovingAverage(data, window) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - window + 1); j <= Math.min(data.length - 1, i + window - 1); j++) {
            sum += data[j];
            count++;
        }
        result.push(sum / count);
    }
    return result;
}

// New test button
document.getElementById('new-test').addEventListener('click', () => {
    testId = null;
    clearInterval(timerInterval);
    if (speedChart) {
        speedChart.destroy();
        speedChart = null;
    }
    showScreen('setup');
});

document.addEventListener('DOMContentLoaded', function() {
    updateDisplay();
    document.getElementById('timer').textContent = '0.0';
});
