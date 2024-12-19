function createTimeChart(data) {
    const ctx = document.getElementById('timeChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: data.question_times.length }, (_, i) => `Q${i + 1}`),
            datasets: [{
                label: 'Time per Question',
                data: data.question_times,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Question Number'
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

function updateSummaryStats(data) {
    // Update summary statistics
    document.getElementById('totalQuestions').textContent = data.total_questions;
    document.getElementById('correctAnswers').textContent = data.total_questions - data.wrong_questions.length;
    document.getElementById('accuracy').textContent = data.accuracy.toFixed(1) + '%';
    
    const totalTimeMinutes = Math.floor(data.total_time / 60);
    const totalTimeSeconds = Math.round(data.total_time % 60);
    document.getElementById('totalTime').textContent = 
        `${totalTimeMinutes}m ${totalTimeSeconds}s`;
    
    const avgTimePerQuestion = data.total_time / data.total_questions;
    document.getElementById('avgTime').textContent = 
        avgTimePerQuestion.toFixed(1) + 's';
}

function createWrongQuestionsList(data) {
    const container = document.getElementById('wrongQuestionsList');
    if (!container) return;

    if (data.wrong_questions.length === 0) {
        container.innerHTML = '<p class="text-success">Perfect score! No wrong answers.</p>';
        return;
    }

    const wrongQuestionsHTML = data.wrong_questions.map((question, index) => `
        <div class="wrong-question-card">
            <div class="question-header">
                <span class="question-number">Question ${index + 1}</span>
                <span class="question-category">${question.category || 'Uncategorized'}</span>
            </div>
            <div class="question-content">
                <div class="question-text">${question.question}</div>
                <div class="answers">
                    <div class="wrong-answer">
                        <span class="label">Your Answer:</span>
                        <span class="value text-danger">${question.user_answer}</span>
                    </div>
                    <div class="correct-answer">
                        <span class="label">Correct Answer:</span>
                        <span class="value text-success">${question.correct_answer}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = wrongQuestionsHTML;
}

function updateTestInfo(data) {
    document.getElementById('testType').textContent = data.test_type;
    document.getElementById('testDate').textContent = data.date;
}

function initializeResults() {
    // Get test_id from URL
    const pathParts = window.location.pathname.split('/');
    const testId = pathParts[pathParts.length - 1];

    fetch(`/results/data/${testId}`)
        .then(response => response.json())
        .then(data => {
            updateTestInfo(data);
            updateSummaryStats(data);
            createTimeChart(data);
            createWrongQuestionsList(data);
        })
        .catch(error => {
            console.error('Error loading results data:', error);
            document.querySelector('.results-container').innerHTML = `
                <div class="alert alert-danger">
                    Error loading test results. Please try again later.
                </div>
            `;
        });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeResults);
