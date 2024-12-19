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

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24))

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
    email = db.Column(db.String(120), unique=True, nullable=False)
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
    return render_template('dashboard.html')

@app.route('/dashboard')
def dashboard():
    # Get test history for logged in user, or show empty state if not logged in
    test_history = []
    if current_user.is_authenticated:
        test_history = TestHistory.query.filter_by(user_id=current_user.id).order_by(TestHistory.date_taken.desc()).limit(10).all()
    
    return render_template('dashboard.html', test_history=test_history)

@app.route('/train')
def train():
    return render_template('train.html')

@app.route('/test')
def test_interface():
    return render_template('test.html')

@app.route('/results/<int:test_id>')
def results(test_id):
    test = None
    if current_user.is_authenticated:
        test = TestHistory.query.get_or_404(test_id)
        if test.user_id != current_user.id:
            abort(403)
    return render_template('results.html', test=test)

@app.route('/analytics')
def analytics():
    analytics_data = {}
    if current_user.is_authenticated:
        analytics_data = get_analytics_data(current_user.id)
    return render_template('analytics.html', **analytics_data)

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

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        # Check if username already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists. Please choose another username.', 'danger')
            return redirect(url_for('signup'))

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return redirect(url_for('signup'))

        if len(password) < 8:
            flash('Password must be at least 8 characters long.', 'danger')
            return redirect(url_for('signup'))

        # Create new user
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        # Log the user in
        login_user(user)
        session['show_banner'] = True  # Set banner flag
        flash('Account created successfully! Welcome to Math Trainer.', 'success')
        return redirect(url_for('dashboard'))

    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            session['show_banner'] = True  # Set banner flag
            flash('Welcome back!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'danger')
            return redirect(url_for('login'))

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

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
    db.create_all()
    
    # Initialize problem categories if empty
    if ProblemCategory.query.count() == 0:
        for category, subcategories in PROBLEM_CATEGORIES.items():
            parent = ProblemCategory(name=category)
            db.session.add(parent)
            db.session.commit()  # Commit to get parent ID
            
            for subcategory in subcategories:
                child = ProblemCategory(name=subcategory, parent_id=parent.id)
                db.session.add(child)
        
        db.session.commit()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
