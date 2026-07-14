import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HeaderLogo from "../components/HeaderLogo";
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { API_URL, API_BASE_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

const ProfileScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycData, setKycData] = useState({
    documentType: 'passport',
    documentNumber: '',
    frontImage: null,
    backImage: null,
    selfieImage: null,
  });
  const [kycStatus, setKycStatus] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [editData, setEditData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadUser();
    fetchKycStatus();
  }, []);

  const fetchKycStatus = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        const token = await SecureStore.getItemAsync('token');
        const res = await fetch(`${API_URL}/kyc/status/${parsed._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.kyc) {
          setKycStatus(data.kyc);
        }
      }
    } catch (e) {
      console.error('Error fetching KYC status:', e);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        // Convert relative path to full URL if needed
        let imageUrl = parsed.profileImage || null;
        console.log('Loading profile image from storage:', imageUrl);
        if (imageUrl && imageUrl.startsWith('/uploads')) {
          imageUrl = `${API_BASE_URL}${imageUrl}`;
        }
        // Remove old cache-busting param and add new one if URL exists
        if (imageUrl) {
          imageUrl = imageUrl.split('?')[0] + `?t=${Date.now()}`;
        }
        console.log('Final profile image URL:', imageUrl);
        setProfileImage(imageUrl);
        setEditData({
          firstName: parsed.firstName || '',
          lastName: parsed.lastName || '',
          phone: parsed.phone || '',
        });
      }
    } catch (e) {
      console.error('Error loading user:', e);
    }
    setLoading(false);
  };

  const pickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload profile image');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadProfileImage(result.assets[0].uri);
    }
  };

  const takeProfilePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to take photo');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfileImage = async (imageUri) => {
    setUploadingImage(true);
    console.log('Starting profile image upload:', imageUri);
    try {
      const token = await SecureStore.getItemAsync('token');
      const formData = new FormData();
      formData.append('userId', user._id);
      formData.append('profileImage', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      console.log('Uploading to:', `${API_URL}/upload/profile-image`);
      const res = await fetch(`${API_URL}/upload/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      console.log('Upload response status:', res.status);
      const data = await res.json();
      console.log('Profile image upload response:', data);
      
      if (data.success || data.profileImage) {
        // Convert relative path to full URL
        let imageUrl = data.profileImage || imageUri;
        console.log('Original image URL from server:', imageUrl);
        if (imageUrl && imageUrl.startsWith('/uploads')) {
          imageUrl = `${API_BASE_URL}${imageUrl}`;
        }
        // Add cache-busting parameter to force reload
        imageUrl = `${imageUrl}?t=${Date.now()}`;
        console.log('Final image URL:', imageUrl);
        setProfileImage(imageUrl);
        // Store relative path in SecureStore, not full URL
        const updatedUser = { ...user, profileImage: data.profileImage };
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('Success', 'Profile image updated successfully');
      } else {
        console.log('Profile image upload failed:', data);
        Alert.alert('Error', data.message || 'Failed to upload image');
      }
    } catch (e) {
      console.error('Upload error:', e.message);
      Alert.alert('Error', 'Failed to upload profile image');
    }
    setUploadingImage(false);
  };

  const showImageOptions = () => {
    Alert.alert(
      'Update Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takeProfilePhoto },
        { text: 'Choose from Gallery', onPress: pickProfileImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!editData.firstName || !editData.lastName) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/auth/update-profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user._id,
          ...editData
        })
      });
      const data = await res.json();
      if (data.success) {
        const updatedUser = { ...user, ...editData };
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('Success', 'Profile updated successfully');
        setShowEditModal(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to update profile');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile');
    }
    setIsSubmitting(false);
  };

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload documents');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setKycData({ ...kycData, [type]: result.assets[0].uri });
    }
  };

  const takePhoto = async (type) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: type === 'selfieImage' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setKycData({ ...kycData, [type]: result.assets[0].uri });
    }
  };

  const handleSubmitKyc = async () => {
    if (!kycData.documentNumber) {
      Alert.alert('Error', 'Please enter document number');
      return;
    }
    if (!kycData.frontImage) {
      Alert.alert('Error', 'Please upload front side of document');
      return;
    }
    if (!kycData.selfieImage) {
      Alert.alert('Error', 'Please upload a selfie with document');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      
      // Use FormData for file upload instead of base64
      const formData = new FormData();
      formData.append('userId', user._id);
      formData.append('documentType', kycData.documentType);
      formData.append('documentNumber', kycData.documentNumber);
      
      // Append front image
      formData.append('frontImage', {
        uri: kycData.frontImage,
        type: 'image/jpeg',
        name: 'front.jpg',
      });
      
      // Append back image if exists
      if (kycData.backImage) {
        formData.append('backImage', {
          uri: kycData.backImage,
          type: 'image/jpeg',
          name: 'back.jpg',
        });
      }
      
      // Append selfie image
      formData.append('selfieImage', {
        uri: kycData.selfieImage,
        type: 'image/jpeg',
        name: 'selfie.jpg',
      });

      console.log('Submitting KYC with FormData...');
      const res = await fetch(`${API_URL}/kyc/submit-files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      console.log('KYC submit response:', data);
      if (data.success || data.kyc) {
        Alert.alert('Success', 'KYC documents submitted successfully. Please wait for verification.');
        setShowKycModal(false);
        fetchKycStatus();
      } else {
        Alert.alert('Error', data.message || 'Failed to submit KYC');
      }
    } catch (e) {
      console.error('KYC submit error:', e);
      Alert.alert('Error', 'Failed to submit KYC documents: ' + e.message);
    }
    setIsSubmitting(false);
  };

  const getKycStatusColor = () => {
    if (!kycStatus) return '#ef4444';
    switch (kycStatus.status) {
      case 'approved': return '#22c55e';
      case 'pending': return '#eab308';
      case 'rejected': return '#ef4444';
      default: return '#ef4444';
    }
  };

  const getKycStatusText = () => {
    if (!kycStatus) return 'Not Submitted';
    switch (kycStatus.status) {
      case 'approved': return 'Verified';
      case 'pending': return 'Pending Review';
      case 'rejected': return 'Rejected';
      default: return 'Not Submitted';
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user._id,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Password changed successfully');
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        Alert.alert('Error', data.message || 'Failed to change password');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to change password');
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
        <HeaderLogo />
      </View>

      <ScrollView>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.bgCard }]}>
          <TouchableOpacity style={styles.avatarContainer} onPress={showImageOptions} disabled={uploadingImage}>
            {profileImage ? (
              <Image 
                source={{ uri: profileImage }} 
                style={styles.avatarImage}
                onError={() => setProfileImage(null)}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
            <View style={[styles.avatarEditBtn, { backgroundColor: colors.accent }]}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.firstName} {user?.lastName}</Text>
          <Text style={[styles.userEmail, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
          
          <View style={[styles.infoItem, { backgroundColor: colors.bgCard }]}>
            <View style={styles.infoLeft}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Full Name</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.firstName} {user?.lastName}</Text>
          </View>
          
          <View style={[styles.infoItem, { backgroundColor: colors.bgCard }]}>
            <View style={styles.infoLeft}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Email</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.email}</Text>
          </View>
          
          <View style={[styles.infoItem, { backgroundColor: colors.bgCard }]}>
            <View style={styles.infoLeft}>
              <Ionicons name="call-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Phone</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>

        {/* KYC Section - Mandatory */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KYC Verification</Text>
            <View style={[styles.mandatoryBadge, { backgroundColor: '#ef444420' }]}>
              <Text style={styles.mandatoryText}>Mandatory</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.kycCard, { backgroundColor: colors.bgCard, borderColor: getKycStatusColor() }]}
            onPress={() => {
              if (kycStatus?.status !== 'approved' && kycStatus?.status !== 'pending') {
                setShowKycModal(true);
              }
            }}
          >
            <View style={styles.kycHeader}>
              <View style={[styles.kycIconContainer, { backgroundColor: `${getKycStatusColor()}20` }]}>
                <Ionicons 
                  name={kycStatus?.status === 'approved' ? 'shield-checkmark' : kycStatus?.status === 'pending' ? 'time' : 'shield-outline'} 
                  size={28} 
                  color={getKycStatusColor()} 
                />
              </View>
              <View style={styles.kycInfo}>
                <Text style={[styles.kycTitle, { color: colors.textPrimary }]}>Identity Verification</Text>
                <View style={styles.kycStatusRow}>
                  <View style={[styles.kycStatusDot, { backgroundColor: getKycStatusColor() }]} />
                  <Text style={[styles.kycStatusText, { color: getKycStatusColor() }]}>{getKycStatusText()}</Text>
                </View>
              </View>
              {kycStatus?.status !== 'approved' && kycStatus?.status !== 'pending' && (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </View>
            
            {!kycStatus && (
              <View style={[styles.kycWarning, { backgroundColor: '#ef444410' }]}>
                <Ionicons name="warning" size={16} color="#ef4444" />
                <Text style={styles.kycWarningText}>Complete KYC to access all features including withdrawals</Text>
              </View>
            )}
            
            {kycStatus?.status === 'rejected' && kycStatus?.rejectionReason && (
              <View style={[styles.kycWarning, { backgroundColor: '#ef444410' }]}>
                <Ionicons name="close-circle" size={16} color="#ef4444" />
                <Text style={styles.kycWarningText}>Reason: {kycStatus.rejectionReason}</Text>
              </View>
            )}
            
            {kycStatus?.status === 'approved' && (
              <View style={[styles.kycSuccess, { backgroundColor: '#22c55e10' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.kycSuccessText}>Your identity has been verified</Text>
              </View>
            )}
            
            {kycStatus?.status === 'pending' && (
              <View style={[styles.kycPending, { backgroundColor: '#eab30810' }]}>
                <Ionicons name="hourglass" size={16} color="#eab308" />
                <Text style={styles.kycPendingText}>Your documents are under review (1-2 business days)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account Settings</Text>
          
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.bgCard }]} onPress={() => setShowEditModal(true)}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#22c55e20' }]}>
                <Ionicons name="create-outline" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.bgCard }]} onPress={() => setShowPasswordModal(true)}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#22c55e20' }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>First Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
              value={editData.firstName}
              onChangeText={(text) => setEditData({ ...editData, firstName: text })}
              placeholder="Enter first name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Last Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
              value={editData.lastName}
              onChangeText={(text) => setEditData({ ...editData, lastName: text })}
              placeholder="Enter last name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Phone</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
              value={editData.phone}
              onChangeText={(text) => setEditData({ ...editData, phone: text })}
              placeholder="Enter phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />

            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} 
              onPress={handleUpdateProfile}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Current Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
              placeholder="Enter current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>New Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
              placeholder="Enter new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />

            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} 
              onPress={handleChangePassword}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* KYC Modal */}
      <Modal visible={showKycModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.kycModalScroll}>
            <View style={[styles.kycModalContent, { backgroundColor: colors.bgCard }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>KYC Verification</Text>
                <TouchableOpacity onPress={() => setShowKycModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.kycModalSubtitle, { color: colors.textMuted }]}>
                Please provide your identity documents for verification
              </Text>

              {/* Document Type */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Document Type</Text>
              <View style={styles.documentTypeRow}>
                {['passport', 'aadhaar', 'driving_license'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.documentTypeBtn,
                      { backgroundColor: colors.bgSecondary, borderColor: colors.border },
                      kycData.documentType === type && { backgroundColor: `${colors.accent}20`, borderColor: colors.accent }
                    ]}
                    onPress={() => setKycData({ ...kycData, documentType: type })}
                  >
                    <Text style={[
                      styles.documentTypeText,
                      { color: colors.textMuted },
                      kycData.documentType === type && { color: colors.accent }
                    ]}>
                      {type === 'passport' ? 'Passport' : type === 'aadhaar' ? 'Aadhar Card' : 'License'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Document Number */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Document Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }]}
                value={kycData.documentNumber}
                onChangeText={(text) => setKycData({ ...kycData, documentNumber: text })}
                placeholder="Enter document number"
                placeholderTextColor={colors.textMuted}
              />

              {/* Front Image */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Document Front Side *</Text>
              <View style={styles.imageUploadRow}>
                <TouchableOpacity 
                  style={[styles.imageUploadBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => pickImage('frontImage')}
                >
                  {kycData.frontImage ? (
                    <Image source={{ uri: kycData.frontImage }} style={styles.uploadedImage} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                      <Text style={[styles.uploadText, { color: colors.textMuted }]}>Gallery</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.imageUploadBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => takePhoto('frontImage')}
                >
                  <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.uploadText, { color: colors.textMuted }]}>Camera</Text>
                </TouchableOpacity>
              </View>

              {/* Back Image */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Document Back Side (Optional)</Text>
              <View style={styles.imageUploadRow}>
                <TouchableOpacity 
                  style={[styles.imageUploadBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => pickImage('backImage')}
                >
                  {kycData.backImage ? (
                    <Image source={{ uri: kycData.backImage }} style={styles.uploadedImage} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                      <Text style={[styles.uploadText, { color: colors.textMuted }]}>Gallery</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.imageUploadBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => takePhoto('backImage')}
                >
                  <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.uploadText, { color: colors.textMuted }]}>Camera</Text>
                </TouchableOpacity>
              </View>

              {/* Selfie */}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Selfie with Document *</Text>
              <Text style={[styles.inputHint, { color: colors.textMuted }]}>Hold your document next to your face</Text>
              <View style={styles.imageUploadRow}>
                <TouchableOpacity 
                  style={[styles.imageUploadBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => pickImage('selfieImage')}
                >
                  {kycData.selfieImage ? (
                    <Image source={{ uri: kycData.selfieImage }} style={styles.uploadedImage} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                      <Text style={[styles.uploadText, { color: colors.textMuted }]}>Gallery</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.imageUploadBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => takePhoto('selfieImage')}
                >
                  <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.uploadText, { color: colors.textMuted }]}>Camera</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: colors.accent }, isSubmitting && styles.submitBtnDisabled]} 
                onPress={handleSubmitKyc}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.submitBtnText, { color: '#fff' }]}>Submit for Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  
  profileCard: { alignItems: 'center', padding: 30, margin: 16, borderRadius: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#333' },
  avatarText: { color: '#000', fontSize: 28, fontWeight: 'bold' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  userName: { fontSize: 22, fontWeight: 'bold', marginTop: 16 },
  userEmail: { color: '#666', fontSize: 14, marginTop: 4 },
  
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8 },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoLabel: { color: '#666', fontSize: 14 },
  infoValue: { fontSize: 14 },
  
  actionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  
  inputLabel: { fontSize: 12, marginBottom: 8, marginTop: 16 },
  input: { borderRadius: 12, padding: 16, fontSize: 16 },
  
  submitBtn: { backgroundColor: '#22c55e', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  
  // KYC Section Styles
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mandatoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mandatoryText: { color: '#ef4444', fontSize: 11, fontWeight: '600' },
  
  kycCard: { borderRadius: 16, padding: 16, borderWidth: 2 },
  kycHeader: { flexDirection: 'row', alignItems: 'center' },
  kycIconContainer: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  kycInfo: { flex: 1, marginLeft: 14 },
  kycTitle: { fontSize: 16, fontWeight: '600' },
  kycStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  kycStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  kycStatusText: { fontSize: 13, fontWeight: '500' },
  
  kycWarning: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 12, gap: 8 },
  kycWarningText: { color: '#ef4444', fontSize: 12, flex: 1 },
  kycSuccess: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 12, gap: 8 },
  kycSuccessText: { color: '#22c55e', fontSize: 12, flex: 1 },
  kycPending: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 12, gap: 8 },
  kycPendingText: { color: '#eab308', fontSize: 12, flex: 1 },
  
  // KYC Modal Styles
  kycModalScroll: { flex: 1, marginTop: 60 },
  kycModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, minHeight: '100%' },
  kycModalSubtitle: { fontSize: 14, marginBottom: 8 },
  
  documentTypeRow: { flexDirection: 'row', gap: 8 },
  documentTypeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  documentTypeText: { fontSize: 12, fontWeight: '500' },
  
  imageUploadRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  imageUploadBtn: { flex: 1, height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  uploadedImage: { width: '100%', height: '100%', borderRadius: 12 },
  uploadText: { fontSize: 12, marginTop: 8 },
  inputHint: { fontSize: 11, marginBottom: 4 },
});

export default ProfileScreen;
