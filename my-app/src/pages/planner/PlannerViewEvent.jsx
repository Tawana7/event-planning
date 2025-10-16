import { useRef, useEffect, useState } from "react";
import "./PlannerViewEvent.css";
import { getAuth } from "firebase/auth";
import Papa from "papaparse";
import ChatComponent from "./ChatComponent.jsx";
import Popup from "../general/popup/Popup.jsx";
import LocationPicker from "./LocationPicker";
import PlannerVendorMarketplace from "./PlannerVendorMarketplace.jsx";
import PlannerTasks from "./PlannerTasks.jsx";
import { format } from "date-fns";
import BronzeFury from "./BronzeFury.jsx";
import BASE_URL from "../../apiConfig";
import PlannerSchedules from "./PlannerSchedules.jsx";

//Code for the pop up when manually adding a guest **********
function AddGuestPopup({ isOpen, onClose, onSave }) {
	const guestTags = [
		"VIP",
		"Family",
		"Friend",
		"Colleague",
		"Plus One",
		"Speaker",
		"Sponsor",
		"Media",
		"Performer",
		"Staff",
	];

	const dietaryOptions = [
		"None",
		"Vegetarian",
		"Vegan",
		"Gluten-Free",
		"Nut-Free",
		"Dairy-Free",
		"Halal",
		"Kosher",
	];

	const [selectedTags, setSelectedTags] = useState([]);
	const [dietary, setDietary] = useState("None");

	const [guestForm, setGuestForm] = useState({
		firstname: "",
		lastname: "",
		email: "",
		plusOne: 0,
	});

	const handleTagToggle = (tag) => {
		setSelectedTags((prev) => {
			const updatedTags = prev.includes(tag)
				? prev.filter((t) => t !== tag)
				: [...prev, tag];

			setGuestForm({ ...guestForm, tags: updatedTags });

			console.log(updatedTags);
			return updatedTags;
		});
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (guestForm.firstname.trim() && guestForm.email.trim()) {
			onSave({
				...guestForm,
				rsvpStatus: "pending",
			});
			setGuestForm({
				firstname: "",
				lastname: "",
				email: "",
				plusOne: 0,
			});
			onClose();
		}
	};

	const handleClose = () => {
		setGuestForm({
			firstname: "",
			lastname: "",
			email: "",
			plusOne: 0,
		});
		onClose();
	};

	if (!isOpen) return null;

	return (
		<Popup isOpen={isOpen} onClose={handleClose}>
			<section
				className="guest-popup-content"
				onClick={(e) => e.stopPropagation()}
			>
				<section className="guest-popup-header">
					<h3>Add Guest</h3>
					<button className="close-btn" onClick={handleClose}>
						Close
					</button>
				</section>
				<section onSubmit={handleSubmit} className="guest-form">
					<section className="form-row">
						<label>
							First Name *
							<input
								type="text"
								value={guestForm.firstname}
								onChange={(e) =>
									setGuestForm({
										...guestForm,
										firstname: e.target.value,
									})
								}
								required
								autoFocus
							/>
						</label>
						<label>
							Last Name
							<input
								type="text"
								value={guestForm.lastname}
								onChange={(e) =>
									setGuestForm({
										...guestForm,
										lastname: e.target.value,
									})
								}
							/>
						</label>
					</section>
					<label>
						Email Address *
						<input
							type="email"
							value={guestForm.email}
							onChange={(e) =>
								setGuestForm({
									...guestForm,
									email: e.target.value,
								})
							}
							required
						/>
					</label>
					<label>
						Phone
						<input
							type="text"
							checked={guestForm.plusOne}
							onChange={(e) =>
								setGuestForm({
									...guestForm,
									plusOne: e.target.value,
								})
							}
						/>
					</label>

					<section className="form-group">
						<label>Dietary Requirement:</label>
						<select
							value={dietary}
							onChange={(e) =>
								setGuestForm({
									...guestForm,
									dietary: e.target.value,
								})
							}
						>
							{dietaryOptions.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</section>

					<section className="form-group">
						<label>Guest Tags:</label>
						<section className="checkbox-group">
							{guestTags.map((tag) => (
								<label key={tag} className="checkbox-label">
									<input
										type="checkbox"
										checked={selectedTags.includes(tag)}
										onChange={() => handleTagToggle(tag)}
									/>
									{tag}
								</label>
							))}
						</section>
					</section>

					<label>
						Notes
						<input
							type="text"
							checked={guestForm.plusOne}
							onChange={(e) =>
								setGuestForm({
									...guestForm,
									plusOne: e.target.value,
								})
							}
						/>
					</label>
					<label className="plusones-label">
						Number of Plus Ones
						<input
							type="number"
							checked={guestForm.plusOne}
							onChange={(e) =>
								setGuestForm({
									...guestForm,
									plusOne: e.target.value,
								})
							}
						/>
					</label>
					<section className="form-actions">
						<button
							type="button"
							className="cancel-form-btn"
							onClick={handleClose}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="save-form-btn"
							onClick={handleSubmit}
						>
							Add Guest
						</button>
					</section>
				</section>
			</section>
		</Popup>
	);
}
//End of code for the pop up when manually adding a guest **********

//Code for Guest RSVP Summary Bar **********
function GuestRSVPSummary({ guests }) {
	const totalGuests = guests.length;
	const confirmedGuests = guests.filter(
		(g) => g.rsvpStatus === "accepted"
	).length;
	const pendingGuests = guests.filter(
		(g) => g.rsvpStatus === "pending"
	).length;
	const declinedGuests = guests.filter(
		(g) => g.rsvpStatus === "declined"
	).length;

	return (
		<section className="rsvp-summary">
			<h4>RSVP Status</h4>
			<section className="rsvp-stats">
				<section className="rsvp-stat confirmed">
					<span data-testid="confirmed-count" className="rsvp-number">
						{confirmedGuests}
					</span>
					<span className="rsvp-label">Confirmed</span>
				</section>
				<section className="rsvp-stat pending">
					<span data-testid="pending-count" className="rsvp-number">
						{pendingGuests}
					</span>
					<span className="rsvp-label">Pending</span>
				</section>
				<section className="rsvp-stat declined">
					<span data-testid="declined-count" className="rsvp-number">
						{declinedGuests}
					</span>
					<span className="rsvp-label">Declined</span>
				</section>
			</section>
			<section className="rsvp-progress">
				<section
					className="rsvp-progress-bar"
					style={{
						width: `${
							totalGuests > 0
								? (confirmedGuests / totalGuests) * 100
								: 0
						}%`,
					}}
				></section>
			</section>
			<p className="rsvp-percentage">
				{totalGuests > 0
					? Math.round((confirmedGuests / totalGuests) * 100)
					: 0}
				% confirmed
			</p>
		</section>
	);
}
//End of code for guest RSVP summary bar *********

//Code for one vendor list item **********
function ServiceItem({ service, showChat }) {
	return (
		<section className="vendor-item">
			<section className="vendor-info">
				<h4>{service.serviceName}</h4>
				<p>Vendored By: {service.vendorName}</p>
			</section>
			{service.status === "confirmed" ? (
				<section className="vendor-cost">
					<h4>Confirmed Total Cost: </h4>
					<p>R {service.finalPrice}</p>
				</section>
			) : (
				<section className="vendor-cost">
					<h4>Estimated Total Cost: </h4>
					<p>R {service.estimatedCost}</p>
				</section>
			)}

			<section className="serviceitem-footer">
				<section className="vendor-actions">
					<button className="contact-btn">Contract</button>
					<button
						onClick={() => showChat(service)}
						className="remove-btn"
					>
						Chat
					</button>
					<button className="remove-btn">Remove</button>
				</section>
				<section
					className={
						service.status === "confirmed"
							? "serviceitem-status confirmed"
							: "serviceitem-status pending"
					}
				>
					${service.status}
				</section>
			</section>
		</section>
	);
}
//End of code for one vendor list item **********

//Code for prompt card (No Guests, No vendors, No tasks) (Or Guest Summary, Vendor Summary)
function PromptCard({ title, message, buttonText, onClick }) {
	return (
		<section className="prompt-card">
			<section className="prompt-content">
				<h4>{title}</h4>
				<p>{message}</p>
				<button className="prompt-btn" onClick={onClick}>
					{buttonText}
				</button>
			</section>
		</section>
	);
}
//End of code for prompt card

//Code for importing a guest list
function GuestImportWithValidation({ eventId, onImportComplete, onClose }) {
	const [preview, setPreview] = useState([]);
	const [errors, setErrors] = useState([]);
	const fileInputRef = useRef(null);

	// Trigger the hidden file input
	const handleButtonClick = () => fileInputRef.current.click();

	const validateGuests = (guests) => {
		const validationErrors = [];
		const validGuests = [];

		guests.forEach((guest, index) => {
			const rowErrors = [];

			if (!guest.email) rowErrors.push("Email required");
			else if (!/\S+@\S+\.\S+/.test(guest.email))
				rowErrors.push("Invalid email");

			if (!guest.firstname) rowErrors.push("First name required");

			if (rowErrors.length > 0) {
				validationErrors.push({ row: index + 1, errors: rowErrors });
			} else {
				validGuests.push(guest);
			}
		});

		setErrors(validationErrors);
		return validGuests;
	};

	const processFile = (event) => {
		const file = event.target.files[0];
		if (!file) return;

		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) =>
				header.trim().toLowerCase().replace(/\s+/g, ""),
			complete: (results) => {
				const validGuests = validateGuests(results.data);
				setPreview(validGuests);
			},
		});
	};

	const importGuests = async (guestData) => {
		const auth = getAuth();
		const token = await auth.currentUser.getIdToken();

		const response = await fetch(
			`${BASE_URL}/planner/events/${eventId}/guests/import`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ guests: guestData }),
			}
		);

		if (!response.ok) throw new Error("Import failed");
		onImportComplete();
	};

	return (
		<section className="guest-import-overlay">
			<section className="guest-import-modal">
				<header className="guest-import-header">
					<h2>Import Guests from CSV</h2>
					<button className="close-btn" onClick={onClose}>
						x
					</button>
				</header>

				<section className="guest-import-body">
					<button
						className="guest-import-select-btn"
						onClick={handleButtonClick}
					>
						Select CSV File
					</button>
					<input
						type="file"
						accept=".csv,.xlsx"
						ref={fileInputRef}
						className="guest-import-file-input"
						onChange={processFile}
					/>

					{errors.length > 0 && (
						<section className="guest-import-errors">
							<h4>Validation Errors:</h4>
							{errors.map((error) => (
								<p key={error.row}>
									Row {error.row}: {error.errors.join(", ")}
								</p>
							))}
						</section>
					)}

					{preview.length > 0 && (
						<section className="guest-import-preview">
							<h4>Preview ({preview.length} guests)</h4>
							<table className="guest-import-table">
								<thead>
									<tr>
										<th>First Name</th>
										<th>Last Name</th>
										<th>Email</th>
									</tr>
								</thead>
								<tbody>
									{preview.slice(0, 5).map((guest, i) => (
										<tr key={i}>
											<td>{guest.firstname}</td>
											<td>{guest.lastname}</td>
											<td>{guest.email}</td>
										</tr>
									))}
								</tbody>
							</table>
							<button
								className="guest-import-confirm-btn"
								onClick={() => importGuests(preview)}
							>
								Import {preview.length} Guests
							</button>
						</section>
					)}
				</section>
			</section>
		</section>
	);
}

