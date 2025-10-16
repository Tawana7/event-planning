import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../../firebase";
import {
	Search,
	Edit,
	Phone,
	Mail,
	MapPin,
	Star,
	Calendar,
	DollarSign,
	Users,
	CheckCircle,
	XCircle,
	Clock,
} from "lucide-react";
import Popup from "../../general/popup/Popup.jsx";
import "./AdminVendorManagement.css";
import AdminVendorApplications from "./AdminVendorApplications.jsx";
import BASE_URL from "../../../apiConfig";
import LoadingSpinner from "../../general/loadingspinner/LoadingSpinner.jsx";

function AdminVendorManagement() {
	const navigate = useNavigate();
	const [vendors, setVendors] = useState([]);
	const [filteredVendors, setFilteredVendors] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	const [searchTerm, setSearchTerm] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	const [selectedVendor, setSelectedVendor] = useState(null);
	const [vendorServices, setVendorServices] = useState([]);
	const [vendorAnalytics, setVendorAnalytics] = useState(null);
	const [vendorBookings, setVendorBookings] = useState([]);

	const getToken = () =>
		auth.currentUser
			? auth.currentUser.getIdToken()
			: Promise.reject("Not logged in");

	// Fetch all vendors on component mount
	useEffect(() => {
		const fetchVendors = async () => {
			let user = auth.currentUser;
			while (!user) {
				await new Promise((res) => setTimeout(res, 50));
				user = auth.currentUser;
			}
			try {
				const token = await getToken();
				const response = await fetch(`${BASE_URL}/admin/vendors`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!response.ok) throw new Error("Failed to fetch vendors.");
				const data = await response.json();
				setVendors(data);
				setFilteredVendors(data);
			} catch (err) {
				setError(err.message);
			} finally {
				setIsLoading(false);
			}
		};
		fetchVendors();
	}, []);

	// Apply filters whenever vendors, searchTerm, or filters change
	useEffect(() => {
		let result = vendors;

		if (searchTerm) {
			result = result.filter(
				(v) =>
					v.businessName
						?.toLowerCase()
						.includes(searchTerm.toLowerCase()) ||
					v.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					v.category?.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		if (categoryFilter !== "all") {
			result = result.filter((v) => v.category === categoryFilter);
		}

		if (statusFilter !== "all") {
			result = result.filter((v) => v.status === statusFilter);
		}

		setFilteredVendors(result);
	}, [searchTerm, categoryFilter, statusFilter, vendors]);

	// Fetch vendor details when selected
	const fetchVendorDetails = async (vendorId) => {
		try {
			const token = await getToken();

			// Fetch services
			const servicesResponse = await fetch(
				`${BASE_URL}/vendors/${vendorId}/services`,
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			if (servicesResponse.ok) {
				const servicesData = await servicesResponse.json();
				setVendorServices(servicesData);
			}

			// Fetch analytics
			const analyticsResponse = await fetch(
				`${BASE_URL}/analytics/${vendorId}`,
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			if (analyticsResponse.ok) {
				const analyticsData = await analyticsResponse.json();
				setVendorAnalytics(analyticsData);
			}

			// Fetch bookings
			const bookingsResponse = await fetch(
				`${BASE_URL}/vendor/bookings`,
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			if (bookingsResponse.ok) {
				const bookingsData = await bookingsResponse.json();
				// Filter bookings for this specific vendor
				const vendorBookingsData =
					bookingsData.bookings?.filter(
						(booking) => booking.vendorId === vendorId
					) || [];
				setVendorBookings(vendorBookingsData);
			}
		} catch (err) {
			console.error("Error fetching vendor details:", err);
		}
	};

	const handleViewDetails = async (vendor) => {
		setSelectedVendor(vendor);
		await fetchVendorDetails(vendor.id);
		setIsPopupOpen(true);
	};

	const handleStatusUpdate = async (vendorId, newStatus) => {
		try {
			const token = await getToken();
			const response = await fetch(
				`${BASE_URL}/admin/vendor-applications/${vendorId}`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: newStatus }),
				}
			);

			if (response.ok) {
				// Update local state
				setVendors((prev) =>
					prev.map((v) =>
						v.id === vendorId ? { ...v, status: newStatus } : v
					)
				);
				setSelectedVendor((prev) =>
					prev ? { ...prev, status: newStatus } : null
				);
				alert(`Vendor status updated to ${newStatus}`);
			} else {
				throw new Error("Failed to update status");
			}
		} catch (err) {
			console.error("Error updating vendor status:", err);
			alert("Error updating vendor status");
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return "Not set";
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const formatCurrency = (amount) => {
		if (!amount) return "$0";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	const getStatusIcon = (status) => {
		switch (status) {
			case "approved":
				return <CheckCircle size={16} />;
			case "rejected":
				return <XCircle size={16} />;
			case "pending":
				return <Clock size={16} />;
			default:
				return <Clock size={16} />;
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case "approved":
				return "#10b981";
			case "rejected":
				return "#ef4444";
			case "pending":
				return "#f59e0b";
			default:
				return "#6b7280";
		}
	};

	const uniqueCategories = [
		"all",
		...new Set(vendors.map((v) => v.category).filter(Boolean)),
	];

	if (isLoading)
		return (
			<main className="admin-vendor-management-container">
				<LoadingSpinner text="Loading vendors..." />
			</main>
		);

	if (error)
		return (
			<main className="admin-vendor-management-container">
				<h3>Error: {error}</h3>
			</main>
		);

	return (
		<section className="admin-vendor-management-container">
			<header className="admin-vendor-management-header">
				<h1>Vendor Management</h1>
				<p className="admin-vendor-management-subtitle">
					Manage vendor applications and approved vendors
				</p>
			</header>

			<section className="admin-vendor-management-section">
				<h2 className="admin-vendor-management-heading">
					Pending Applications
				</h2>
				<AdminVendorApplications />
			</section>

			<section className="admin-vendor-management-section">
				<h2 className="admin-vendor-management-heading">
					Vendor Directory ({filteredVendors.length})
				</h2>

				<section className="admin-vendor-management-filters">
					<div className="admin-vendor-management-search">
						<Search size={20} />
						<input
							type="text"
							placeholder="Search by business name, email, or category..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<select
						className="admin-vendor-management-dropdown"
						value={categoryFilter}
						onChange={(e) => setCategoryFilter(e.target.value)}
					>
						<option value="all">All Categories</option>
						{uniqueCategories
							.filter((cat) => cat !== "all")
							.map((cat) => (
								<option key={cat} value={cat}>
									{cat}
								</option>
							))}
					</select>
				</section>

				<section className="admin-vendor-management-grid">
					{filteredVendors.length > 0 ? (
						filteredVendors.map((vendor) => (
							<article
								key={vendor.id}
								className="admin-vendor-management-card"
							>
								<figure className="admin-vendor-management-card-image">
									<img
										src={
											vendor.profilePic ||
											"/default-avatar.png"
										}
										alt={vendor.businessName}
										onError={(e) => {
											e.target.src =
												"/default-avatar.png";
										}}
									/>
								</figure>
								<section className="admin-vendor-management-card-info">
									<h4>
										{vendor.businessName ||
											"Unnamed Business"}
									</h4>
									<div
										className="admin-vendor-management-status"
										style={{
											backgroundColor: getStatusColor(
												vendor.status
											),
										}}
									>
										{getStatusIcon(vendor.status)}
										<span>
											{vendor.status || "pending"}
										</span>
									</div>
									<p className="admin-vendor-management-category">
										{vendor.category || "Uncategorized"}
									</p>
									<div className="admin-vendor-management-card-stats">
										<div className="admin-vendor-management-stat">
											<Star size={14} />
											<span>
												{vendorAnalytics?.averageRating?.toFixed(
													1
												) || "N/A"}
											</span>
										</div>
										<div className="admin-vendor-management-stat">
											<Users size={14} />
											<span>
												{vendorAnalytics?.totalReviews ||
													0}
											</span>
										</div>
									</div>
								</section>
								<button
									className="admin-vendor-management-view-btn"
									onClick={() => handleViewDetails(vendor)}
								>
									View Details
								</button>
							</article>
						))
					) : (
						<p className="admin-vendor-management-empty">
							No vendors found matching your criteria.
						</p>
					)}
				</section>
			</section>

			<Popup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)}>
				{selectedVendor && (
					<section className="admin-vendor-management-popup">
						<header className="admin-vendor-management-popup-header">
							<img
								src={
									selectedVendor.profilePic ||
									"/default-avatar.png"
								}
								alt={selectedVendor.businessName}
								className="admin-vendor-management-popup-img"
								onError={(e) => {
									e.target.src = "/default-avatar.png";
								}}
							/>
							<h2>{selectedVendor.businessName}</h2>
							<div className="admin-vendor-management-popup-meta">
								<p className="admin-vendor-management-popup-category">
									{selectedVendor.category}
								</p>
								<div
									className="admin-vendor-management-popup-status"
									style={{
										backgroundColor: getStatusColor(
											selectedVendor.status
										),
									}}
								>
									{getStatusIcon(selectedVendor.status)}
									<span>{selectedVendor.status}</span>
								</div>
							</div>
						</header>

						<section className="admin-vendor-management-popup-body">
							<p className="admin-vendor-management-description">
								{selectedVendor.description ||
									"No description provided."}
							</p>

							<section className="admin-vendor-management-contact">
								<h4>Contact Information</h4>
								<p>
									<Mail size={16} />
									<strong>Email:</strong>{" "}
									{selectedVendor.email}
								</p>
								<p>
									<Phone size={16} />
									<strong>Phone:</strong>{" "}
									{selectedVendor.phone || "Not provided"}
								</p>
								<p>
									<MapPin size={16} />
									<strong>Address:</strong>{" "}
									{selectedVendor.address || "Not provided"}
								</p>
							</section>

							{/* Analytics Section */}
							{vendorAnalytics && (
								<section className="admin-vendor-management-analytics">
									<h4>Performance Analytics</h4>
									<div className="admin-vendor-management-stats-grid">
										<div className="admin-vendor-management-stat-card">
											<Star size={20} />
											<span className="admin-vendor-management-stat-value">
												{vendorAnalytics.averageRating?.toFixed(
													1
												) || "N/A"}
											</span>
											<span className="admin-vendor-management-stat-label">
												Average Rating
											</span>
										</div>
										<div className="admin-vendor-management-stat-card">
											<Users size={20} />
											<span className="admin-vendor-management-stat-value">
												{vendorAnalytics.totalReviews ||
													0}
											</span>
											<span className="admin-vendor-management-stat-label">
												Total Reviews
											</span>
										</div>
										<div className="admin-vendor-management-stat-card">
											<Calendar size={20} />
											<span className="admin-vendor-management-stat-value">
												{vendorBookings.length}
											</span>
											<span className="admin-vendor-management-stat-label">
												Total Bookings
											</span>
										</div>
									</div>
								</section>
							)}

							{/* Services Section */}
							{vendorServices.length > 0 && (
								<section className="admin-vendor-management-services">
									<h4>
										Services Offered (
										{vendorServices.length})
									</h4>
									<div className="admin-vendor-management-services-list">
										{vendorServices.map((service) => (
											<div
												key={service.id}
												className="admin-vendor-management-service-item"
											>
												<h5>{service.serviceName}</h5>
												<div className="admin-vendor-management-service-pricing">
													{service.cost > 0 && (
														<span>
															Base:{" "}
															{formatCurrency(
																service.cost
															)}
														</span>
													)}
													{service.chargeByHour >
														0 && (
														<span>
															Hourly:{" "}
															{formatCurrency(
																service.chargeByHour
															)}
															/hr
														</span>
													)}
													{service.chargePerPerson >
														0 && (
														<span>
															Per Person:{" "}
															{formatCurrency(
																service.chargePerPerson
															)}
														</span>
													)}
												</div>
												{service.extraNotes && (
													<p className="admin-vendor-management-service-notes">
														{service.extraNotes}
													</p>
												)}
											</div>
										))}
									</div>
								</section>
							)}

							{/* Recent Bookings */}
							{vendorBookings.length > 0 && (
								<section className="admin-vendor-management-bookings">
									<h4>
										Recent Bookings ({vendorBookings.length}
										)
									</h4>
									<div className="admin-vendor-management-bookings-list">
										{vendorBookings
											.slice(0, 5)
											.map((booking, index) => (
												<div
													key={index}
													className="admin-vendor-management-booking-item"
												>
													<h5>{booking.eventName}</h5>
													<div className="admin-vendor-management-booking-details">
														<span>
															{formatDate(
																booking.date
															)}
														</span>
														<span>
															{booking.location}
														</span>
														<span>
															{
																booking.expectedGuestCount
															}{" "}
															guests
														</span>
													</div>
												</div>
											))}
									</div>
								</section>
							)}
						</section>

						<footer className="admin-vendor-management-popup-footer">
							<div className="admin-vendor-management-actions">
								{selectedVendor.status === "pending" && (
									<>
										<button
											className="admin-vendor-management-action-btn admin-vendor-management-approve"
											onClick={() =>
												handleStatusUpdate(
													selectedVendor.id,
													"approved"
												)
											}
										>
											<CheckCircle size={16} />
											Approve Vendor
										</button>
										<button
											className="admin-vendor-management-action-btn admin-vendor-management-reject"
											onClick={() =>
												handleStatusUpdate(
													selectedVendor.id,
													"rejected"
												)
											}
										>
											<XCircle size={16} />
											Reject Vendor
										</button>
									</>
								)}
								<button className="admin-vendor-management-edit-btn">
									<Edit size={16} />
									Edit Vendor
								</button>
							</div>
						</footer>
					</section>
				)}
			</Popup>
		</section>
	);
}

export default AdminVendorManagement;
