from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Device, User
from datetime import datetime

api = Blueprint('api', __name__)

@api.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    try:
        # Test database connection
        user_count = User.query.count()
        device_count = Device.query.count()
        
        return jsonify({
            "status": "healthy",
            "database": "connected",
            "stats": {
                "users": user_count,
                "devices": device_count
            },
            "timestamp": datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy", 
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

@api.route("/devices", methods=["GET"])
@jwt_required()
def get_devices():
    """Get all devices for current user"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        devices = Device.find_by_user_id(current_user.id)
        return jsonify([device.to_dict() for device in devices]), 200
        
    except Exception as e:
        print(f"Get devices error: {e}")
        return jsonify({"error": "Failed to fetch devices"}), 500

@api.route("/devices", methods=["POST"])
@jwt_required()
def add_device():
    """Add a new device"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        data = request.get_json()
        
        # Validate required fields
        if not data or not data.get('name'):
            return jsonify({"message": "Device name is required"}), 400
        
        # Handle different field names from frontend
        name = data.get('name', '').strip()
        description = data.get('description', data.get('device_type', '')).strip()
        category = data.get('category', data.get('device_type', '')).strip()
        location = data.get('location', data.get('location_text', '')).strip()
        status = data.get('status', 'lost')
        
        # Validate coordinates if provided
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if latitude is not None and latitude != '':
            try:
                latitude = float(latitude)
                if not (-90 <= latitude <= 90):
                    return jsonify({"message": "Latitude must be between -90 and 90"}), 400
            except (ValueError, TypeError):
                return jsonify({"message": "Invalid latitude format"}), 400
        else:
            latitude = None
        
        if longitude is not None and longitude != '':
            try:
                longitude = float(longitude)
                if not (-180 <= longitude <= 180):
                    return jsonify({"message": "Longitude must be between -180 and 180"}), 400
            except (ValueError, TypeError):
                return jsonify({"message": "Invalid longitude format"}), 400
        else:
            longitude = None
        
        # Validate status
        if status not in ['lost', 'found']:
            return jsonify({"message": "Status must be 'lost' or 'found'"}), 400
        
        # Create new device
        device = Device(
            name=name,
            user_id=current_user.id,
            description=description,
            category=category,
            status=status,
            location=location,
            latitude=latitude,
            longitude=longitude
        )
        
        if device.save():
            return jsonify(device.to_dict()), 201
        else:
            return jsonify({"message": "Failed to create device"}), 500
            
    except Exception as e:
        print(f"Add device error: {e}")
        return jsonify({"error": "Failed to create device"}), 500

@api.route("/devices/<int:device_id>", methods=["PUT"])
@jwt_required()
def update_device(device_id):
    """Update an existing device"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        # Find device
        device = Device.find_by_id(device_id)
        if not device:
            return jsonify({"message": "Device not found"}), 404
        
        # Check ownership
        if device.user_id != current_user.id:
            return jsonify({"message": "Unauthorized - you can only update your own devices"}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400
        
        # Update device fields
        if 'name' in data:
            if not data['name'].strip():
                return jsonify({"message": "Device name cannot be empty"}), 400
            device.name = data['name'].strip()
        
        if 'description' in data:
            device.description = data['description'].strip()
        
        # Handle device_type as category for backward compatibility
        if 'device_type' in data:
            device.category = data['device_type'].strip()
        
        if 'category' in data:
            device.category = data['category'].strip()
        
        # Handle both location and location_text
        if 'location' in data:
            device.location = data['location'].strip()
        elif 'location_text' in data:
            device.location = data['location_text'].strip()
        
        if 'status' in data:
            if data['status'] not in ['lost', 'found']:
                return jsonify({"message": "Status must be 'lost' or 'found'"}), 400
            device.status = data['status']
        
        # Update coordinates
        if 'latitude' in data:
            if data['latitude'] is not None and data['latitude'] != '':
                try:
                    latitude = float(data['latitude'])
                    if not (-90 <= latitude <= 90):
                        return jsonify({"message": "Latitude must be between -90 and 90"}), 400
                    device.latitude = latitude
                except (ValueError, TypeError):
                    return jsonify({"message": "Invalid latitude format"}), 400
            else:
                device.latitude = None
        
        if 'longitude' in data:
            if data['longitude'] is not None and data['longitude'] != '':
                try:
                    longitude = float(data['longitude'])
                    if not (-180 <= longitude <= 180):
                        return jsonify({"message": "Longitude must be between -180 and 180"}), 400
                    device.longitude = longitude
                except (ValueError, TypeError):
                    return jsonify({"message": "Invalid longitude format"}), 400
            else:
                device.longitude = None
        
        # Update timestamp
        device.updated_at = datetime.utcnow()
        
        # Save changes
        if device.save():
            return jsonify(device.to_dict()), 200
        else:
            return jsonify({"message": "Failed to update device"}), 500
            
    except Exception as e:
        print(f"Update device error: {e}")
        return jsonify({"error": "Failed to update device"}), 500

@api.route("/devices/<int:device_id>", methods=["DELETE"])
@jwt_required()
def delete_device(device_id):
    """Delete a device"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        # Find device
        device = Device.find_by_id(device_id)
        if not device:
            return jsonify({"message": "Device not found"}), 404
        
        # Check ownership
        if device.user_id != current_user.id:
            return jsonify({"message": "Unauthorized - you can only delete your own devices"}), 403
        
        # Delete device
        if device.delete():
            return jsonify({"message": "Device deleted successfully"}), 200
        else:
            return jsonify({"message": "Failed to delete device"}), 500
            
    except Exception as e:
        print(f"Delete device error: {e}")
        return jsonify({"error": "Failed to delete device"}), 500

@api.route("/devices/stats", methods=["GET"])
@jwt_required()
def get_device_stats():
    """Get device statistics for current user"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        stats = Device.get_user_stats(current_user.id)
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"Get stats error: {e}")
        return jsonify({"error": "Failed to fetch statistics"}), 500

@api.route("/devices/<int:device_id>/status", methods=["PATCH"])
@jwt_required()
def update_device_status(device_id):
    """Update device status only"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        device = Device.find_by_id(device_id)
        if not device:
            return jsonify({"message": "Device not found"}), 404
        
        # Check ownership
        if device.user_id != current_user.id:
            return jsonify({"message": "Unauthorized"}), 403
        
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({"message": "Status is required"}), 400
        
        new_status = data['status']
        if new_status not in ['lost', 'found']:
            return jsonify({"message": "Status must be 'lost' or 'found'"}), 400
        
        if device.update_status(new_status):
            return jsonify({
                "message": f"Device status updated to {new_status}",
                "device": device.to_dict()
            }), 200
        else:
            return jsonify({"message": "Failed to update status"}), 500
            
    except Exception as e:
        print(f"Update status error: {e}")
        return jsonify({"error": "Failed to update device status"}), 500

@api.route("/devices/search", methods=["GET"])
@jwt_required()
def search_devices():
    """Search devices by query"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user:
            return jsonify({"message": "User not found"}), 404
        
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({"message": "Search query is required"}), 400
        
        devices = Device.search_devices(query, current_user.id)
        return jsonify([device.to_dict() for device in devices]), 200
        
    except Exception as e:
        print(f"Search devices error: {e}")
        return jsonify({"error": "Failed to search devices"}), 500

# Admin routes
@api.route("/admin/devices", methods=["GET"])
@jwt_required()
def admin_get_all_devices():
    """Get all devices (admin only)"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user or not current_user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        devices = Device.find_all()
        return jsonify([device.to_dict() for device in devices]), 200
        
    except Exception as e:
        print(f"Admin get devices error: {e}")
        return jsonify({"error": "Failed to fetch all devices"}), 500

@api.route("/admin/stats", methods=["GET"])
@jwt_required()
def admin_get_stats():
    """Get overall statistics (admin only)"""
    try:
        current_user = User.find_by_username(get_jwt_identity())
        if not current_user or not current_user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        user_count = User.query.count()
        device_count = Device.query.count()
        lost_count = Device.query.filter_by(status='lost').count()
        found_count = Device.query.filter_by(status='found').count()
        
        return jsonify({
            'users': user_count,
            'devices': device_count,
            'lost': lost_count,
            'found': found_count
        }), 200
        
    except Exception as e:
        print(f"Admin stats error: {e}")
        return jsonify({"error": "Failed to fetch statistics"}), 500