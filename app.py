from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import time
from datetime import datetime, timedelta
import os
import json
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24))

# Database configuration
if os.environ.get('DATABASE_URL'):
    # Use PostgreSQL in production (Koyeb)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL').replace('postgres://', 'postgresql://')
else:
    # Use SQLite in development
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///math_trainer.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    tests = db.relationship('TestHistory', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class TestHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    test_type = db.Column(db.String(20), nullable=False)
    total_questions = db.Column(db.Integer, nullable=False)
    completed_questions = db.Column(db.Integer, nullable=False)
    total_time = db.Column(db.Integer, nullable=False)  # in seconds
    question_times = db.Column(db.Text, nullable=False)  # JSON string of times
    wrong_questions = db.Column(db.Text, nullable=True)  # JSON string of wrong question data
    date_taken = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class ProblemCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('problem_category.id'), nullable=True)
    subcategories = db.relationship('ProblemCategory', backref=db.backref('parent', remote_side=[id]))

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

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    if not current_user.is_authenticated:
        return render_template('dashboard.html')

    # Get the last 7 days of practice data
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=6)
    
    # Get practice sessions in date range
    practice_sessions = TestHistory.query.filter(
        TestHistory.user_id == current_user.id,
        TestHistory.date_taken >= start_date,
        TestHistory.date_taken <= end_date
    ).all()

    # Prepare daily practice data
    dates = []
    practice_minutes = []
    current_date = start_date
    
    while current_date <= end_date:
        dates.append(current_date.strftime('%Y-%m-%d'))
        day_sessions = [s for s in practice_sessions if s.date_taken.date() == current_date.date()]
        total_minutes = sum(s.total_time / 60 for s in day_sessions)
        practice_minutes.append(round(total_minutes))
        current_date += timedelta(days=1)

    # Calculate current streak
    current_streak = 0
    check_date = end_date.date()
    while True:
        day_sessions = [s for s in practice_sessions if s.date_taken.date() == check_date]
        if not day_sessions:
            break
        current_streak += 1
        check_date -= timedelta(days=1)

    # Get today's stats
    today_sessions = [s for s in practice_sessions if s.date_taken.date() == end_date.date()]
    today_minutes = sum(s.total_time / 60 for s in today_sessions)
    problems_today = sum(s.total_questions for s in today_sessions)

    # Calculate average accuracy
    if today_sessions:
        correct_problems = sum(s.total_questions - len(json.loads(s.wrong_questions or '[]')) for s in today_sessions)
        total_problems = sum(s.total_questions for s in today_sessions)
        avg_accuracy = (correct_problems / total_problems * 100) if total_problems > 0 else 0
    else:
        avg_accuracy = 0

    # Get category performance
    category_stats = {}
    for session in practice_sessions:
        wrong_questions = json.loads(session.wrong_questions or '[]')
        for question in wrong_questions:
            category = question.get('category', 'Uncategorized')
            if category not in category_stats:
                category_stats[category] = {'correct': 0, 'total': 0}
            category_stats[category]['total'] += 1
        total_questions = session.total_questions
        for category in category_stats:
            category_stats[category]['total'] += total_questions / len(category_stats)

    category_names = list(category_stats.keys())
    category_accuracy = [
        round((1 - stats['correct'] / stats['total']) * 100 if stats['total'] > 0 else 0, 1)
        for stats in category_stats.values()
    ]

    # Get recent activities
    recent_activities = TestHistory.query.filter_by(user_id=current_user.id)\
        .order_by(TestHistory.date_taken.desc())\
        .limit(5)\
        .all()

    return render_template('dashboard.html',
        dates=dates,
        practice_minutes=practice_minutes,
        current_streak=current_streak,
        today_minutes=round(today_minutes),
        problems_today=problems_today,
        avg_accuracy=avg_accuracy,
        category_names=category_names,
        category_accuracy=category_accuracy,
        recent_activities=recent_activities
    )

@app.route('/train')
@login_required
def train():
    return render_template('train.html', user=current_user, categories=PROBLEM_CATEGORIES)

@app.route('/start_test', methods=['POST'])
@login_required
def start_test():
    try:
        test_type = request.form.get('test_type')
        
        if test_type in TEST_CONFIGS:
            config = TEST_CONFIGS[test_type]
            num_questions = config['questions']
            time_limit = config['time']
        else:  # custom test
            num_questions = int(request.form.get('num_questions', 30))
            time_limit = int(request.form.get('time_limit', 40))

        test_id = str(int(time.time()))
        test_data = {
            'test_id': test_id,
            'user_id': current_user.id,
            'test_type': test_type,
            'total_questions': num_questions,
            'time_limit': time_limit * 60,  # Convert to seconds
            'start_time': int(time.time()),
            'question_times': [],
            'wrong_questions': [],
            'current_question': 0,
            'completed': False
        }
        active_tests[test_id] = test_data
        
        return redirect(url_for('test_interface', test_id=test_id))
    except Exception as e:
        app.logger.error(f"Error starting test: {str(e)}")
        flash(f'Failed to start test: {str(e)}', 'error')
        return redirect(url_for('train'))

@app.route('/test/<test_id>')
@login_required
def test_interface(test_id):
    test = active_tests.get(test_id)
    if not test:
        flash('Test not found or has expired', 'error')
        return redirect(url_for('train'))
        
    if test['user_id'] != current_user.id:
        flash('Unauthorized access to test', 'error')
        return redirect(url_for('train'))
    
    return render_template('test.html', 
                         user=current_user, 
                         test=test,
                         categories=PROBLEM_CATEGORIES)

