from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import time
from datetime import datetime, timedelta
import os
import json
import logging
from collections import defaultdict
import hashlib

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24))

# Add MD5 filter to Jinja2
@app.template_filter('md5')
def md5_filter(s):
    return hashlib.md5(s.encode()).hexdigest()

# Database configuration
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Handle Postgres URL format for SQLAlchemy
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
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
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    tests = db.relationship('TestHistory', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class TestHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    test_type = db.Column(db.String(20), nullable=False)
    total_questions = db.Column(db.Integer, nullable=False)
    completed_questions = db.Column(db.Integer, nullable=False)
    total_time = db.Column(db.Integer, nullable=False)  # in seconds
    question_times = db.Column(db.Text, nullable=False)  # JSON string of times
    wrong_questions = db.Column(db.Text, nullable=True)  # JSON string of wrong question data
    categories = db.Column(db.Text, nullable=True)  # JSON string of categories
    date_taken = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class ProblemCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('problem_category.id'), nullable=True)
    subcategories = db.relationship('ProblemCategory', backref=db.backref('parent', remote_side=[id]))

class WrongQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('test_history.id'), nullable=False)
    question_number = db.Column(db.Integer, nullable=False)
    time_taken = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    subcategory = db.Column(db.String(100), nullable=False)

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
    data = request.json
    
    # Create test history entry
    test = TestHistory(
        user_id=current_user.id if current_user.is_authenticated else None,
        date_taken=datetime.utcnow(),
        total_questions=data['totalQuestions'],
        completed_questions=data['totalQuestions'] - len(data['wrongQuestions']),
        total_time=sum(data['times']),
        average_time=sum(data['times']) / len(data['times']) if data['times'] else 0
    )
    db.session.add(test)
    db.session.commit()
    
    # Save wrong questions and their categories
    for question_num in data['wrongQuestions']:
        category = data['categories'].get(str(question_num), {})
        wrong = WrongQuestion(
            test_id=test.id,
            question_number=question_num,
            time_taken=data['times'][question_num - 1],
            category=category.get('main', ''),
            subcategory=category.get('sub', '')
        )
        db.session.add(wrong)
    
    db.session.commit()
    return jsonify({'test_id': test.id})

@app.route('/api/save-category', methods=['POST'])
def save_category():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Not authenticated'}), 401
        
    data = request.get_json()
    test_id = data.get('testId')
    
    test = TestHistory.query.get(test_id)
    if not test or test.user_id != current_user.id:
        return jsonify({'error': 'Test not found'}), 404
        
    # Update categories in the database
    if not test.categories:
        categories = {}
    else:
        categories = json.loads(test.categories)
        
    categories[str(data['questionNumber'])] = {
        'main': data['mainCategory'],
        'sub': data['subCategory']
    }
    
    test.categories = json.dumps(categories)
    db.session.commit()
    
    return jsonify({'success': True})

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
def analytics():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
        
    # Get all tests
    tests = TestHistory.query.filter_by(user_id=current_user.id)\
        .order_by(TestHistory.date_taken.desc())\
        .all()
        
    # Calculate analytics
    analytics_data = {
        'total_tests': len(tests),
        'total_questions': sum(test.total_questions for test in tests),
        'average_time': round(sum(test.total_time for test in tests) / len(tests), 2) if tests else 0,
        'tests': tests
    }
    
    return render_template('analytics.html', **analytics_data)

def get_analytics_data(user_id):
    test_history = TestHistory.query.filter_by(user_id=user_id).all()
    
    # Prepare analytics data
    accuracy_data = []
    time_data = []
    category_data = defaultdict(lambda: {'correct': 0, 'total': 0})
    
    for test in test_history:
        # Add accuracy point
        accuracy_data.append({
            'date': test.date_taken.strftime('%Y-%m-%d'),
            'accuracy': (test.total_questions - len(json.loads(test.wrong_questions))) / test.total_questions * 100
        })
        
        # Add time point
        time_data.append({
            'date': test.date_taken.strftime('%Y-%m-%d'),
            'time': test.total_time
        })
        
        # Update category stats
        wrong_questions = json.loads(test.wrong_questions)
        for q in wrong_questions:
            category = q.get('category', 'Unknown')
            category_data[category]['total'] += 1
        
        # Add correct answers to categories
        total_per_category = test.total_questions / len(category_data)
        for category in category_data:
            category_data[category]['total'] += total_per_category
            category_data[category]['correct'] += total_per_category - category_data[category]['total']

    # Convert category data to lists for charts
    categories = list(category_data.keys())
    accuracy_by_category = [
        (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0
        for stats in category_data.values()
    ]

    return {
        'accuracy_trend': accuracy_data,
        'time_trend': time_data,
        'categories': {
            'names': categories,
            'accuracy': accuracy_by_category
        }
    }

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
