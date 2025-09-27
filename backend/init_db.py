import os
from app import create_app
from models import db, User

def init_database():
    print("🚀 Initializing SQLite database...")
    
    try:
        app = create_app()
        with app.app_context():
            db.create_all()
            print("✅ Database tables created successfully.")
            
            # Create default admin user
            if not User.query.filter_by(username='admin').first():
                admin_user = User(
                    username='admin',
                    email='admin@example.com',
                    password='admin123',
                    is_admin=True
                )
                db.session.add(admin_user)
                db.session.commit()
                print("✅ Default admin user created.")
            else:
                print("ℹ️ Admin user already exists.")

            print("✅ Database initialization completed!")
            return True
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == '__main__':
    init_database()