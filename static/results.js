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
    if (!mainCategorySelect) return; // Exit if not on results page
    
    mainCategorySelect.addEventListener('change', function() {
        const mainCategory = this.value;
        const subSelect = document.getElementById('subCategory');
        subSelect.innerHTML = '<option value="">Select subcategory...</option>';
        
        if (mainCategory && PROBLEM_CATEGORIES[mainCategory]) {
            PROBLEM_CATEGORIES[mainCategory].forEach(sub => {
                const option = document.createElement('option');
                option.value = sub;
                option.textContent = sub;
                subSelect.appendChild(option);
            });
        }
    });
}

function showCategoryModal(questionNum) {
    currentProblemNum = questionNum;
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
    
    const container = document.querySelector('.container');
    const testId = container.dataset.testId;
    
    if (!testId) {
        console.error('Test ID not found');
        return;
    }
    
    const questionElement = document.querySelector(`[data-question="${currentProblemNum}"]`);
    if (questionElement) {
        questionElement.querySelector('.selected-category').textContent = 
            `Category: ${mainCategory} - ${subCategory}`;
            
        // Save to database
        fetch('/api/save-category', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                testId: testId,
                questionNumber: currentProblemNum,
                mainCategory: mainCategory,
                subCategory: subCategory
            })
        });
    }
    
    bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
}
