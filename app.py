from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
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
    email = db.Column(db.String(120), nullable=False)
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

@app.route('/start_test', methods=['POST'])
def start_test():
    test_type = request.form.get('test_type')
    if test_type == 'mathcounts':
        num_questions = 30
        time_limit = 40
    else:
        num_questions = int(request.form.get('num_questions', 30))
        time_limit = int(request.form.get('time_limit', 40))

    test_id = str(time.time())
    test_data = {
        'user_id': current_user.id if current_user.is_authenticated else None,
        'test_type': test_type,
        'total_questions': num_questions,
        'time_limit': time_limit * 60,  # Convert to seconds
        'start_time': time.time(),
        'question_times': [],
        'wrong_questions': [],
        'current_question': 0,
        'completed': False
    }
    active_tests[test_id] = test_data
    
    return redirect(url_for('test_interface', test_id=test_id))

@app.route('/test/<test_id>')
def test_interface(test_id):
    test = active_tests.get(test_id)
    if not test:
        flash('Test not found or has expired', 'error')
        return redirect(url_for('train'))
    
    return render_template('test.html', 
                         user=current_user, 
                         test=test,
                         categories=PROBLEM_CATEGORIES)

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
        email = request.form.get('email')

        # Validation
        error = None
        if len(password) < 4:
            error = 'Password must be at least 4 characters long.'
        elif password != confirm_password:
            error = 'Passwords do not match.'
        elif User.query.filter_by(username=username).first():
            error = 'Username already exists.'
        
        if error is None:
            user = User(
                username=username,
                email=email
            )
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            flash('Account created successfully! Please log in.', 'success')
            return redirect(url_for('login'))
        
        flash(error, 'error')
    
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/record-question', methods=['POST'])
def record_question():
    data = request.json
    test_id = data['test_id']
    test = active_tests.get(test_id)
    
    if not test:
        return jsonify({'error': 'Test not found'}), 404
    
    test['question_times'].append(data['time'])
    test['current_question'] = data['question_number']
    
    if data.get('wrong_data'):
        test['wrong_questions'].append({
            'question_number': data['question_number'],
            'category': data['wrong_data']['category']
        })
    
    if test['current_question'] >= test['total_questions']:
        test['completed'] = True
        if test['user_id']:
            save_test_history(test)
    
    return jsonify({'success': True})

@app.route('/api/results/<test_id>')
def get_results(test_id):
    test = active_tests.get(test_id)
    if not test:
        return jsonify({'error': 'Test not found'}), 404
    
    total_time = int(time.time() - test['start_time'])
    if total_time > test['time_limit']:
        total_time = test['time_limit']
    
    return jsonify({
        'user_id': test['user_id'],
        'test_type': test['test_type'],
        'total_questions': test['total_questions'],
        'completed_questions': test['current_question'],
        'total_time': total_time,
        'question_times': test['question_times'],
        'wrong_questions': test['wrong_questions']
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
