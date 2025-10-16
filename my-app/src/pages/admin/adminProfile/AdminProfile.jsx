import React, { useState, useEffect, useCallback } from "react";
import { auth } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Edit, Mail, Phone, X, Save, Upload, User } from "lucide-react";
import "./AdminProfile.css";
import BASE_URL from "../../../apiConfig";
import LoadingSpinner from "../../general/loadingspinner/LoadingSpinner";

// --- View Component ---
const AdminProfileView = ({ admin, onEditClick, imageVersion }) => (
	<article className="admin-profile-card">
		<header className="admin-profile-header">
			<div>
				<h1 className="admin-profile-title">Admin Profile</h1>
				<p className="admin-profile-subtitle">
					Manage your personal information
				</p>
			</div>
		</header>
		<figure className="admin-profile-figure">
			<img
				className="admin-profile-picture"
				src={
					admin.profilePic
						? `${admin.profilePic}?v=${imageVersion}`
						: "/default-avatar.png"
				}
				alt="Your profile picture"
			/>
		</figure>
		<section className="admin-profile-body">
			<h2 className="admin-profile-name">{admin.fullName}</h2>
			<p className="admin-profile-badge">Administrator</p>
			<address className="admin-profile-contact">
				<a
					href={`mailto:${admin.email}`}
					className="admin-profile-contact-item"
				>
					<Mail size={16} /> {admin.email}
				</a>
				<a
					href={`tel:${admin.phone}`}
					className="admin-profile-contact-item"
				>
					<Phone size={16} /> {admin.phone || "Not provided"}
				</a>
			</address>
		</section>
		<button className="admin-profile-btn-edit" onClick={onEditClick}>
			<Edit size={16} /> Edit Profile
		</button>
	</article>
);

// --- Edit Form Component ---
const AdminProfileForm = ({ admin, onCancel, onSave }) => {
	const [formData, setFormData] = useState({
		fullName: admin.fullName || "",
		phone: admin.phone || "",
		profilePic: null,
	});
	const [imagePreview, setImagePreview] = useState(admin.profilePic || null);
	const [isSaving, setIsSaving] = useState(false);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleFileChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			setFormData((prev) => ({ ...prev, profilePic: file }));
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		setIsSaving(true);
		onSave(formData).finally(() => setIsSaving(false));
	};

	return (
		<article className="admin-profile-card admin-profile-card--edit">
			<header className="admin-profile-header">
				<div>
					<h1 className="admin-profile-title">Edit Profile</h1>
					<p className="admin-profile-subtitle">
						Update your personal information
					</p>
				</div>
			</header>
			<form onSubmit={handleSubmit} className="admin-profile-form">
				<figure className="admin-profile-figure">
					<img
						className="admin-profile-picture"
						src={imagePreview || "/default-avatar.png"}
						alt="Profile preview"
					/>
					<label
						htmlFor="profile-pic-upload"
						className="admin-profile-upload-btn"
					>
						<Upload size={16} /> Change Picture
					</label>
					<input
						id="profile-pic-upload"
						type="file"
						accept="image/*"
						onChange={handleFileChange}
						className="sr-only"
					/>
				</figure>

				<div className="admin-profile-form-fields">
					<div className="admin-profile-form-group">
						<label htmlFor="fullName">Full Name</label>
						<input
							id="fullName"
							name="fullName"
							type="text"
							value={formData.fullName}
							onChange={handleChange}
							required
						/>
					</div>
					<div className="admin-profile-form-group">
						<label htmlFor="phone">Phone</label>
						<input
							id="phone"
							name="phone"
							type="tel"
							value={formData.phone}
							onChange={handleChange}
						/>
					</div>
				</div>
				<footer className="admin-profile-form-actions">
					<button
						type="button"
						className="admin-profile-btn-cancel"
						onClick={onCancel}
					>
						Close & Cancel
					</button>
					<button
						type="submit"
						className="admin-profile-btn-save"
						disabled={isSaving}
					>
						{isSaving ? (
							<LoadingSpinner variant="inline" size="sm" />
						) : (
							<Save size={16} />
						)}
						{isSaving ? "Saving..." : "Save Changes"}
					</button>
				</footer>
			</form>
		</article>
	);
};

// --- Main Profile Component ---
const AdminProfile = () => {
	const [admin, setAdmin] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [imageVersion, setImageVersion] = useState(Date.now());
	const [error, setError] = useState("");

	const fetchAdminProfile = useCallback(async () => {
		if (!auth.currentUser) return;
		setLoading(true);
		setError("");
		try {
			const token = await auth.currentUser.getIdToken();
			const res = await fetch(`${BASE_URL}/admin/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.status === 403)
				throw new Error("Access Forbidden: You are not an admin.");
			if (!res.ok) throw new Error("Failed to fetch admin profile");
			const data = await res.json();
			setAdmin(data);
			setImageVersion(Date.now()); // Force image refresh on new data
		} catch (err) {
			console.error(err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) {
				fetchAdminProfile();
			} else {
				setLoading(false);
				setError("You must be logged in to view this page.");
			}
		});
		return () => unsubscribe();
	}, [fetchAdminProfile]);

	const handleSave = async (formData) => {
		if (!auth.currentUser) {
			setError("Authentication expired. Please refresh.");
			return;
		}
		setError("");

		try {
			const token = await auth.currentUser.getIdToken();
			let profilePicBase64 = null;
			if (formData.profilePic) {
				profilePicBase64 = await new Promise((resolve, reject) => {
					const reader = new FileReader();
					reader.readAsDataURL(formData.profilePic);
					reader.onload = () => resolve(reader.result.split(",")[1]);
					reader.onerror = (error) => reject(error);
				});
			}

			const res = await fetch(`${BASE_URL}/admin/me`, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					fullName: formData.fullName,
					phone: formData.phone,
					profilePic: profilePicBase64, // Can be null
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || "Update failed");
			}

			setIsEditing(false);
			await fetchAdminProfile(); // Refetch data to show updates
		} catch (err) {
			console.error(err);
			setError(err.message);
			// Optionally, re-throw to keep isSaving=true in the form
			throw err;
		}
	};

	if (loading) {
		return <LoadingSpinner text="Loading your profile..." />;
	}

	if (error) {
		return <p className="admin-profile-error">{error}</p>;
	}

	if (!admin) {
		return <p id="no-profile-found">Admin profile not found.</p>;
	}

	return (
		<main className="admin-profile-container">
			{isEditing ? (
				<AdminProfileForm
					admin={admin}
					onCancel={() => setIsEditing(false)}
					onSave={handleSave}
				/>
			) : (
				<AdminProfileView
					admin={admin}
					onEditClick={() => setIsEditing(true)}
					imageVersion={imageVersion}
				/>
			)}
		</main>
	);
};

export default AdminProfile;
