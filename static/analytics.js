document.addEventListener('DOMContentLoaded', function() {
    // Set Chart.js defaults
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    Chart.defaults.plugins.tooltip.titleColor = '#fff';
    Chart.defaults.plugins.tooltip.bodyColor = '#fff';
    Chart.defaults.plugins.tooltip.borderWidth = 0;
    Chart.defaults.plugins.tooltip.borderRadius = 4;
    
    loadAnalyticsData();
});

function loadAnalyticsData() {
    showLoadingState();
    
    fetch('/api/analytics/data')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            hideLoadingState();
            showContent();
            renderAnalytics(data);
        })
        .catch(error => {
            console.error('Error loading analytics:', error);
            showErrorState();
        });
}

function showLoadingState() {
    document.getElementById('loadingState').classList.remove('d-none');
    document.getElementById('analyticsContent').classList.add('d-none');
    document.getElementById('errorState').classList.add('d-none');
}

function hideLoadingState() {
    document.getElementById('loadingState').classList.add('d-none');
}

function showContent() {
    document.getElementById('analyticsContent').classList.remove('d-none');
}

function showErrorState() {
    document.getElementById('errorState').classList.remove('d-none');
    document.getElementById('loadingState').classList.add('d-none');
}

function renderAnalytics(data) {
    // Calculate and render missed problems breakdown
    const totalWrong = Object.values(data.wrongQuestionsByCategory).reduce((a, b) => a + b, 0);
    const missedBreakdown = document.getElementById('missedProblemsBreakdown');
    if (totalWrong > 0) {
        const breakdownHtml = Object.entries(data.wrongQuestionsByCategory)
            .map(([category, count]) => {
                const percentage = ((count / totalWrong) * 100).toFixed(1);
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="category-name">${category}</div>
                        <div class="category-stats">
                            <span class="badge bg-danger">${percentage}%</span>
                            <span class="ms-2">(${count} problems)</span>
                        </div>
                    </div>
                    <div class="progress mb-3" style="height: 10px;">
                        <div class="progress-bar bg-danger" role="progressbar" 
                             style="width: ${percentage}%" 
                             aria-valuenow="${percentage}" 
                             aria-valuemin="0" 
                             aria-valuemax="100"></div>
                    </div>`;
            }).join('');
        missedBreakdown.innerHTML = breakdownHtml;
    } else {
        missedBreakdown.innerHTML = '<p class="text-muted">No missed problems yet!</p>';
    }

    // Update overview stats
    document.getElementById('totalTests').textContent = data.totalTests;
    document.getElementById('averageTime').textContent = Math.round(data.averageTime) + 's';
    document.getElementById('totalQuestions').textContent = data.totalQuestions;
    document.getElementById('completionRate').textContent = 
        Math.round((data.completedQuestions / data.totalQuestions) * 100) + '%';
    
    // Render charts
    renderPerformanceChart(data);
    renderTimeDistributionChart(data.timeDistribution);
    renderCategoryChart(data);
    renderRecentTests(data.recentTests);
    renderCategoryBreakdown(data.categoryBreakdown);
}

function renderPerformanceChart(data) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    const chart = Chart.getChart(ctx);
    if (chart) {
        chart.destroy();
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.testDates,
            datasets: [{
                label: 'Average Time per Question',
                data: data.improvementTrend.map(t => t.avgTime),
                borderColor: '#007bff',
                tension: 0.1,
                fill: false
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

function renderTimeDistributionChart(distribution) {
    const ctx = document.getElementById('timeDistributionChart');
    if (!ctx) return;
    
    const chart = Chart.getChart(ctx);
    if (chart) {
        chart.destroy();
    }
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['<30s', '30-60s', '60-90s', '>90s'],
            datasets: [{
                data: [
                    distribution.under30s,
                    distribution['30to60s'],
                    distribution['60to90s'],
                    distribution.over90s
                ],
                backgroundColor: [
                    '#28a745',
                    '#17a2b8',
                    '#ffc107',
                    '#dc3545'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const chart = Chart.getChart(ctx);
    if (chart) {
        chart.destroy();
    }
    
    const categories = Object.keys(data.wrongQuestionsByCategory);
    const wrongCounts = Object.values(data.wrongQuestionsByCategory);
    const avgTimes = categories.map(cat => data.timeByCategory[cat] || 0);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Wrong Questions',
                data: wrongCounts,
                backgroundColor: '#dc3545',
                yAxisID: 'y'
            }, {
                label: 'Average Time (s)',
                data: avgTimes,
                backgroundColor: '#007bff',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Wrong Questions'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Average Time (s)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function renderRecentTests(tests) {
    const container = document.getElementById('recentTests');
    if (!container) return;
    
    container.innerHTML = tests.map(test => `
        <div class="recent-test">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${test.date}</strong>
                    <br>
                    ${test.completed}/${test.total} completed
                </div>
                <div class="text-end">
                    <span class="text-danger">${test.wrong} wrong</span>
                    <br>
                    ${Math.round(test.total_time)}s total
                </div>
            </div>
        </div>
    `).join('');
}

function renderCategoryBreakdown(breakdown) {
    const container = document.getElementById('categoryBreakdown');
    if (!container) return;
    
    container.innerHTML = Object.entries(breakdown).map(([category, data]) => `
        <div class="mb-3">
            <h4>${category} (${data.total} questions)</h4>
            <div class="ms-3">
                ${Object.entries(data.subcategories).map(([sub, count]) => `
                    <div class="d-flex justify-content-between">
                        <span>${sub}</span>
                        <span>${count} questions</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}
