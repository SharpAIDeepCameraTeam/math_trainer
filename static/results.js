const PROBLEM_CATEGORIES = {
    'Geometry': [
        'Angle Chasing',
        'Congruence and Similarity',
        'Circle Problems',
        'Polygon Properties',
        'Triangles',
        'Coordinate Geometry',
        '3D Geometry',
        'Special Triangles'
    ],
    'Algebra': [
        'Linear Equations',
        'Quadratics',
        'Polynomials',
        'Exponential and Logarithmic Problems',
        'Functional Equations',
        'Sequences and Series'
    ],
    'Arithmetic and Number Theory': [
        'Prime Factorization',
        'Divisibility',
        'Modular Arithmetic',
        'Number Bases',
        'Clock Problems',
        'Digit Problems',
        'Consecutive Numbers'
    ],
    'Word Problems': [
        'Speed, Distance, and Rate',
        'Work Problems',
        'Mixture Problems',
        'Age Problems',
        'Percentage Problems',
        'Proportion and Ratio Problems'
    ],
    'Counting and Probability': [
        'Permutations',
        'Combinations',
        'Probability',
        'Expected Value',
        'Set Problems'
    ],
    'Miscellaneous Problems': [
        'Clock Problems',
        'Calendar Problems',
        'Pattern Problems',
        'Optimization Problems',
        'Logic Problems',
        'Estimation Problems'
    ]
};

let currentProblemNum = null;

function initializeResultsPage() {
    const mainCategorySelect = document.getElementById('mainCategory');
    if (!mainCategorySelect) return;
    
    // Clear any existing options
    mainCategorySelect.innerHTML = '<option value="">Select category...</option>';
    
    // Add main categories
    Object.keys(PROBLEM_CATEGORIES).forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        mainCategorySelect.appendChild(option);
    });
    
    // Add event listener for main category changes
    mainCategorySelect.addEventListener('change', updateSubcategories);
}

function updateSubcategories() {
    const mainCategory = document.getElementById('mainCategory').value;
    const subSelect = document.getElementById('subCategory');
    
    // Clear existing options
    subSelect.innerHTML = '<option value="">Select subcategory...</option>';
    
    // Add subcategories if a main category is selected
    if (mainCategory && PROBLEM_CATEGORIES[mainCategory]) {
        PROBLEM_CATEGORIES[mainCategory].forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            subSelect.appendChild(option);
        });
    }
}

function showCategoryModal(questionNum) {
    currentProblemNum = questionNum;
    
    // Reset selections
    document.getElementById('mainCategory').value = '';
    document.getElementById('subCategory').innerHTML = '<option value="">Select subcategory...</option>';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
    modal.show();
}

function saveCategory() {
    const mainCategory = document.getElementById('mainCategory').value;
    const subCategory = document.getElementById('subCategory').value;
    
    if (!mainCategory || !subCategory) {
        alert('Please select both a category and subcategory');
        return;
    }
    
    const testId = document.querySelector('.container').dataset.testId;
    if (!testId) {
        console.error('Test ID not found');
        return;
    }
    
    // Get CSRF token
    const token = document.querySelector('meta[name="csrf-token"]').content;
    
    // Save category
    fetch('/api/save-category', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': token
        },
        body: JSON.stringify({
            testId: testId,
            questionNumber: currentProblemNum,
            mainCategory: mainCategory,
            subCategory: subCategory
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to save category');
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Update UI
            const questionElement = document.querySelector(`[data-question="${currentProblemNum}"]`);
            if (questionElement) {
                questionElement.querySelector('.selected-category').textContent = 
                    `Category: ${mainCategory} - ${subCategory}`;
                questionElement.classList.add('categorized');
            }
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        } else {
            throw new Error('Failed to save category');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error saving category. Please try again.');
    });
}

function exportTestData(testId) {
    fetch(`/api/export-test/${testId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Create CSV content
            let csvContent = 'Question Number,Time Taken,Wrong Answer,Category,Subcategory\n';
            data.questions.forEach(q => {
                csvContent += `${q.number},${q.time},${q.wrong},${q.category || ''},${q.subcategory || ''}\n`;
            });
            
            // Add summary data
            csvContent += '\nTest Summary\n';
            csvContent += `Total Time,${data.total_time}\n`;
            csvContent += `Completed Questions,${data.completed_questions}\n`;
            
            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `test_${testId}_results.csv`;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error('Error exporting test data:', error);
            alert('Error exporting test data. Please try again.');
        });
}
