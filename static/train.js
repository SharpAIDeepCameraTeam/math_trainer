let currentProblem = null;
let startTime = null;
let totalProblems = 0;
let correctAnswers = 0;
let problemHistory = [];
let performanceChart = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    generateNewProblem();
    startTimer();

    document.getElementById('answer').addEventListener('keydown', function(e) {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            checkAnswer();
        }
    });
});

function initializeChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Response Time (seconds)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Seconds'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Problem Number'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function generateNewProblem() {
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1, num2;

    switch (operation) {
        case '+':
            num1 = Math.floor(Math.random() * 100) + 1;
            num2 = Math.floor(Math.random() * 100) + 1;
            break;
        case '-':
            num1 = Math.floor(Math.random() * 100) + 1;
            num2 = Math.floor(Math.random() * num1) + 1;
            break;
        case '*':
            num1 = Math.floor(Math.random() * 12) + 1;
            num2 = Math.floor(Math.random() * 12) + 1;
            break;
    }

    currentProblem = {
        num1: num1,
        num2: num2,
        operation: operation,
        answer: eval(`${num1} ${operation} ${num2}`),
        startTime: new Date()
    };

    const problemCard = document.getElementById('problemCard');
    problemCard.classList.add('fade-out');
    
    setTimeout(() => {
        document.getElementById('problem').textContent = `${num1} ${operation} ${num2} = ?`;
        const answerInput = document.getElementById('answer');
        answerInput.value = '';
        answerInput.focus();
        
        problemCard.classList.remove('fade-out');
        problemCard.classList.add('fade-in');
        setTimeout(() => problemCard.classList.remove('fade-in'), 300);
    }, 300);
}

function checkAnswer() {
    const userAnswer = parseInt(document.getElementById('answer').value);
    if (isNaN(userAnswer)) return;

    const endTime = new Date();
    const timeTaken = (endTime - currentProblem.startTime) / 1000;
    const isCorrect = userAnswer === currentProblem.answer;

    totalProblems++;
    if (isCorrect) correctAnswers++;

    // Update stats
    document.getElementById('correctCount').textContent = correctAnswers;
    document.getElementById('accuracy').textContent = 
        Math.round((correctAnswers / totalProblems) * 100) + '%';

    // Update feedback
    const feedback = document.getElementById('feedback');
    feedback.textContent = isCorrect ? 'Correct!' : `Incorrect. The answer was ${currentProblem.answer}`;
    feedback.className = 'result-feedback ' + (isCorrect ? 'correct' : 'incorrect');

    // Update chart
    problemHistory.push({
        problemNumber: totalProblems,
        timeTaken: timeTaken,
        correct: isCorrect
    });

    updateChart();

    // Generate new problem with animation
    setTimeout(generateNewProblem, 1000);
}

function updateChart() {
    const labels = problemHistory.map(p => p.problemNumber);
    const data = problemHistory.map(p => p.timeTaken);

    performanceChart.data.labels = labels;
    performanceChart.data.datasets[0].data = data;
    performanceChart.update('show');
}

function startTimer() {
    startTime = new Date();
    updateTimer();
}

function updateTimer() {
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    document.getElementById('totalTime').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    requestAnimationFrame(updateTimer);
}

// Handle space key globally
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && e.target.id !== 'answer') {
        e.preventDefault();
        document.getElementById('answer').focus();
    }
});
