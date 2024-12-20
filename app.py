from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_wtf.csrf import CSRFProtect
from models import db, User, TestHistory
import os
import json
from datetime import datetime

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_123')  # Change in production
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///math_trainer.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
csrf = CSRFProtect(app)
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Problem categories
PROBLEM_CATEGORIES = {
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
}

# Test configurations
TEST_CONFIGS = {
    'mathcounts': {'questions': 30, 'time': 40},
    'amc8': {'questions': 25, 'time': 40},
    'amc10': {'questions': 25, 'time': 75},
    'amc12': {'questions': 25, 'time': 75},
    'aime': {'questions': 15, 'time': 180},  # 3 hours
    'mandelbrot': {'questions': 7, 'time': 50},
}

# Active tests in memory
active_tests = {}

def calculate_averages(times):
    """Calculate different averages from question times"""
    times = [float(t) for t in times]
    averages = {
        'first_10': round(sum(times[:10]) / min(10, len(times)), 2) if times else 0,
        'second_10': round(sum(times[10:20]) / min(10, max(0, len(times)-10)), 2) if len(times) > 10 else 0,
        'final_5': round(sum(times[-5:]) / min(5, len(times)), 2) if times else 0,
        'overall': round(sum(times) / len(times), 2) if times else 0
    }
    return averages

@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/dashboard')
def dashboard():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
        
    # Get recent tests
    recent_tests = TestHistory.query.filter_by(user_id=current_user.id)\
        .order_by(TestHistory.date_taken.desc())\
        .limit(10)\
        .all()
        
    return render_template('dashboard.html', recent_tests=recent_tests)

@app.route('/train')
def train():
    return render_template('train.html')

@app.route('/test')
def test_interface():
    return render_template('test.html')

@app.route('/results/<int:test_id>')
def results(test_id):
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
        
    test = TestHistory.query.get(test_id)
    if not test or test.user_id != current_user.id:
        abort(404)
        
    # Calculate averages
    times = json.loads(test.question_times)
    averages = calculate_averages(times)
        
    # Get wrong questions
    wrong_questions = []
    if test.wrong_questions:
        wrong_data = json.loads(test.wrong_questions)
        for num in wrong_data:
            wrong_questions.append({
                'number': num,
                'time': times[int(num)-1]
            })
    
    return render_template('results.html', test=test, wrong_questions=wrong_questions, averages=averages)

@app.route('/api/record-question', methods=['POST'])
def record_question():
    data = request.get_json()
    
    if current_user.is_authenticated:
        # Save to database if user is logged in
        test = TestHistory(
            user_id=current_user.id,
            test_type=data['test_type'],
            total_questions=data['total_questions'],
            completed_questions=data['current_question'],
            total_time=data['total_time'],
            question_times=json.dumps(data['question_times']),
            wrong_questions=json.dumps(data.get('wrong_questions', [])),
            date_taken=datetime.utcnow()
        )
        db.session.add(test)
        db.session.commit()
        return jsonify({'test_id': test.id})
    else:
        # Store in session if user is not logged in
        if 'test_history' not in session:
            session['test_history'] = []
        
        test_data = {
            'id': len(session['test_history']) + 1,
            'test_type': data['test_type'],
            'total_questions': data['total_questions'],
            'completed_questions': data['current_question'],
            'total_time': data['total_time'],
            'question_times': data['question_times'],
            'wrong_questions': data.get('wrong_questions', []),
            'date_taken': datetime.utcnow().isoformat()
        }
        session['test_history'].append(test_data)
        session.modified = True
        return jsonify({'test_id': test_data['id']})

@app.route('/api/dashboard-data')
def dashboard_data():
    if current_user.is_authenticated:
        # Get data from database for logged in users
        test_history = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).limit(10).all()
        history_data = []
        for test in test_history:
            history_data.append({
                'id': test.id,
                'test_type': test.test_type,
                'total_questions': test.total_questions,
                'completed_questions': test.completed_questions,
                'total_time': test.total_time,
                'date_taken': test.date_taken.isoformat()
            })
    else:
        # Get data from session for anonymous users
        history_data = session.get('test_history', [])
    
    return jsonify({
        'test_history': history_data,
        'is_authenticated': current_user.is_authenticated
    })

