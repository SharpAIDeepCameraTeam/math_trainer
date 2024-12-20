from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_wtf.csrf import CSRFProtect
from models import db, User, TestHistory
import os
import json
from datetime import datetime

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_123')
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

@app.route('/')
def dashboard():
    if not current_user.is_authenticated:
        return render_template('dashboard.html', guest=True)
    return render_template('dashboard.html')

@app.route('/test')
def test():
    if not current_user.is_authenticated:
        return render_template('test.html', guest=True)
    return render_template('test.html')

@app.route('/analytics')
@login_required
def analytics():
    tests = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).all()
    
    total_tests = len(tests)
    if total_tests == 0:
        return jsonify({
            'totalTests': 0,
            'averageTime': 0,
            'totalQuestions': 0,
            'completedQuestions': 0,
            'wrongQuestionsByCategory': {},
            'timeByCategory': {},
            'testDates': [],
            'improvementTrend': [],
            'timeDistribution': {
                'under30s': 0,
                '30to60s': 0,
                '60to90s': 0,
                'over90s': 0
            },
            'recentTests': []
        })

    total_questions = sum(test.total_questions for test in tests)
    completed_questions = sum(test.completed_questions for test in tests)
    average_time = sum(test.total_time for test in tests) / total_tests

    # Calculate wrong questions by category
    wrong_by_category = {}
    time_by_category = {}
    
    for test in tests:
        if test.categories:
            categories = json.loads(test.categories)
            for _, cat_data in categories.items():
                category = cat_data.get('main')
                if category:
                    wrong_by_category[category] = wrong_by_category.get(category, 0) + 1
                    time_by_category[category] = time_by_category.get(category, 0) + test.total_time

    # Calculate time distribution
    time_distribution = {'under30s': 0, '30to60s': 0, '60to90s': 0, 'over90s': 0}
    for test in tests:
        times = json.loads(test.question_times)
        for time in times:
            if time < 30:
                time_distribution['under30s'] += 1
            elif time < 60:
                time_distribution['30to60s'] += 1
            elif time < 90:
                time_distribution['60to90s'] += 1
            else:
                time_distribution['over90s'] += 1

    # Calculate improvement trend
    improvement_trend = []
    for test in tests[:10]:  # Last 10 tests
        improvement_trend.append({
            'date': test.date_taken.strftime('%Y-%m-%d'),
            'avgTime': test.total_time / test.total_questions
        })

    # Recent tests
    recent_tests = []
    for test in tests[:5]:  # Last 5 tests
        wrong_count = len(json.loads(test.wrong_questions)) if test.wrong_questions else 0
        recent_tests.append({
            'date': test.date_taken.strftime('%Y-%m-%d %H:%M'),
            'total': test.total_questions,
            'completed': test.completed_questions,
            'wrong': wrong_count,
            'total_time': test.total_time
        })

    return render_template('analytics.html', 
                         total_tests=total_tests,
                         average_time=average_time,
                         total_questions=total_questions,
                         completed_questions=completed_questions,
                         wrong_questions_by_category=wrong_by_category,
                         time_by_category=time_by_category,
                         test_dates=[test.date_taken.strftime('%Y-%m-%d') for test in tests[:10]],
                         improvement_trend=improvement_trend,
                         time_distribution=time_distribution,
                         recent_tests=recent_tests)

