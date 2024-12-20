document.addEventListener('DOMContentLoaded', function() {
    // Time filter buttons
    const timeFilterButtons = document.querySelectorAll('.time-filter button');
    timeFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            timeFilterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateCharts(button.textContent.toLowerCase());
        });
    });

    // Initialize all charts
    initializeCharts();
    initializeHeatmap();
});

function initializeCharts() {
    // Accuracy Chart
    const accuracyCtx = document.getElementById('accuracyChart').getContext('2d');
    new Chart(accuracyCtx, {
        type: 'line',
        data: {
            labels: generateDateLabels(30),
            datasets: [{
                label: 'Accuracy',
                data: generateRandomData(30, 70, 100),
                borderColor: '#3498db',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(52, 152, 219, 0.1)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 60,
                    max: 100
                }
            }
        }
    });

    // Category Pie Chart
    const categoryCtx = document.getElementById('categoryPieChart').getContext('2d');
    new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: ['Geometry', 'Algebra', 'Number Theory', 'Combinatorics', 'Other'],
            datasets: [{
                data: [30, 25, 20, 15, 10],
                backgroundColor: [
                    '#3498db',
                    '#2ecc71',
                    '#e74c3c',
                    '#f1c40f',
                    '#95a5a6'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Speed Trend Chart
    const speedCtx = document.getElementById('speedTrendChart').getContext('2d');
    new Chart(speedCtx, {
        type: 'line',
        data: {
            labels: generateDateLabels(30),
            datasets: [{
                label: 'Average Time',
                data: generateRandomData(30, 30, 90),
                borderColor: '#2ecc71',
                tension: 0.4
            }]
        },
        options: {
            responsive: true
        }
    });

    // Time Distribution Chart
    const timeDistCtx = document.getElementById('timeDistributionChart').getContext('2d');
    new Chart(timeDistCtx, {
        type: 'bar',
        data: {
            labels: ['0-30s', '30-60s', '60-90s', '90-120s', '>120s'],
            datasets: [{
                label: 'Problems',
                data: [40, 30, 20, 8, 2],
                backgroundColor: '#3498db'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // Category Time Chart
    const categoryTimeCtx = document.getElementById('categoryTimeChart').getContext('2d');
    new Chart(categoryTimeCtx, {
        type: 'bar',
        data: {
            labels: ['Geometry', 'Algebra', 'Number Theory', 'Combinatorics', 'Other'],
            datasets: [{
                label: 'Average Time (seconds)',
                data: generateRandomData(5, 40, 80),
                backgroundColor: '#e74c3c'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // Mistake Pattern Chart
    const mistakeCtx = document.getElementById('mistakePatternChart').getContext('2d');
    new Chart(mistakeCtx, {
        type: 'radar',
        data: {
            labels: ['Calculation Errors', 'Concept Misunderstanding', 'Time Management', 'Problem Interpretation', 'Careless Mistakes'],
            datasets: [{
                label: 'Current Period',
                data: generateRandomData(5, 40, 100),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)'
            }, {
                label: 'Previous Period',
                data: generateRandomData(5, 40, 100),
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.2)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    // Challenging Categories Chart
    const challengingCtx = document.getElementById('challengingCategoriesChart').getContext('2d');
    new Chart(challengingCtx, {
        type: 'horizontalBar',
        data: {
            labels: ['Complex Numbers', 'Vectors', 'Integration', 'Probability', 'Sequences'],
            datasets: [{
                label: 'Error Rate (%)',
                data: generateRandomData(5, 20, 60),
                backgroundColor: '#e74c3c'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function initializeHeatmap() {
    const cal = new CalHeatmap();
    cal.paint({
        data: generateHeatmapData(),
        range: 12,
        domain: {
            type: 'month'
        },
        subDomain: {
            type: 'day'
        }
    });
}

// Helper functions
function generateDateLabels(days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return labels;
}

function generateRandomData(count, min, max) {
    return Array.from({ length: count }, () => 
        Math.floor(Math.random() * (max - min + 1)) + min
    );
}

function generateHeatmapData() {
    const data = {};
    const today = new Date();
    for (let i = 365; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        if (Math.random() > 0.5) {
            data[date.getTime() / 1000] = Math.floor(Math.random() * 10);
        }
    }
    return data;
}

function updateCharts(timeRange) {
    // Update charts based on selected time range
    // This would typically involve fetching new data from the server
    console.log(`Updating charts for time range: ${timeRange}`);
}