@app.route('/api/submit-test', methods=['POST'])
def submit_test():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Not authenticated'}), 401
        
    data = request.get_json()
    
    # Create test record
    test = TestHistory(
        user_id=current_user.id,
        test_type='standard',
        total_questions=len(data['times']),
        completed_questions=len(data['times']),
        total_time=int(sum(data['times'])),
        question_times=json.dumps(data['times']),
        wrong_questions=json.dumps(data['wrongQuestions'])
    )
    
    db.session.add(test)
    db.session.commit()
    
    return jsonify({'test_id': test.id})

@app.route('/api/save-category', methods=['POST'])
@login_required
def save_category():
    data = request.json
    test_id = data.get('test_id')
    question_number = data.get('question_number')
    main_category = data.get('main_category')
    sub_category = data.get('sub_category')
    
    if not all([test_id, question_number, main_category]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    test = TestHistory.query.get_or_404(test_id)
    
    if test.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Load existing categories or create new dict
        categories = json.loads(test.categories) if test.categories else {}
        
        # Update category for this question
        categories[str(question_number)] = {
            'main': main_category,
            'sub': sub_category
        }
        
        # Save back to database
        test.categories = json.dumps(categories)
        db.session.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving category: {str(e)}")
        return jsonify({'error': 'Failed to save category'}), 500

@app.route('/api/export-test/<int:test_id>')
@login_required
def export_test(test_id):
    test = TestHistory.query.get_or_404(test_id)
    
    if test.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    # Get test data
    times = json.loads(test.question_times)
    wrong_questions = json.loads(test.wrong_questions) if test.wrong_questions else []
    categories = json.loads(test.categories) if test.categories else {}
    
    # Prepare questions data
    questions = []
    for i in range(len(times)):
        question_num = i + 1
        question_data = {
            'number': question_num,
            'time': times[i],
            'wrong': question_num in wrong_questions,
            'category': None,
            'subcategory': None
        }
        
        # Add category data if available
        if str(question_num) in categories:
            cat_data = categories[str(question_num)]
            question_data['category'] = cat_data.get('main')
            question_data['subcategory'] = cat_data.get('sub')
            
        questions.append(question_data)
    
    return jsonify({
        'test_id': test_id,
        'total_time': test.total_time,
        'completed_questions': test.completed_questions,
        'questions': questions
    })

@app.route('/api/get-categories/<int:test_id>')
@login_required
def get_categories(test_id):
    test = TestHistory.query.get_or_404(test_id)
    
    if test.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    categories = json.loads(test.categories) if test.categories else {}
    return jsonify({'categories': categories})

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validation
        if not username or not password or not confirm_password:
            flash('All fields are required.', 'error')
            return redirect(url_for('index'))
            
        if len(username) < 3:
            flash('Username must be at least 3 characters long.', 'error')
            return redirect(url_for('index'))
            
        if len(password) < 8:
            flash('Password must be at least 8 characters long.', 'error')
            return redirect(url_for('index'))
            
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('index'))
            
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            return redirect(url_for('index'))
        
        # Create new user
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        flash('Account created successfully!', 'success')
        return redirect(url_for('index'))
        
    return redirect(url_for('index'))