@app.route('/api/record-question', methods=['POST'])
@login_required
def record_question():
    try:
        data = request.json
        test_id = data['test_id']
        test = active_tests.get(test_id)
        
        if not test:
            return jsonify({'error': 'Test not found'}), 404
            
        if test['user_id'] != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        question_time = data['time']
        test['question_times'].append(question_time)
        test['current_question'] = data['question_number']
        
        if data.get('wrong_data'):
            test['wrong_questions'].append({
                'question_number': data['question_number'],
                'category': data['wrong_data']['category']
            })
        
        if test['current_question'] >= test['total_questions']:
            test['completed'] = True
            save_test_history(test)
            active_tests.pop(test_id, None)
        
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error recording question: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/results/<test_id>')
@login_required
def results(test_id):
    # Mock data for results - replace with real data from database
    test_data = {
        'test': {
            'current_question': 30,
            'total_questions': 30,
            'question_times': [15, 32, 45, 60, 75, 89, 102, 118, 130, 145,
                             160, 178, 190, 205, 220, 238, 255, 270, 285, 300,
                             315, 330, 348, 360, 375, 390, 405, 420, 435, 450],
        },
        'categories': {
            'Geometry': ['Triangles', 'Circles', 'Polygons', 'Coordinate Geometry', 'Transformations'],
            'Algebra': ['Equations', 'Inequalities', 'Functions', 'Polynomials', 'Complex Numbers'],
            'Number Theory': ['Divisibility', 'Prime Numbers', 'Modular Arithmetic', 'Number Sequences', 'Diophantine Equations'],
            'Word Problems': ['Rate Problems', 'Work Problems', 'Mixture Problems', 'Age Problems', 'Distance Problems'],
            'Combinatorics': ['Permutations', 'Combinations', 'Probability', 'Expected Value', 'Graph Theory']
        }
    }
    return render_template('results.html', **test_data)

@app.route('/analytics')
@login_required
def analytics():
    # Mock data for analytics - replace with real data from database
    analytics_data = {
        'accuracy_trend': [85.5, 87.2, 88.1, 86.9, 89.0],  # Last 5 periods
        'average_time': 45.3,  # seconds
        'problems_per_day': 25,
        'best_streak': 15,
        'categories': [
            {'name': 'Geometry', 'accuracy': 88.5},
            {'name': 'Algebra', 'accuracy': 92.1},
            {'name': 'Number Theory', 'accuracy': 85.7},
            {'name': 'Word Problems', 'accuracy': 79.3},
            {'name': 'Combinatorics', 'accuracy': 83.2}
        ]
    }
    return render_template('analytics.html', **analytics_data)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = request.form.get('remember', False) == 'on'
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user, remember=remember)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        
        flash('Invalid username or password.', 'error')
    
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return redirect(url_for('index'))

        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return redirect(url_for('index'))

        if len(password) < 6:
            flash('Password must be at least 6 characters long', 'error')
            return redirect(url_for('index'))

        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        flash('Account created successfully!', 'success')
        return redirect(url_for('index'))

    return redirect(url_for('index'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/history')
@login_required
def get_history():
    tests = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).all()
    return jsonify([{
        'id': test.id,
        'test_type': test.test_type,
        'total_questions': test.total_questions,
        'completed_questions': test.completed_questions,
        'total_time': test.total_time,
        'date_taken': test.date_taken.strftime('%Y-%m-%d %H:%M:%S')
    } for test in tests])

@app.route('/api/stats')
@login_required
def get_stats():
    tests = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).all()
    stats = {
        'total_tests': len(tests),
        'total_questions': sum(test.total_questions for test in tests),
        'average_time': sum(test.total_time for test in tests) / len(tests) if tests else 0,
        'category_stats': {},
        'recent_tests': [{
            'id': test.id,
            'test_type': test.test_type,
            'total_questions': test.total_questions,
            'completed_questions': test.completed_questions,
            'total_time': test.total_time,
            'date_taken': test.date_taken.strftime('%Y-%m-%d %H:%M:%S'),
            'wrong_questions': json.loads(test.wrong_questions) if test.wrong_questions else []
        } for test in tests[:10]]
    }
    
    # Calculate category statistics
    for test in tests:
        if test.wrong_questions:
            wrong_qs = json.loads(test.wrong_questions)
            for q in wrong_qs:
                cat = q.get('category')
                if cat:
                    if cat not in stats['category_stats']:
                        stats['category_stats'][cat] = {'total': 0, 'subcategories': {}}
                    stats['category_stats'][cat]['total'] += 1
                    
                    subcat = q.get('subcategory')
                    if subcat:
                        if subcat not in stats['category_stats'][cat]['subcategories']:
                            stats['category_stats'][cat]['subcategories'][subcat] = 0
                        stats['category_stats'][cat]['subcategories'][subcat] += 1
    
    return jsonify(stats)

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}), 200

def save_test_history(test):
    history = TestHistory(
        user_id=test['user_id'],
        test_type=test['test_type'],
        total_questions=test['total_questions'],
        completed_questions=test['current_question'],
        total_time=test['question_times'][-1] if test['question_times'] else 0,
        question_times=json.dumps(test['question_times']),
        wrong_questions=json.dumps(test['wrong_questions'])
    )
    db.session.add(history)
    db.session.commit()

with app.app_context():
    db.create_all()
    
    # Initialize problem categories if empty
    if not ProblemCategory.query.first():
        for main_category, subcategories in PROBLEM_CATEGORIES.items():
            parent = ProblemCategory(name=main_category)
            db.session.add(parent)
            db.session.flush()  # Get the ID
            
            for subcategory in subcategories:
                child = ProblemCategory(name=subcategory, parent_id=parent.id)
                db.session.add(child)
        
        db.session.commit()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
