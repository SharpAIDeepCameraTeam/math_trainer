// Categories data
const categories = {
    'Arithmetic': ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Fractions', 'Decimals'],
    'Algebra': ['Linear Equations', 'Quadratic Equations', 'Systems of Equations', 'Inequalities', 'Functions'],
    'Geometry': ['Angles', 'Triangles', 'Circles', 'Area', 'Volume', 'Coordinate Geometry'],
    'Statistics': ['Mean/Median/Mode', 'Probability', 'Data Analysis', 'Standard Deviation'],
    'Number Theory': ['Prime Numbers', 'Factors', 'Multiples', 'GCD/LCM', 'Modular Arithmetic'],
    'Calculus': ['Limits', 'Derivatives', 'Integrals', 'Differential Equations'],
    'Logic': ['Word Problems', 'Pattern Recognition', 'Logical Reasoning', 'Proof Techniques']
};

let currentQuestionNumber = null;
let modal = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the modal
    modal = new bootstrap.Modal(document.getElementById('categoryModal'));
    
    // Initialize any existing categories
    initializeExistingCategories();
});

function initializeExistingCategories() {
    // Get the test ID from the container
    const testId = document.querySelector('.container').dataset.testId;
    
    if (!testId) return;
    
    // Fetch existing categories
    fetch(`/api/get-categories/${testId}`)
        .then(response => response.json())
        .then(data => {
            if (data.categories) {
                Object.entries(data.categories).forEach(([questionNum, catData]) => {
                    const questionDiv = document.querySelector(`.wrong-question[data-question="${questionNum}"]`);
                    if (questionDiv) {
                        questionDiv.classList.add('categorized');
                        questionDiv.querySelector('.selected-category').textContent = 
                            `Category: ${catData.main}${catData.sub ? ` - ${catData.sub}` : ''}`;
                    }
                });
            }
        })
        .catch(error => console.error('Error loading categories:', error));
}

function showCategoryModal(questionNumber) {
    currentQuestionNumber = questionNumber;
    
    // Reset and populate main category dropdown
    const mainSelect = document.getElementById('mainCategory');
    mainSelect.innerHTML = '<option value="">Select category...</option>';
    Object.keys(categories).forEach(category => {
        mainSelect.innerHTML += `<option value="${category}">${category}</option>`;
    });
    
    // Reset subcategory dropdown
    document.getElementById('subCategory').innerHTML = '<option value="">Select subcategory...</option>';
    
    modal.show();
}

// Event listener for main category changes
document.getElementById('mainCategory').addEventListener('change', function() {
    const mainCategory = this.value;
    const subSelect = document.getElementById('subCategory');
    
    // Reset subcategory dropdown
    subSelect.innerHTML = '<option value="">Select subcategory...</option>';
    
    if (mainCategory && categories[mainCategory]) {
        // Populate subcategories
        categories[mainCategory].forEach(sub => {
            subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    }
});

function saveCategory() {
    const mainCategory = document.getElementById('mainCategory').value;
    const subCategory = document.getElementById('subCategory').value;
    
    if (!mainCategory) {
        alert('Please select a main category');
        return;
    }
    
    const testId = document.querySelector('.container').dataset.testId;
    
    fetch('/api/save-category', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            test_id: testId,
            question_number: currentQuestionNumber,
            main_category: mainCategory,
            sub_category: subCategory
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update UI to show categorized state
            const questionDiv = document.querySelector(`.wrong-question[data-question="${currentQuestionNumber}"]`);
            questionDiv.classList.add('categorized');
            questionDiv.querySelector('.selected-category').textContent = 
                `Category: ${mainCategory}${subCategory ? ` - ${subCategory}` : ''}`;
            
            // Close modal
            modal.hide();
            
            // Show success message
            const toast = new bootstrap.Toast(document.getElementById('successToast'));
            toast.show();
        } else {
            alert('Failed to save category. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error saving category:', error);
        alert('Failed to save category. Please try again.');
    });
}
