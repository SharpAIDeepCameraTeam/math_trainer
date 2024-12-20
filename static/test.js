let startTime = null;
let times = [];
let wrongQuestions = [];
let currentQuestion = 1;
let testInProgress = false;
let totalQuestions = 25;
let timerInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('keydown', handleSpacebar);
    updateUI();
});

function handleSpacebar(event) {
    if (event.code !== 'Space') return;
    event.preventDefault();
    
    if (!testInProgress) {
        startTest();
    } else {
        recordTime();
    }
}

function startTest() {
    testInProgress = true;
    startTime = Date.now();
    times = [];
    wrongQuestions = [];
    currentQuestion = 1;
    updateUI();
    startTimer();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        document.getElementById('timer').textContent = elapsed;
    }, 100);
}

function recordTime() {
    if (!testInProgress) return;
    
    const timeTaken = (Date.now() - startTime) / 1000;
    times.push(timeTaken);
    startTime = Date.now();
    currentQuestion++;
    
    if (currentQuestion > totalQuestions) {
        endTest();
    } else {
        updateUI();
        startTimer();
    }
}

function updateUI() {
    document.getElementById('questionNumber').textContent = currentQuestion;
    if (!testInProgress) {
        document.getElementById('timer').textContent = '0.0';
        document.getElementById('instructions').textContent = 'Press spacebar to start the test';
    } else {
        document.getElementById('instructions').textContent = 'Press spacebar after completing each problem';
    }
}

function endTest() {
    testInProgress = false;
    if (timerInterval) clearInterval(timerInterval);
    
    // Show wrong questions input
    const wrongInput = prompt('Enter wrong question numbers (comma-separated):');
    if (wrongInput) {
        wrongQuestions = wrongInput.split(',')
            .map(num => parseInt(num.trim()))
            .filter(num => !isNaN(num) && num > 0 && num <= totalQuestions);
    }
    
    // Submit test data
    fetch('/api/submit-test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            times: times,
            wrongQuestions: wrongQuestions
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.test_id) {
            window.location.href = `/results/${data.test_id}`;
        } else {
            throw new Error('No test ID received');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error submitting test results. Please try again.');
    });
}
