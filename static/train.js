let startTime;
let currentQuestion = 1;
let totalQuestions;
let questionTimes = [];
let timerInterval;
let testActive = false;

function startTest() {
    totalQuestions = parseInt(document.getElementById('num-questions').value);
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('training-view').style.display = 'block';
    document.getElementById('total-questions').textContent = totalQuestions;
    
    startTime = Date.now();
    testActive = true;
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);

    // Setup keyboard listener
    document.addEventListener('keydown', handleKeyPress);
}

function handleKeyPress(e) {
    if (!testActive) return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        completeQuestion();
    }
}

function completeQuestion() {
    if (currentQuestion >= totalQuestions) {
        endTest();
        return;
    }

    // Record time for the current question
    const currentTime = (Date.now() - startTime) / 1000;
    questionTimes.push(currentTime);

    // Update UI
    currentQuestion++;
    document.getElementById('current-question').textContent = currentQuestion;
    updateProgress();
    
    // Add pulse animation
    const timer = document.getElementById('timer');
    timer.classList.add('pulse');
    setTimeout(() => timer.classList.remove('pulse'), 500);
}

function updateTimer() {
    const currentTime = (Date.now() - startTime) / 1000;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateProgress() {
    const progress = (currentQuestion - 1) / totalQuestions * 100;
    document.getElementById('progress').style.width = `${progress}%`;
}

function endTest() {
    testActive = false;
    clearInterval(timerInterval);
    document.removeEventListener('keydown', handleKeyPress);

    // Record final time
    const finalTime = (Date.now() - startTime) / 1000;
    questionTimes.push(finalTime);

    // Save test data
    const testData = {
        totalQuestions: totalQuestions,
        questionTimes: questionTimes,
        testType: document.getElementById('test-type').value,
        date: new Date().toISOString()
    };

    // Send data to server
    fetch('/api/save_test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
    })
    .then(response => response.json())
    .then(data => {
        // Redirect to results page
        window.location.href = `/results/${data.test_id}`;
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error saving test results. Please try again.');
    });
}
