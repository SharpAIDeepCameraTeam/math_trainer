let testId = null;
let timerInterval = null;
let startTime = null;
let timeLimit = null;
let currentQuestion = 0;
let totalQuestions = 30;
let wrongQuestions = [];
let questionTimes = [];

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
    
    const testType = document.getElementById('test-type').value;
    const numQuestions = testType === 'mathcounts' ? 30 : parseInt(document.getElementById('num-questions').value);
    const timeLimitMinutes = testType === 'mathcounts' ? 40 : parseInt(document.getElementById('time-limit').value);
    
    const testData = {
        testType: testType,
        numQuestions: numQuestions,
        timeLimit: timeLimitMinutes
    };
    
    try {
        const response = await fetch('/api/start-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to start test');
        }
        
        const data = await response.json();
        testId = data.test_id;
        timeLimit = timeLimitMinutes * 60; // Convert to seconds
        startTime = Date.now();
        currentQuestion = 0;
        totalQuestions = numQuestions;
        wrongQuestions = [];
        questionTimes = [];
        
        // Update UI
        document.getElementById('progress').textContent = `Question 1/${numQuestions}`;
        document.getElementById('timer').textContent = `${timeLimitMinutes}:00`;
        
        // Start timer
        startTimer();
        
        // Show test screen
        showScreen('test');
    } catch (error) {
        alert('Failed to start test. Please try again.');
        console.error('Error:', error);
    }
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

// Question recording
async function recordQuestion(wrongData = null) {
    const questionTime = Math.floor((Date.now() - startTime) / 1000);
    questionTimes.push(questionTime);
    
    try {
        const response = await fetch('/api/record-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                test_id: testId,
                question_number: currentQuestion + 1,
                time: questionTime,
                wrong_data: wrongData
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to record question');
        }
        
        currentQuestion++;
        if (currentQuestion < totalQuestions) {
            document.getElementById('progress').textContent = 
                `Question ${currentQuestion + 1}/${totalQuestions}`;
        } else {
            endTest();
        }
    } catch (error) {
        console.error('Error recording question:', error);
    }
}

// Wrong question handling
const wrongQuestionModal = new bootstrap.Modal(document.getElementById('wrongQuestionModal'));

document.getElementById('wrong-answer').addEventListener('click', () => {
    wrongQuestionModal.show();
});

document.getElementById('save-category').addEventListener('click', async () => {
    const category = document.getElementById('category-select').value;
    await recordQuestion({ category: category });
    wrongQuestionModal.hide();
});

// Keyboard shortcuts
document.addEventListener('keydown', async (e) => {
    if (screens.test.classList.contains('d-none')) return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        await recordQuestion();
    } else if (e.code === 'KeyW') {
        e.preventDefault();
        wrongQuestionModal.show();
    } else if (e.code === 'KeyE') {
        e.preventDefault();
        endTest();
    }
});

// Test completion
document.getElementById('end-test').addEventListener('click', endTest);

async function endTest() {
    clearInterval(timerInterval);
    
    try {
        const response = await fetch(`/api/results/${testId}`);
        if (!response.ok) {
            throw new Error('Failed to get results');
        }
        
        const results = await response.json();
        
        // Update results screen
        document.getElementById('result-test-type').textContent = results.test_type;
        document.getElementById('result-questions').textContent = 
            `${results.completed_questions}/${results.total_questions}`;
        document.getElementById('result-total-time').textContent = 
            formatTime(results.total_time);
        document.getElementById('result-avg-time').textContent = 
            formatTime(results.total_time / results.completed_questions);
        
        // Create speed chart
        createSpeedChart(results.question_times);
        
        // Show guest banner for non-logged in users
        if (!results.user_id) {
            document.getElementById('guest-banner').classList.remove('d-none');
        }
        
        showScreen('results');
    } catch (error) {
        console.error('Error getting results:', error);
        alert('Failed to load results. Please try again.');
    }
}

// Chart creation
function createSpeedChart(times) {
    const ctx = document.getElementById('speedChart').getContext('2d');
    const timeData = times.map((time, index) => ({
        x: index + 1,
        y: index === 0 ? time : time - times[index - 1]
    }));
    
    if (window.speedChart) {
        window.speedChart.destroy();
    }
    
    window.speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Time per Question',
                data: timeData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Question Number'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Seconds'
                    }
                }
            }
        }
    });
}

// Utility functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

// New test button
document.getElementById('new-test').addEventListener('click', () => {
    testId = null;
    clearInterval(timerInterval);
    showScreen('setup');
});
