let testId = null;
let timerInterval = null;
let startTime = null;
let timeLimit = null;
let speedChart = null;

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
    startTime = Date.now();
    
    // Update UI
    document.getElementById('progress').textContent = 
        `Question: 0/${testData.numQuestions}`;
    
    // Start timer
    startTimer();
    
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
    if (e.code === 'Space' && screens.test.classList.contains('d-none') === false) {
        e.preventDefault();
        
        // Trigger animation
        const ripple = document.querySelector('.ripple-container');
        ripple.classList.add('space-pressed');
        setTimeout(() => ripple.classList.remove('space-pressed'), 500);
        
        const response = await fetch('/api/record-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ testId })
        });
        
        const data = await response.json();
        
        // Update progress with animation
        const progress = document.getElementById('progress');
        progress.style.transform = 'scale(1.1)';
        setTimeout(() => progress.style.transform = 'scale(1)', 200);
        
        const [_, total] = progress.textContent.split('/');
        progress.textContent = `Question: ${data.current_question}/${total}`;
        
        if (data.completed) {
            endTest();
        }
    }
});

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
    
    // Create timing breakdown list
    const timesList = document.getElementById('question-times');
    timesList.innerHTML = '';
    results.question_times.forEach((time, index) => {
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.innerHTML = `
            <span>Question ${index + 1}</span>
            <span>${time}</span>
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
