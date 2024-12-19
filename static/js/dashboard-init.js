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
    const todayMinutes = data.practice?.minutes?.[data.practice.minutes.length - 1] || 0;
    const avgAccuracy = data.category?.accuracy?.[0] || 0;
    const streak = data.practice?.streak || 0;
    const problemsToday = data.practice?.problems_today || 0;

    document.getElementById('todayPractice').textContent = todayMinutes + ' minutes';
    document.getElementById('currentStreak').textContent = streak + ' days';
    document.getElementById('problemsToday').textContent = problemsToday;
    document.getElementById('avgAccuracy').textContent = avgAccuracy.toFixed(1) + '%';
}

// Function to update recent activity
function updateRecentActivity(data) {
    const tbody = document.getElementById('recent-activity-body');
    if (!data.tests || data.tests.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="5" class="text-center">No recent activity</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = data.tests.map(test => `
        <tr>
            <td>${test.date}</td>
            <td>${test.test_type}</td>
            <td>${test.accuracy.toFixed(1)}%</td>
            <td>${test.time} min</td>
            <td>
                <a href="/results/${test.id}" class="btn btn-sm btn-outline-primary">View</a>
            </td>
        </tr>
    `).join('');
}

// Function to update test tabs
function updateTestTabs(data) {
    const container = document.getElementById('test-tabs');
    if (!data.tests || data.tests.length === 0) {
        container.innerHTML = `
            <div class="no-data text-center p-4">
                No past tests available
            </div>`;
        return;
    }

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

    // Initialize mini charts
    data.tests.forEach((test, index) => {
        const ctx = document.getElementById(`testChart${index + 1}`);
        if (ctx) {
            new Chart(ctx, {
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
                options: dashboardConfig.test.options.options
            });
        }
    });
}

// Function to initialize charts
function initializeCharts(data) {
    // Practice Time Chart
    const practiceCtx = document.getElementById('practiceTimeChart');
    if (practiceCtx && data.practice?.dates) {
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
            options: dashboardConfig.practice.options.options
        });
    }

    // Category Performance Chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx && data.category?.names) {
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
            options: dashboardConfig.category.options.options
        });
    }
}

// Function to initialize dashboard
function initializeDashboard() {
    if (!window.dashboardData) {
        console.error('Dashboard data not available');
        document.querySelectorAll('.no-data').forEach(el => el.style.display = 'block');
        return;
    }

    try {
        updateStats(window.dashboardData);
        updateRecentActivity(window.dashboardData);
        updateTestTabs(window.dashboardData);
        initializeCharts(window.dashboardData);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        document.querySelectorAll('.no-data').forEach(el => el.style.display = 'block');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);
