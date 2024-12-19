from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import time
from datetime import datetime
import os
import json

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

# Problem categories data
PROBLEM_CATEGORIES = {
    "Geometry": [
        "Angle Chasing",
        "Congruence and Similarity",
        "Circle Problems",
        "Polygon Properties",
        "Triangles",
        "Coordinate Geometry",
        "3D Geometry",
        "Special Triangles"
    ],
    "Algebra": [
        "Linear Equations",
        "Quadratics",
        "Polynomials",
        "Exponential and Logarithmic Problems",
        "Functional Equations",
        "Sequences and Series"
    ],
    "Arithmetic and Number Theory": [
        "Prime Factorization",
        "Divisibility",
        "Modular Arithmetic",
        "Number Bases",
        "Clock Problems",
        "Digit Problems",
        "Consecutive Numbers"
    ],
    "Word Problems": [
        "Speed, Distance, and Rate",
        "Work Problems",
        "Mixture Problems",
        "Age Problems",
        "Percentage Problems",
        "Proportion and Ratio Problems"
    ],
    "Counting and Probability": [
        "Permutations",
        "Combinations",
        "Probability",
        "Expected Value",
        "Set Problems"
    ],
    "Miscellaneous Problems": [
        "Clock Problems",
        "Calendar Problems",
        "Pattern Problems",
        "Optimization Problems",
        "Logic Problems",
        "Estimation Problems"
    ]
}

# Active tests in memory
active_tests = {}

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('dashboard.html', user=current_user)

@app.route('/train')
def train():
    return render_template('train.html', user=current_user, categories=PROBLEM_CATEGORIES)

@app.route('/api/categories')
def get_categories():
    return jsonify(PROBLEM_CATEGORIES)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        user = User.query.filter_by(username=data['username']).first()
        if user and check_password_hash(user.password_hash, data['password']):
            login_user(user)
            return jsonify({'success': True})
        return jsonify({'success': False, 'message': 'Invalid username or password'})
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        data = request.json
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'success': False, 'message': 'Username already exists'})
        
        user = User(
            username=data['username'],
            password_hash=generate_password_hash(data['password'])
        )
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return jsonify({'success': True})
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/start-test', methods=['POST'])
def start_test():
    data = request.json
    test_id = str(time.time())
    test_data = {
        'user_id': current_user.id if current_user.is_authenticated else None,
        'test_type': data['testType'],
        'total_questions': int(data['numQuestions']),
        'time_limit': int(data['timeLimit']) * 60,
        'start_time': time.time(),
        'question_times': [],
        'current_question': 0,
        'completed': False
    }
    active_tests[test_id] = test_data
    return jsonify({'test_id': test_id})

@app.route('/api/record-question', methods=['POST'])
def record_question():
    data = request.json
    test_id = data['testId']
    test = active_tests.get(test_id)
    
    if not test or test['completed']:
        return jsonify({'error': 'Invalid test'}), 400
    
    current_time = time.time() - test['start_time']
    test['question_times'].append(current_time)
    test['current_question'] += 1
    
    # Record wrong question if specified
    if 'wrongQuestion' in data:
        if 'wrong_questions' not in test:
            test['wrong_questions'] = []
        test['wrong_questions'].append({
            'question_number': data['wrongQuestion'],
            'category': data.get('category'),
            'subcategory': data.get('subcategory')
        })
    
    if test['current_question'] >= test['total_questions']:
        test['completed'] = True
        if current_user.is_authenticated:
            save_test_history(test)
        
    return jsonify({
        'current_question': test['current_question'],
        'completed': test['completed']
    })

@app.route('/api/get-results/<test_id>')
def get_results(test_id):
    test = active_tests.get(test_id)
    if not test:
        return jsonify({'error': 'Test not found'}), 404
        
    question_times = []
    for i, time_taken in enumerate(test['question_times']):
        if i > 0:
            duration = time_taken - test['question_times'][i-1]
        else:
            duration = time_taken
        
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        question_times.append(f"{minutes:02d}:{seconds:02d}")
    
    total_time = time.time() - test['start_time']
    
    return jsonify({
        'test_type': test['test_type'],
        'total_questions': test['total_questions'],
        'completed_questions': test['current_question'],
        'total_time': f"{int(total_time//60):02d}:{int(total_time%60):02d}",
        'question_times': question_times,
        'is_guest': not current_user.is_authenticated
    })

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
    total_time = int(time.time() - test['start_time'])
    history = TestHistory(
        user_id=test['user_id'],
        test_type=test['test_type'],
        total_questions=test['total_questions'],
        completed_questions=test['current_question'],
        total_time=total_time,
        question_times=json.dumps(test['question_times']),
        wrong_questions=json.dumps(test.get('wrong_questions', []))
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
