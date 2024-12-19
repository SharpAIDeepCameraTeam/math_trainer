let performanceChart = null;
let categoryChart = null;

// Initialize dashboard
async function initDashboard() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
            if (response.status === 401) {
                // Not logged in, show guest view
                showGuestView();
                return;
            }
            throw new Error('Failed to fetch stats');
        }
        
        const stats = await response.json();
        updateStats(stats);
        updateCharts(stats);
        updateRecentTests(stats.recent_tests);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

function showGuestView() {
    document.getElementById('total-tests').textContent = '-';
    document.getElementById('total-questions').textContent = '-';
    document.getElementById('average-time').textContent = '-';
}

function updateStats(stats) {
    document.getElementById('total-tests').textContent = stats.total_tests;
    document.getElementById('total-questions').textContent = stats.total_questions;
    
    const avgMinutes = Math.floor(stats.average_time / 60);
    const avgSeconds = Math.floor(stats.average_time % 60);
    document.getElementById('average-time').textContent = 
        `${avgMinutes}:${avgSeconds.toString().padStart(2, '0')}`;
}

function updateCharts(stats) {
    // Performance over time chart
    const recentTests = stats.recent_tests.slice().reverse();
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    const ctx = document.getElementById('performanceChart').getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: recentTests.map(test => new Date(test.date_taken).toLocaleDateString()),
            datasets: [{
                label: 'Questions Completed',
                data: recentTests.map(test => test.completed_questions),
                borderColor: '#0d6efd',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance Trend'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Questions Completed'
                    }
                }
            }
        }
    });
    
    // Category distribution chart
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const categories = Object.entries(stats.category_stats);
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: categories.map(([cat]) => cat),
            datasets: [{
                data: categories.map(([_, data]) => data.total),
                backgroundColor: [
                    '#0d6efd', '#6610f2', '#6f42c1', '#d63384',
                    '#dc3545', '#fd7e14', '#ffc107', '#198754'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                },
                title: {
                    display: true,
                    text: 'Problems by Category'
                }
            }
        }
    });
}

function updateRecentTests(tests) {
    const tbody = document.querySelector('#recent-tests tbody');
    tbody.innerHTML = '';
    
    tests.forEach(test => {
        const row = document.createElement('tr');
        const score = Math.round((test.completed_questions / test.total_questions) * 100);
        const minutes = Math.floor(test.total_time / 60);
        const seconds = test.total_time % 60;
        
        row.innerHTML = `
            <td>${new Date(test.date_taken).toLocaleDateString()}</td>
            <td>${test.test_type}</td>
            <td>
                <div class="d-flex align-items-center">
                    ${score}%
                    <div class="progress ms-2" style="width: 60px; height: 6px;">
                        <div class="progress-bar ${score === 100 ? 'bg-success' : ''}" 
                             style="width: ${score}%"></div>
                    </div>
                </div>
            </td>
            <td>${minutes}:${seconds.toString().padStart(2, '0')}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Settings management
document.getElementById('save-settings').addEventListener('click', function() {
    const theme = document.getElementById('theme-select').value;
    const soundEnabled = document.getElementById('sound-effects').checked;
    
    // Save to localStorage
    localStorage.setItem('settings', JSON.stringify({
        theme,
        soundEnabled
    }));
    
    // Apply settings
    applySettings();
    
    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
});

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('settings')) || {
        theme: 'light',
        soundEnabled: true
    };
    
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('sound-effects').checked = settings.soundEnabled;
    
    applySettings();
}

function applySettings() {
    const settings = JSON.parse(localStorage.getItem('settings')) || {
        theme: 'light',
        soundEnabled: true
    };
    
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    loadSettings();
});
