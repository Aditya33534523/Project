from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from datetime import timedelta
from models import db, User
from routes import api
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app():
    """Application factory - SQLAlchemy only"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    
    # SQLite Database Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///lostfound.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ECHO'] = os.getenv('FLASK_ENV') == 'development'
    
    # Initialize extensions
    db.init_app(app)
    jwt = JWTManager(app)
    
    # CORS Configuration
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    CORS(app, supports_credentials=True, origins=cors_origins)
    
    # Register blueprints
    app.register_blueprint(api, url_prefix='/api')
    
    # Create tables
    with app.app_context():
        try:
            db.create_all()
            print("✅ SQLAlchemy database tables created successfully")
        except Exception as e:
            print(f"❌ Error creating database tables: {e}")
    
    return app

# Create app instance
app = create_app()

@app.route('/api/auth/register', methods=['POST'])
def register():
    """User registration endpoint using SQLAlchemy"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({"message": "Username and password are required"}), 400
        
        # Check if username already exists using SQLAlchemy
        if User.find_by_username(data['username']):
            return jsonify({"message": "Username already exists"}), 400
        
        # Check if email already exists (if provided) using SQLAlchemy
        email = data.get('email', '').strip()
        if email and User.find_by_email(email):
            return jsonify({"message": "Email already exists"}), 400
        
        # Create new user using SQLAlchemy
        user = User(
            username=data['username'].strip(),
            email=email if email else None,
            password=data['password']
        )
        
        if user.save():
            return jsonify({
                "message": "User created successfully",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            }), 201
        else:
            return jsonify({"message": "Failed to create user"}), 500
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint using SQLAlchemy"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({"message": "Username and password are required"}), 400
        
        # Find user and verify password using SQLAlchemy
        user = User.find_by_username(data['username'])
        
        if user and user.check_password(data['password']):
            # Create access token
            access_token = create_access_token(identity=user.username)
            return jsonify({
                "token": access_token,
                "username": user.username,
                "user_id": user.id,
                "is_admin": user.is_admin
            }), 200
        
        return jsonify({"message": "Invalid credentials"}), 401
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile using SQLAlchemy"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        return jsonify(current_user.to_dict()), 200
        
    except Exception as e:
        print(f"Profile error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    try:
        # Test SQLAlchemy database connection
        user_count = User.query.count()
        return jsonify({
            "status": "healthy",
            "database": "SQLAlchemy + SQLite",
            "users": user_count
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    print("🚀 Starting Lost & Found Tracker with SQLAlchemy + SQLite")
    print("📊 Database: SQLite with SQLAlchemy ORM")
    print("🌐 Frontend: http://localhost:3000")
    print("🔧 Backend: http://localhost:5000")
    print("👤 Default login: admin / admin123")
    app.run(debug=True, host='0.0.0.0', port=5000)