@app.route('/api/analytics/data')
@login_required
def analytics_data():
    tests = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).all()
    
    total_tests = len(tests)
    if total_tests == 0:
        return jsonify({
            'totalTests': 0,
            'averageTime': 0,
            'totalQuestions': 0,
            'completedQuestions': 0,
            'wrongQuestionsByCategory': {},
            'timeByCategory': {},
            'testDates': [],
            'improvementTrend': [],
            'timeDistribution': {
                'under30s': 0,
                '30to60s': 0,
                '60to90s': 0,
                'over90s': 0
            },
            'recentTests': []
        })

    total_questions = sum(test.total_questions for test in tests)
    completed_questions = sum(test.completed_questions for test in tests)
    average_time = sum(test.total_time for test in tests) / total_tests

    # Calculate wrong questions by category
    wrong_by_category = {}
    time_by_category = {}
    
    for test in tests:
        if test.categories:
            categories = json.loads(test.categories)
            for _, cat_data in categories.items():
                category = cat_data.get('main')
                if category:
                    wrong_by_category[category] = wrong_by_category.get(category, 0) + 1
                    time_by_category[category] = time_by_category.get(category, 0) + test.total_time

    # Calculate time distribution
    time_distribution = {'under30s': 0, '30to60s': 0, '60to90s': 0, 'over90s': 0}
    for test in tests:
        times = json.loads(test.question_times)
        for time in times:
            if time < 30:
                time_distribution['under30s'] += 1
            elif time < 60:
                time_distribution['30to60s'] += 1
            elif time < 90:
                time_distribution['60to90s'] += 1
            else:
                time_distribution['over90s'] += 1

    # Calculate improvement trend
    improvement_trend = []
    for test in tests[:10]:  # Last 10 tests
        improvement_trend.append({
            'date': test.date_taken.strftime('%Y-%m-%d'),
            'avgTime': test.total_time / test.total_questions
        })

    # Recent tests
    recent_tests = []
    for test in tests[:5]:  # Last 5 tests
        wrong_count = len(json.loads(test.wrong_questions)) if test.wrong_questions else 0
        recent_tests.append({
            'date': test.date_taken.strftime('%Y-%m-%d %H:%M'),
            'total': test.total_questions,
            'completed': test.completed_questions,
            'wrong': wrong_count,
            'total_time': test.total_time
        })

    return jsonify({
        'totalTests': total_tests,
        'averageTime': average_time,
        'totalQuestions': total_questions,
        'completedQuestions': completed_questions,
        'wrongQuestionsByCategory': wrong_by_category,
        'timeByCategory': time_by_category,
        'testDates': [test.date_taken.strftime('%Y-%m-%d') for test in tests[:10]],
        'improvementTrend': improvement_trend,
        'timeDistribution': time_distribution,
        'recentTests': recent_tests
    })

@app.route('/api/start-test', methods=['POST'])
@login_required
def start_test():
    test = TestHistory(
        user_id=current_user.id,
        total_questions=25,
        completed_questions=0,
        total_time=0,
        question_times='[]',
        wrong_questions='[]'
    )
    db.session.add(test)
    db.session.commit()
    return jsonify({'test_id': test.id})

@app.route('/api/record-test', methods=['POST'])
@login_required
def record_test():
    data = request.json
    test = TestHistory.query.get_or_404(data['testId'])
    
    if test.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    test.completed_questions = data['completedQuestions']
    test.total_time = data['totalTime']
    test.question_times = json.dumps(data['times'])
    test.wrong_questions = json.dumps(data['wrongQuestions'])
    
    db.session.commit()
    return jsonify({'test_id': test.id})

@app.route('/results/<int:test_id>')
@login_required
def results(test_id):
    test = TestHistory.query.get_or_404(test_id)
    if test.user_id != current_user.id:
        return redirect(url_for('dashboard'))
    
    times = json.loads(test.question_times)
    wrong_questions = json.loads(test.wrong_questions) if test.wrong_questions else []
    
    # Calculate averages
    averages = {
        'first_10': sum(times[:10]) / min(10, len(times)),
        'second_10': sum(times[10:20]) / min(10, len(times[10:])),
        'final_5': sum(times[20:]) / min(5, len(times[20:])),
        'overall': sum(times) / len(times)
    }
    
    return render_template('results.html', 
                         test=test,
                         averages=averages,
                         wrong_questions=wrong_questions)

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
        categories = json.loads(test.categories) if test.categories else {}
        categories[str(question_number)] = {
            'main': main_category,
            'sub': sub_category
        }
        test.categories = json.dumps(categories)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to save category'}), 500

@app.route('/api/get-categories/<int:test_id>')
@login_required
def get_categories(test_id):
    test = TestHistory.query.get_or_404(test_id)
    if test.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    categories = json.loads(test.categories) if test.categories else {}
    return jsonify({'categories': categories})

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('dashboard'))
            
        flash('Invalid username or password', 'danger')
    
    return render_template('login.html')

@app.route('/login_modal', methods=['POST'])
def login_modal():
    username = request.form.get('username')
    password = request.form.get('password')
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        login_user(user)
        return redirect(url_for('dashboard'))
        
    flash('Invalid username or password', 'danger')
    return redirect(url_for('login'))

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        email = request.form.get('email')
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'danger')
            return redirect(url_for('signup'))
            
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'danger')
            return redirect(url_for('signup'))
        
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))
        
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)
