document.addEventListener('DOMContentLoaded', function() {
    // Practice Time Chart
    const practiceCtx = document.getElementById('practiceTimeChart').getContext('2d');
    new Chart(practiceCtx, {
        type: 'bar',
        data: {
            labels: practiceData.dates,
            datasets: [{
                label: 'Minutes Practiced',
                data: practiceData.minutes,
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

    // Category Performance Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    new Chart(categoryCtx, {
        type: 'radar',
        data: {
            labels: categoryData.names,
            datasets: [{
                label: 'Accuracy',
                data: categoryData.accuracy,
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

    // Past Tests Charts
    pastTests.forEach((test, index) => {
        const testCtx = document.getElementById(`testChart${index + 1}`).getContext('2d');
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
    });

    // Time filter handling
    document.querySelectorAll('.time-filter button').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelector('.time-filter button.active').classList.remove('active');
            this.classList.add('active');
            // Here you would typically fetch new data based on the selected period
            // and update the charts
        });
    });
});