@app.route('/login-modal', methods=['POST'])
def login_modal():
    username = request.form.get('username')
    password = request.form.get('password')
    
    if not username or not password:
        flash('Please enter both username and password.', 'error')
        return redirect(url_for('index'))
        
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        login_user(user)
        flash('Welcome back!', 'success')
        return redirect(url_for('index'))
    else:
        flash('Invalid username or password.', 'error')
        return redirect(url_for('index'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/analytics')
@login_required
def analytics():
    return render_template('analytics.html', user=current_user)

@app.route('/api/analytics/data')
@login_required
def get_analytics_data():
    # Get all tests for the current user
    tests = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).all()
    
    if not tests:
        return jsonify({
            'error': 'No test data available'
        }), 404
    
    # Prepare analytics data
    analytics_data = {
        'totalTests': len(tests),
        'averageTime': sum(test.total_time for test in tests) / len(tests),
        'totalQuestions': sum(test.total_questions for test in tests),
        'completedQuestions': sum(test.completed_questions for test in tests),
        'testDates': [],
        'testTimes': [],
        'wrongQuestionsByCategory': {},
        'timeByCategory': {},
        'recentTests': [],
        'improvementTrend': [],
        'categoryBreakdown': {},
        'timeDistribution': {
            'under30s': 0,
            '30to60s': 0,
            '60to90s': 0,
            'over90s': 0
        }
    }
    
    # Process each test
    for test in tests:
        # Basic test data
        test_date = test.date_taken.strftime('%Y-%m-%d')
        analytics_data['testDates'].append(test_date)
        analytics_data['testTimes'].append(test.total_time)
        
        # Process question times
        times = json.loads(test.question_times)
        for time in times:
            if time < 30:
                analytics_data['timeDistribution']['under30s'] += 1
            elif time < 60:
                analytics_data['timeDistribution']['30to60s'] += 1
            elif time < 90:
                analytics_data['timeDistribution']['60to90s'] += 1
            else:
                analytics_data['timeDistribution']['over90s'] += 1
        
        # Process categories
        if test.categories:
            categories = json.loads(test.categories)
            for q_num, cat_data in categories.items():
                main_cat = cat_data.get('main')
                if main_cat:
                    # Update wrong questions by category
                    if main_cat not in analytics_data['wrongQuestionsByCategory']:
                        analytics_data['wrongQuestionsByCategory'][main_cat] = 0
                    analytics_data['wrongQuestionsByCategory'][main_cat] += 1
                    
                    # Update time by category
                    if main_cat not in analytics_data['timeByCategory']:
                        analytics_data['timeByCategory'][main_cat] = []
                    analytics_data['timeByCategory'][main_cat].append(times[int(q_num) - 1])
                    
                    # Update category breakdown
                    if main_cat not in analytics_data['categoryBreakdown']:
                        analytics_data['categoryBreakdown'][main_cat] = {
                            'total': 0,
                            'subcategories': {}
                        }
                    analytics_data['categoryBreakdown'][main_cat]['total'] += 1
                    
                    sub_cat = cat_data.get('sub')
                    if sub_cat:
                        if sub_cat not in analytics_data['categoryBreakdown'][main_cat]['subcategories']:
                            analytics_data['categoryBreakdown'][main_cat]['subcategories'][sub_cat] = 0
                        analytics_data['categoryBreakdown'][main_cat]['subcategories'][sub_cat] += 1
        
        # Add to recent tests
        if len(analytics_data['recentTests']) < 5:
            analytics_data['recentTests'].append({
                'date': test_date,
                'total_time': test.total_time,
                'completed': test.completed_questions,
                'total': test.total_questions,
                'wrong': len(json.loads(test.wrong_questions)) if test.wrong_questions else 0
            })
    
    # Calculate improvement trend (average time per question for each test)
    for test in tests:
        avg_time = test.total_time / test.completed_questions if test.completed_questions > 0 else 0
        analytics_data['improvementTrend'].append({
            'date': test.date_taken.strftime('%Y-%m-%d'),
            'avgTime': avg_time
        })
    
    # Calculate averages for time by category
    for category, times in analytics_data['timeByCategory'].items():
        analytics_data['timeByCategory'][category] = sum(times) / len(times)
    
    return jsonify(analytics_data)

with app.app_context():
    try:
        # Drop all tables
        db.drop_all()
        # Create all tables
        db.create_all()
        
        # Initialize problem categories if empty
        if not ProblemCategory.query.first():
            for main_category, subcategories in PROBLEM_CATEGORIES.items():
                main_cat = ProblemCategory(name=main_category)
                db.session.add(main_cat)
                db.session.commit()
                
                for sub in subcategories:
                    sub_cat = ProblemCategory(name=sub, parent_id=main_cat.id)
                    db.session.add(sub_cat)
                
            db.session.commit()
            
        print("Database initialized successfully!")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
