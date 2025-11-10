import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import toast from 'react-hot-toast';
import ImageCropModal from '../components/ImageCropModal';
import './ProfilePage.css';

function ProfilePage() {
  const { user, setUser } = useAuthStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit state
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profile_image_url || null);
  const [profileImagePreview, setProfileImagePreview] = useState(user?.profile_image_url || null);
  const [handle, setHandle] = useState(user?.handle || '');
  const [hideNamePrivacy, setHideNamePrivacy] = useState(user?.hide_name_privacy || false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [handleValidation, setHandleValidation] = useState({ checking: false, available: null, error: null });
  const [handleCheckTimeout, setHandleCheckTimeout] = useState(null);
  
  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  
  const fileInputRef = useRef(null);
  
  // Track profile view (viewing own profile)
  usePageView('profile', { profileId: user?.id, profileName: `${user?.firstName} ${user?.lastName}` });

  // Sync form state with user data when it loads or changes
  useEffect(() => {
    if (user) {
      setProfileImageUrl(user.profile_image_url || null);
      setProfileImagePreview(user.profile_image_url || null);
      setHandle(user.handle || '');
      setHideNamePrivacy(user.hide_name_privacy || false);
    }
  }, [user]);


  // Generate initials for avatar
  const getInitials = () => {
    if (!user) return '';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Get display name - show handle if available, otherwise "FirstName L."
  const getDisplayName = () => {
    if (!user) return '';
    
    // Prefer handle for main display
    if (user.handle) {
      return `@${user.handle}`;
    }
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    
    // If we have both first and last name, show "FirstName L."
    if (firstName && lastName) {
      const lastInitial = lastName.charAt(0);
      return `${firstName} ${lastInitial}.`;
    }
    
    // If only first name, show just first name
    if (firstName) {
      return firstName;
    }
    
    // Fallback to email prefix or "Profile"
    return user.email?.split('@')[0] || 'Profile';
  };

  // Get "FirstName L." format for subheading
  const getNameWithInitial = () => {
    if (!user) return '';
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    
    // If we have both first and last name, show "FirstName L."
    if (firstName && lastName) {
      const lastInitial = lastName.charAt(0);
      return `${firstName} ${lastInitial}.`;
    }
    
    // If only first name, show just first name
    if (firstName) {
      return firstName;
    }
    
    return '';
  };

  // Handle edit mode toggle
  const handleEditClick = () => {
    setIsEditing(true);
    // Initialize edit state with current user data
    setProfileImageUrl(user?.profile_image_url || null);
    setProfileImagePreview(user?.profile_image_url || null);
    setHandle(user?.handle || '');
    setHideNamePrivacy(user?.hide_name_privacy || false);
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setProfileImagePreview(user?.profile_image_url || null);
    setHandle(user?.handle || '');
    setHideNamePrivacy(user?.hide_name_privacy || false);
    setHandleValidation({ checking: false, available: null, error: null });
  };

  // Handle image file selection
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PNG, JPG, and WebP formats are allowed');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Read file and show crop modal
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle crop completion
  const handleCropComplete = async (croppedFile) => {
    setShowCropModal(false);
    setIsUploadingImage(true);

    // Validate the cropped file before uploading
    if (!croppedFile || croppedFile.type !== 'image/jpeg') {
      toast.error('Invalid image format. Please try again.');
      setIsUploadingImage(false);
      setImageToCrop(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (croppedFile.size > 500 * 1024) {
      toast.error('Image file is too large. Please try again.');
      setIsUploadingImage(false);
      setImageToCrop(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.append('profileImage', croppedFile);

      const response = await fetch('/api/profile/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setProfileImageUrl(data.profile_image_url);
      setProfileImagePreview(data.profile_image_url);
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      setImageToCrop(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle crop cancel
  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setProfileImageUrl(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle handle input change with debounced validation
  const handleHandleChange = (e) => {
    const value = e.target.value.replace('@', ''); // Remove @ if user types it
    setHandle(value);

    // Clear existing timeout
    if (handleCheckTimeout) {
      clearTimeout(handleCheckTimeout);
    }

    // Reset validation state
    setHandleValidation({ checking: false, available: null, error: null });

    if (!value || value.length < 3) {
      return;
    }

    // Set new timeout for validation
    const timeout = setTimeout(async () => {
      setHandleValidation({ checking: true, available: null, error: null });
      
      try {
        const response = await fetch(`/api/profile/handle-availability?handle=${encodeURIComponent(value)}`, {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.error) {
          setHandleValidation({ checking: false, available: false, error: data.error });
        } else {
          setHandleValidation({ checking: false, available: data.available, error: null });
        }
      } catch (error) {
        console.error('Error checking handle:', error);
        setHandleValidation({ checking: false, available: null, error: 'Failed to check availability' });
      }
    }, 500);

    setHandleCheckTimeout(timeout);
  };

  // Generate new handle
  const handleGenerateHandle = async () => {
    try {
      const response = await fetch('/api/profile/generate-handle', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      setHandle(data.handle);
      setHandleValidation({ checking: false, available: true, error: null });
      toast.success(`New handle generated: @${data.handle}`);
    } catch (error) {
      console.error('Error generating handle:', error);
      toast.error(error.message || 'Failed to generate handle');
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const updates = {};
      
      if (profileImageUrl !== user?.profile_image_url) {
        updates.profileImageUrl = profileImageUrl;
      }
      
      if (handle !== user?.handle) {
        if (handle && !handleValidation.available) {
          toast.error('Please choose an available handle');
          setIsSaving(false);
          return;
        }
        updates.handle = handle || null;
      }
      
      if (hideNamePrivacy !== user?.hide_name_privacy) {
        updates.hideNamePrivacy = hideNamePrivacy;
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const data = await response.json();
      
      // Update user in store
      setUser({
        ...user,
        profile_image_url: data.user.profile_image_url,
        handle: data.user.handle,
        hide_name_privacy: data.user.hide_name_privacy,
      });

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          {/* Profile Avatar/Image */}
          <div className="profile-avatar-wrapper">
            {isEditing ? (
              <div className="profile-avatar-edit">
                {profileImagePreview ? (
                  <img src={profileImagePreview} alt="Profile" className="profile-avatar-image" />
                ) : (
                  <div className="profile-avatar">{getInitials()}</div>
                )}
                <div className="profile-avatar-controls">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="avatar-btn avatar-btn-upload"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? 'Uploading...' : profileImagePreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {profileImagePreview && (
                    <button 
                      className="avatar-btn avatar-btn-remove"
                      onClick={handleRemoveImage}
                      disabled={isUploadingImage}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="avatar-hint">Recommended: 512x512px, max 3MB</p>
              </div>
            ) : (
              <>
                {user?.profile_image_url ? (
                  <img src={user.profile_image_url} alt="Profile" className="profile-avatar-image" />
                ) : (
                  <div className="profile-avatar">{getInitials()}</div>
                )}
              </>
            )}
          </div>

          {/* Display Name */}
          {!isEditing && (
            <>
              <h1>{getDisplayName()}</h1>
              {getNameWithInitial() && (
                <p className="profile-real-name">{getNameWithInitial()}</p>
              )}
              <p className="profile-email">{user?.email}</p>
            </>
          )}

          {/* Edit Form */}
          {isEditing && (
            <div className="profile-edit-form">
              {/* Show name in edit mode */}
              {getNameWithInitial() && (
                <>
                  <p className="profile-edit-name">{getNameWithInitial()}</p>
                  <p className="profile-edit-disclaimer">
                    To edit your name, visit{' '}
                    <a 
                      href="https://www.jerky.com/account" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="jerky-link"
                    >
                      jerky.com/account
                    </a>
                  </p>
                </>
              )}
              
              <div className="form-group">
                <label htmlFor="handle">Handle</label>
                <div className="handle-input-wrapper">
                  <span className="handle-prefix">@</span>
                  <input
                    id="handle"
                    type="text"
                    className="profile-input"
                    value={handle}
                    onChange={handleHandleChange}
                    placeholder="smokybeef247"
                    maxLength={20}
                  />
                  <button 
                    type="button"
                    className="generate-handle-btn"
                    onClick={handleGenerateHandle}
                    title="Generate a fun jerky.com-inspired handle"
                  >
                    🎲 Pick one for me
                  </button>
                </div>
                {handleValidation.checking && (
                  <p className="handle-feedback checking">Checking availability...</p>
                )}
                {!handleValidation.checking && handleValidation.available === true && handle && (
                  <p className="handle-feedback available">✓ Handle is available</p>
                )}
                {!handleValidation.checking && handleValidation.available === false && (
                  <p className="handle-feedback unavailable">✗ Handle is taken</p>
                )}
                {handleValidation.error && (
                  <p className="handle-feedback error">{handleValidation.error}</p>
                )}
              </div>

              <div className="form-group privacy-checkbox-hidden">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hideNamePrivacy}
                    onChange={(e) => setHideNamePrivacy(e.target.checked)}
                  />
                  <span>Hide my first name and last initial</span>
                </label>
                <p className="form-hint">When checked, your handle will be shown instead of your real name</p>
              </div>

              <div className="profile-edit-actions">
                <button className="btn btn-secondary" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Edit Buttons */}
          {!isEditing && (
            <div className="profile-action-buttons">
              <button className="btn btn-edit-profile" onClick={handleEditClick}>
                Edit Profile
              </button>
              <a 
                href="https://www.jerky.com/account" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-edit-jerky-profile"
              >
                Edit Jerky.com Profile
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Image Crop Modal */}
      {showCropModal && imageToCrop && (
        <ImageCropModal
          imageSrc={imageToCrop}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

export default ProfilePage;
