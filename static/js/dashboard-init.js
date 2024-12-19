// Initialize chart data and configuration
const dashboardConfig = {
    practice: {
        chart: null,
        options: {
            type: 'bar',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        }
    },
    category: {
        chart: null,
        options: {
            type: 'radar',
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        }
    },
    test: {
        charts: [],
        options: {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                            text: 'Question'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        }
    }
};

// Function to update stats
function updateStats(data) {
    document.getElementById('todayPractice').textContent = data.practice.minutes[data.practice.minutes.length - 1] + ' minutes';
    document.getElementById('avgAccuracy').textContent = data.category.accuracy[0].toFixed(1) + '%';
}

// Function to update recent activity
function updateRecentActivity(data) {
    const tbody = document.getElementById('recent-activity-body');
    tbody.innerHTML = data.tests.map(test => `
        <tr>
            <td>${test.date}</td>
            <td>${test.test_type}</td>
            <td>${test.accuracy.toFixed(1)}%</td>
            <td>${test.time} min</td>
        </tr>
    `).join('');
}

// Function to update test tabs
function updateTestTabs(data) {
    const container = document.getElementById('test-tabs');
    container.innerHTML = data.tests.map((test, index) => `
        <div class="test-tab">
            <h4>${test.date} - ${test.test_type}</h4>
            <div class="test-stats">
                <div class="test-stat">
                    <div class="test-stat-value">${test.accuracy.toFixed(1)}%</div>
                    <div class="test-stat-label">Accuracy</div>
                </div>
                <div class="test-stat">
                    <div class="test-stat-value">${test.time}m</div>
                    <div class="test-stat-label">Time</div>
                </div>
                <div class="test-stat">
                    <div class="test-stat-value">${test.total_questions}</div>
                    <div class="test-stat-label">Questions</div>
                </div>
                <div class="test-stat">
                    <div class="test-stat-value">${test.correct_answers}</div>
                    <div class="test-stat-label">Correct</div>
                </div>
            </div>
            <canvas id="testChart${index + 1}" class="mini-chart"></canvas>
            <a href="/results/${test.id}" class="view-details">View Details →</a>
        </div>
    `).join('');
}

// Function to initialize charts
function initializeCharts(data) {
    // Practice Time Chart
    const practiceCtx = document.getElementById('practiceTimeChart');
    if (practiceCtx) {
        new Chart(practiceCtx, {
            type: 'bar',
            data: {
                labels: data.practice.dates,
                datasets: [{
                    label: 'Minutes Practiced',
                    data: data.practice.minutes,
                    backgroundColor: '#667eea',
                    borderRadius: 5
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
                            text: 'Minutes'
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

    // Category Performance Chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        new Chart(categoryCtx, {
            type: 'radar',
            data: {
                labels: data.category.names,
                datasets: [{
                    label: 'Accuracy',
                    data: data.category.accuracy,
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    borderColor: '#667eea',
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#667eea'
                }]
            },
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // Past Tests Charts
    data.tests.forEach((test, index) => {
        const testCtx = document.getElementById(`testChart${index + 1}`);
        if (testCtx) {
            new Chart(testCtx, {
                type: 'line',
                data: {
                    labels: test.question_numbers,
                    datasets: [{
                        label: 'Time per Question',
                        data: test.question_times,
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
                                text: 'Seconds'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Question'
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
    });
}

// Function to initialize dashboard
function initializeDashboard() {
    const data = window.dashboardData;
    if (!data) return;

    updateStats(data);
    updateRecentActivity(data);
    updateTestTabs(data);
    initializeCharts(data);

    // Time filter handling
    const filterButtons = document.querySelectorAll('.time-filter button');
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const activeButton = document.querySelector('.time-filter button.active');
                if (activeButton) {
                    activeButton.classList.remove('active');
                }
                this.classList.add('active');
            });
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);
