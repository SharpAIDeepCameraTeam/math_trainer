function createAccuracyTrendChart(data) {
    const ctx = document.getElementById('accuracyTrendChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.accuracy_trend.map(point => point.date),
            datasets: [{
                label: 'Accuracy %',
                data: data.accuracy_trend.map(point => point.accuracy),
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
                    max: 100,
                    title: {
                        display: true,
                        text: 'Accuracy (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

function createTimeTrendChart(data) {
    const ctx = document.getElementById('timeTrendChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.time_trend.map(point => point.date),
            datasets: [{
                label: 'Time (minutes)',
                data: data.time_trend.map(point => point.time / 60),
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
                        text: 'Time (minutes)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

function createCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: data.categories.names,
            datasets: [{
                label: 'Accuracy by Category',
                data: data.categories.accuracy,
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: '#667eea',
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#667eea'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function updateStats(data) {
    const stats = {
        averageAccuracy: data.accuracy_trend.reduce((sum, point) => sum + point.accuracy, 0) / data.accuracy_trend.length,
        averageTime: data.time_trend.reduce((sum, point) => sum + point.time, 0) / data.time_trend.length / 60,
        totalTests: data.accuracy_trend.length,
        bestCategory: ''
    };

    // Find best category
    if (data.categories.accuracy.length > 0) {
        const maxAccuracy = Math.max(...data.categories.accuracy);
        const maxIndex = data.categories.accuracy.indexOf(maxAccuracy);
        stats.bestCategory = data.categories.names[maxIndex];
    }

    // Update DOM
    document.getElementById('averageAccuracy').textContent = stats.averageAccuracy.toFixed(1) + '%';
    document.getElementById('averageTime').textContent = stats.averageTime.toFixed(1) + ' minutes';
    document.getElementById('totalTests').textContent = stats.totalTests;
    document.getElementById('bestCategory').textContent = stats.bestCategory || 'N/A';
}

function initializeAnalytics() {
    fetch('/analytics/data')
        .then(response => response.json())
        .then(data => {
            createAccuracyTrendChart(data);
            createTimeTrendChart(data);
            createCategoryChart(data);
            updateStats(data);
        })
        .catch(error => console.error('Error loading analytics data:', error));
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAnalytics);