//End of code for importing a guest list

// Vendor Popup Component
function VendorPopup({ isOpen, onClose }) {
	if (!isOpen) return null;

	return (
		<Popup isOpen={isOpen} onClose={onClose}>
			<PlannerVendorMarketplace
				onClose={onClose}
				// Add any other props your PlannerVendorMarketplace needs
			/>
		</Popup>
	);
}

export default function PlannerViewEvent({ event, setActivePage }) {
	if (!event) {
		return <section>Loading Event...</section>;
	}

	const [isEditing, setIsEditing] = useState(false);
	const [activeTab, setActiveTab] = useState("overview");
	const [guests, setGuests] = useState([]);
	const [vendors, setVendors] = useState([]);
	const [eventData, setEventData] = useState(event);
	const [showAddGuestPopup, setShowAddGuestPopup] = useState(false);
	const [showImportGuestPopup, setShowImportGuestPopup] = useState(false);
	const [showBronzeFuryPopup, setShowBronzeFuryPopup] = useState(false);
	const [showChat, setShowChat] = useState(false);
	const [chatVendorId, setChatVendorId] = useState(null);
	const [serviceType, setServiceType] = useState(null);
	const [chatService, setChatService] = useState(null);
	const [plannerId, setPlannerID] = useState(null);
	const [services, setServices] = useState([]);

	// ADDED THE MISSING STATE VARIABLE
	const [showVendorPopup, setShowVendorPopup] = useState(false);

	const [editForm, setEditForm] = useState({ ...eventData });

	// NEW: Location state
	const [locationData, setLocationData] = useState({
		coordinates: null,
		address: "",
	});

	const eventId = event.id;

	const fetchGuests = async () => {
		try {
			const auth = getAuth();
			const user = auth.currentUser;
			const token = await user.getIdToken(true);

			const res = await fetch(`${BASE_URL}/planner/${eventId}/guests`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			if (!res.ok) throw new Error("Failed to fetch guests");

			const data = await res.json();
			return data.guests || [];
		} catch (err) {
			console.error(err);
			alert("Unable to fetch guests");
			return [];
		}
	};

	const fetchVendors = async () => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/planner/${eventId}/vendors`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});
		if (!res.ok) return [];

		const data = await res.json();
		return data.vendors || [];
	};

	const updateEventData = async () => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/planner/me/${eventId}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(eventData),
		});
		if (!res.ok) console.log("Update Failed");
		console.log("Updated Event.");
	};

	const sendReminder = async (guestId, eventId) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(
			`${BASE_URL}/planner/${eventId}/${guestId}/sendReminder`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!res.ok) {
			alert("Unable to send reminder");
			console.log("Unable to send reminder");
		} else {
			alert("Reminder sent successfully");
		}
	};

	const fetchServices = async () => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		try {
			const res = await fetch(`${BASE_URL}/planner/${eventId}/services`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!res.ok) return [];

			const data = await res.json();
			console.log("Data: ", data);
			return data.services;
		} catch (err) {
			console.error("Failed to fetch services");
		}
	};

	const loadGuests = async () => {
		const guests = await fetchGuests();
		setGuests(guests);
	};

	useEffect(() => {
		loadGuests();
	}, []);

	const loadVendors = async () => {
		const vendors = await fetchVendors();
		setVendors(vendors);
	};

	useEffect(() => {
		loadVendors();
	}, []);

	const loadServices = async () => {
		const fetchedServices = await fetchServices();
		setServices(fetchedServices);
		console.log(fetchedServices);
	};

	// run it once on mount
	useEffect(() => {
		loadServices();
	}, []);

	useEffect(() => {
		if (showAddGuestPopup === true) {
		}
	}, [showAddGuestPopup]);

	useEffect(() => {
		console.log("eventData updated:", eventData);
		updateEventData();
	}, [eventData]);

	// NEW: Initialize location data from event
	useEffect(() => {
		if (eventData && eventData.locationCoordinates) {
			// Handle both GeoPoint and plain object formats
			const coords = eventData.locationCoordinates._latitude
				? {
						lat: eventData.locationCoordinates._latitude,
						lng: eventData.locationCoordinates._longitude,
				  }
				: eventData.locationCoordinates;

			setLocationData({
				coordinates: coords,
				address: eventData.location || "",
			});
		}
	}, [eventData]);

	// NEW: Handler for location changes during editing
	const handleLocationChange = (data) => {
		setLocationData(data);
		setEditForm((prev) => ({
			...prev,
			location: data.address,
			locationCoordinates: data.coordinates,
		}));
	};

	// UPDATED: handleSave with conflict checking
	const handleSave = async () => {
		try {
			const auth = getAuth();
			const token = await auth.currentUser.getIdToken(true);

			// Prepare update data with location coordinates
			const updateData = {
				...editForm,
				locationCoordinates: locationData.coordinates,
			};

			const res = await fetch(`${BASE_URL}/planner/me/${eventId}`, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updateData),
			});

			const data = await res.json();

			if (!res.ok) {
				if (res.status === 409) {
					// Location conflict detected
					const conflictMsg = `Location Conflict Detected!\n\n${
						data.message
					}\n\nConflicting Event: ${
						data.conflictingEvent?.name
					}\nDate: ${new Date(
						data.conflictingEvent?.date
					).toLocaleString()}\nLocation: ${
						data.conflictingEvent?.location
					}`;
					alert(conflictMsg);
					return;
				}
				throw new Error(data.message || "Failed to update event");
			}

			// Update local state with new data including coordinates
			setEventData({
				...editForm,
				locationCoordinates: locationData.coordinates,
			});
			setIsEditing(false);
			alert("Event updated successfully!");
		} catch (err) {
			console.error("Error saving event:", err);
			alert(`Error updating event: ${err.message}`);
		}
	};

	const handleCancel = () => {
		setEditForm({ ...eventData });
		// Reset location data to original
		if (eventData.locationCoordinates) {
			const coords = eventData.locationCoordinates._latitude
				? {
						lat: eventData.locationCoordinates._latitude,
						lng: eventData.locationCoordinates._longitude,
				  }
				: eventData.locationCoordinates;

			setLocationData({
				coordinates: coords,
				address: eventData.location || "",
			});
		}
		setIsEditing(false);
	};

	function formatDate(date) {
		if (!date) return "";

		if (
			typeof date === "object" &&
			typeof date._seconds === "number" &&
			typeof date._nanoseconds === "number"
		) {
			const jsDate = new Date(
				date._seconds * 1000 + date._nanoseconds / 1e6
			);
			return jsDate.toLocaleString();
		}

		// Already a JS Date
		if (date instanceof Date) {
			return date.toLocaleString();
		}

		// String
		if (typeof date === "string") {
			return new Date(date).toLocaleString();
		}

		return String(date); // fallback
	}

	const onSave = async (guestInfo) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/planner/me/${eventId}/guests`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(guestInfo),
		});
		if (!res.ok) return "Guest Creation Failed";
		console.log("Guest creation done.");
		await loadGuests();
	};

	const onShowChat = async (service) => {
		//Data fetching will go here
		setChatService(service);
		setShowChat(true);
	};

	const onCloseChat = async () => {
		//Clearing of variables will go here
		setChatService(null);
		setShowChat(false);
	};

	return (
		<section className="event-view-edit">
			{showChat && (
				<ChatComponent
					plannerId={event.plannerId}
					vendorId={chatService.vendorId}
					eventId={event.id}
					closeChat={onCloseChat}
					currentUser={{
						id: event.plannerId,
						name: event.name,
						type: "planner",
					}}
					otherUser={{
						id: chatService.vendorId,
						name: chatService.vendorName,
						type: "vendor",
					}}
					serviceType={chatService.serviceName}
				/>
			)}
			<section className="event-header">
				<section className="header-top">
					<section className="header-actions">
						{!isEditing ? (
							<button
								className="edit-btn"
								onClick={() => setIsEditing(true)}
							>
								Edit Event
							</button>
						) : (
							<section className="edit-actions">
								<button
									className="save-btn"
									onClick={handleSave}
								>
									Save Changes
								</button>
								<button
									className="cancel-btn"
									onClick={handleCancel}
								>
									Cancel
								</button>
							</section>
						)}
					</section>
				</section>

				<section className="header-main">
					{!isEditing ? (
						<section className="event-title-info">
							<h1>{eventData.name}</h1>
						</section>
					) : (
						<section className="edit-title-section">
							<input
								type="text"
								value={editForm.name}
								onChange={(e) =>
									setEditForm({
										...editForm,
										name: e.target.value,
									})
								}
								className="edit-title-input"
								placeholder="Event name"
							/>
						</section>
					)}
				</section>
			</section>

			<section className="tabs-container">
				<section className="tabs">
					<button
						className={`tab-btn ${
							activeTab === "overview" ? "active" : ""
						}`}
						onClick={() => setActiveTab("overview")}
					>
						Overview
					</button>
					<button
						className={`tab-btn ${
							activeTab === "guests" ? "active" : ""
						}`}
						onClick={() => setActiveTab("guests")}
					>
						Guests & RSVP
					</button>
					<button
						className={`tab-btn ${
							activeTab === "vendors" ? "active" : ""
						}`}
						onClick={() => setActiveTab("vendors")}
					>
						Services
					</button>
					<button
						className={`tab-btn ${
							activeTab === "tasks" ? "active" : ""
						}`}
						onClick={() => setActiveTab("tasks")}
					>
						My To-Do List
					</button>
					<button
						className={`tab-btn ${
							activeTab === "schedule" ? "active" : ""
						}`}
						onClick={() => setActiveTab("schedule")}
					>
						Schedule
					</button>
				</section>

				<section className="tab-content">
					{activeTab === "overview" && (
						<section className="overview-content">
							<section className="overview-grid">
								{/* Basic Event Details */}
								<section className="detail-card">
									<h3>Event Details</h3>
									{!isEditing ? (
										<section className="detail-info">
											<p>
												<strong>Location:</strong>{" "}
												{eventData.location}
											</p>
											<p>
												<strong>Date:</strong>{" "}
												{formatDate(eventData.date)}
											</p>
											<p>
												<strong>Duration:</strong>{" "}
												{eventData.duration} hrs
											</p>
											<p>
												<strong>
													Expected Attendees:
												</strong>{" "}
												{eventData.expectedGuestCount}
											</p>
											<p>
												<strong>Category:</strong>{" "}
												{eventData.eventCategory}
											</p>
										</section>
									) : (
										<section className="edit-form">
											<label>
												Location:
												<LocationPicker
													initialLocation={
														locationData.coordinates
													}
													initialAddress={
														locationData.address
													}
													onLocationChange={
														handleLocationChange
													}
												/>
												<small
													style={{
														display: "block",
														marginTop: "5px",
														color: "#666",
														fontSize: "12px",
													}}
												>
													Note: Changing location or
													time may conflict with other
													events at the same venue
												</small>
											</label>
											<label>
												Date:
												<input
													type="datetime-local"
													value={editForm.date}
													onChange={(e) =>
														setEditForm({
															...editForm,
															date: e.target
																.value,
														})
													}
												/>
											</label>
											<label>
												Duration:
												<input
													type="number"
													value={editForm.duration}
													onChange={(e) =>
														setEditForm({
															...editForm,
															duration:
																e.target.value,
														})
													}
												/>
											</label>
											<label>
												Expected Attendees:
												<input
													type="number"
													value={
														editForm.expectedGuestCount
													}
													onChange={(e) =>
														setEditForm({
															...editForm,
															expectedGuestCount:
																parseInt(
																	e.target
																		.value
																),
														})
													}
												/>
											</label>
											<label>
												Category:
												<input
													type="text"
													value={
														editForm.eventCategory
													}
													onChange={(e) =>
														setEditForm({
															...editForm,
															eventCategory:
																e.target.value,
														})
													}
												/>
											</label>
										</section>
									)}
								</section>

								{/* Additional Event Details */}
								<section className="detail-card">
									<h3>Event Specifications</h3>
									{!isEditing ? (
										<section className="detail-info">
											<p>
												<strong>Style:</strong>{" "}
												{eventData.eventStyle ||
													"Not specified"}
											</p>
											<p>
												<strong>Budget:</strong>{" "}
												{eventData.budget
													? `$${eventData.budget}`
													: "Not set"}
											</p>
											<p>
												<strong>
													Special Requirements:
												</strong>{" "}
												{eventData.specialRequirements ||
													"None"}
											</p>
											<p>
												<strong>Notes:</strong>{" "}
												{eventData.notes ||
													"No additional notes"}
											</p>
										</section>
									) : (
										<section className="edit-form">
											<label>
												Style:
												<input
													type="text"
													value={
														editForm.eventStyle ||
														""
													}
													onChange={(e) =>
														setEditForm({
															...editForm,
															eventStyle:
																e.target.value,
														})
													}
													placeholder="e.g., Formal, Casual, Modern, Rustic"
												/>
											</label>
											<label>
												Budget:
												<input
													type="number"
													value={
														editForm.budget || ""
													}
													onChange={(e) =>
														setEditForm({
															...editForm,
															budget: e.target
																.value,
														})
													}
													placeholder="Total budget amount"
												/>
											</label>
											<label>
												Special Requirements:
												<textarea
													value={
														editForm.specialRequirements ||
														""
													}
													onChange={(e) =>
														setEditForm({
															...editForm,
															specialRequirements:
																e.target.value,
														})
													}
													placeholder="Accessibility needs, dietary restrictions, equipment requirements..."
													rows="3"
												/>
											</label>
											<label>
												Notes:
												<textarea
													value={editForm.notes || ""}
													onChange={(e) =>
														setEditForm({
															...editForm,
															notes: e.target
																.value,
														})
													}
													placeholder="Additional notes, ideas, or reminders..."
													rows="3"
												/>
											</label>
										</section>
									)}
								</section>

								{/* Action Prompts */}
								<section className="action-prompts">
									{guests.length === 0 && (
										<PromptCard
											title="No Guests Yet"
											message="Your event doesn't have any guests yet. Start building your guest list to manage RSVPs and attendance."
											buttonText="Add Guests"
											onClick={() => {
												setShowImportGuestPopup(true);
												setActiveTab("guests");
											}}
										/>
									)}

									{vendors.length === 0 && (
										<PromptCard
											title="No Vendors Yet"
											message="Your event doesn't have any vendors yet. Add vendors to manage services, catering, and suppliers."
											buttonText="Add Vendors"
											onClick={() =>
												setActiveTab("vendors")
											}
										/>
									)}

									{(!eventData.tasks ||
										Object.keys(eventData.tasks).length ===
											0) && (
										<PromptCard
											title="No To-Do List Yet"
											message="Create a task on your To-Do list to stay organized and track your event planning progress."
											buttonText="Add To-Do List Task"
											onClick={() =>
												setActiveTab("tasks")
											}
										/>
									)}
								</section>

								{/* Event Summary Cards */}
								{(guests.length > 0 || vendors.length > 0) && (
									<section className="summary-cards">
										{guests.length > 0 && (
											<section className="summary-card">
												<h4>Guest Summary</h4>
												<p>
													{guests.length} total guests
												</p>
												<p>
													{
														guests.filter(
															(g) =>
																g.rsvpStatus ===
																"attending"
														).length
													}{" "}
													confirmed
												</p>
											</section>
										)}

										{vendors.length > 0 && (
											<section className="summary-card">
												<h4>Vendor Summary</h4>
												<p>
													{vendors.length} vendors
													booked
												</p>
												<p>
													Total cost: R
													{services
														.reduce(
															(sum, s) =>
																sum +
																(parseFloat(
																	s.estimatedCost
																) || 0),
															0
														)
														.toFixed(2)}
												</p>
											</section>
										)}
									</section>
								)}
							</section>
						</section>
					)}

					{activeTab === "guests" && (
						<section className="guests-content">
							<GuestRSVPSummary guests={guests} />

							<section className="guests-section">
								<section className="guests-header">
									<h3>Guest List</h3>
									<button
										className="add-guest-btn"
										onClick={() =>
											setShowBronzeFuryPopup(true)
										}
									>
										+ Add Guests from BronzeFury
									</button>
									<button
										className="add-guest-btn"
										onClick={() =>
											setShowImportGuestPopup(true)
										}
									>
										+ Add Guests from CSV
									</button>
									<button
										className="add-guest-btn"
										onClick={() =>
											setShowAddGuestPopup(true)
										}
									>
										+ Add Guest
									</button>
								</section>

								{showImportGuestPopup && (
									<GuestImportWithValidation
										eventId={eventId}
										onClose={() =>
											setShowImportGuestPopup(false)
										}
										onImportComplete={() => {
											setShowImportGuestPopup(false); // hide after import completes
										}}
									/>
								)}

								{showBronzeFuryPopup && <BronzeFury />}

								{showAddGuestPopup && (
									<section>
										<AddGuestPopup
											isOpen={true}
											onClose={() =>
												setShowAddGuestPopup(false)
											}
											onSave={onSave}
										/>
									</section>
								)}

								<section className="guests-list">
									{guests.length > 0 ? (
										guests.map((guest) => (
											<section
												key={guest.id}
												className="guest-item"
											>
												<section className="guest-info">
													<h4>
														{guest.firstname}{" "}
														{guest.lastname}
													</h4>
													<p>{guest.email}</p>
													<p>
														Plus Ones:{" "}
														{guest.plusOne}
													</p>
												</section>
												<section className="guest-rsvp">
													<span
														className={`rsvp-badge ${guest.rsvpStatus}`}
													>
														{guest.rsvpStatus ===
														"accepted"
															? "Confirmed"
															: guest.rsvpStatus ===
															  "declined"
															? "Declined"
															: "Pending"}
													</span>
												</section>
												<section className="guest-actions">
													<button
														className="send-reminder-btn"
														onClick={() =>
															sendReminder(
																guest.id,
																eventId
															)
														}
													>
														Send Reminder
													</button>
													<button className="edit-guest-btn">
														Edit
													</button>
												</section>
											</section>
										))
									) : (
										<section className="empty-state">
											<p>
												No guests added yet. Click "Add
												Guest" to invite people to your
												event.
											</p>
										</section>
									)}
								</section>
							</section>
						</section>
					)}

					{activeTab === "vendors" && (
						<section className="vendors-content">
							<section className="vendors-header">
								<h3>Event Services</h3>
								<button
									className="add-vendor-btn"
									onClick={() => setShowVendorPopup(true)}
								>
									+ Add Vendor
								</button>
							</section>

							{/* ADDED THE VENDOR POPUP */}
							{showVendorPopup && (
								<VendorPopup
									isOpen={showVendorPopup}
									onClose={() => setShowVendorPopup(false)}
								/>
							)}

							<section className="vendors-list">
								{services && services.length > 0 ? (
									services.map((service) => (
										<ServiceItem
											key={service.id}
											service={service}
											showChat={onShowChat}
										/>
									))
								) : (
									<section className="empty-state">
										<p>
											No services added yet. Click "Add
											Vendor" to start building your
											services list.
										</p>
									</section>
								)}
							</section>
						</section>
					)}

					{activeTab === "tasks" && (
						<PlannerTasks
							setActivePage={setActivePage}
							eventId={eventId}
							eventData={eventData}
							setEventData={setEventData}
						/>
					)}

					{activeTab === "schedule" && (
						<PlannerSchedules event={eventData} />
					)}
				</section>
			</section>
		</section>
	);
}
