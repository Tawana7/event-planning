import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import "./PlannerVendorMarketplace.css";
import {AlertCircle, CheckCircle } from "lucide-react";
import ChatComponent from "./ChatComponent";
import Popup from "../general/popup/Popup.jsx";
import BASE_URL from "../../apiConfig.js";

import VendorCard from "./MarketPlaceComponents/VendorCardMarket.jsx";
import VendorModal from "./MarketPlaceComponents/VendorDetails.jsx";

function formatDate(date) {
	if (!date) return "";

	if (
		typeof date === "object" &&
		typeof date._seconds === "number" &&
		typeof date._nanoseconds === "number"
	) {
		const jsDate = new Date(date._seconds * 1000 + date._nanoseconds / 1e6);
		return jsDate.toLocaleString();
	}

	if (date instanceof Date) {
		return date.toLocaleString();
	}

	if (typeof date === "string") {
		return new Date(date).toLocaleString();
	}

	return String(date);
}

export default function PlannerVendorMarketplace({ event = null }) {

	
	const [activeTab, setActiveTab] = useState(
		event ? "event-specific" : "all-events"
	);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("All");
	const [vendors, setVendors] = useState([]);
	const [events, setEvents] = useState([]);
	const [selectedEvent, setSelectedEvent] = useState(event);
	const [loading, setLoading] = useState(false);
	const [showEventModal, setShowEventModal] = useState(false);
	const [showVendorModal, setShowVendorModal] = useState(false);
	const [selectedVendor, setSelectedVendor] = useState(null);
	const [pendingVendorId, setPendingVendorId] = useState(null);
	const [selectedVendorForModal, setSelectedVendorForModal] = useState(null);
	const [modalPurpose, setModalPurpose] = useState(null);
	const [notification, setNotification] = useState({
		show: false,
		type: "",
		message: "",
	});
	const [service, setService] = useState(null);
	const [showChat, setShowChat] = useState(false);
	const [chatInfo, setChatInfo] = useState(null);
	const [pendingChatVendor, setPendingChatVendor] = useState(null);

	const fetchAllEventsVendors = async () => {
		const auth = getAuth();
		let user = auth.currentUser;
		if (!user) {
			await new Promise((res) => setTimeout(res, 1000));
			user = auth.currentUser;
		}
		if (!user) return [];
		const token = await user.getIdToken(true);
		const plannerId = user.uid;

		const res = await fetch(
			`${BASE_URL}/planner/${plannerId}/bestVendors`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!res.ok) return [];
		const data = await res.json();
		return data.vendors || [];
	};

	const fetchEventSpecificVendors = async (eventId) => {
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) return [];
		const token = await user.getIdToken(true);

		const res = await fetch(
			`${BASE_URL}/planner/events/${eventId}/bestVendors`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!res.ok) return [];
		const data = await res.json();
		return data.vendors || [];
	};

	const fetchEvents = async () => {
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) return [];
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/planner/me/events`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!res.ok) return [];
		const data = await res.json();
		return data.events || [];
	};

	const addVendorToEvent = async (vendorId, eventId) => {
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) return null;
		const token = await user.getIdToken(true);

		try {
			const res = await fetch(
				`${BASE_URL}/planner/${eventId}/vendors/${vendorId}`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);
			return res;
		} catch (err) {
			console.error("Error adding vendor to event:", err);
			return null;
		}
	};

	const fetchVendorServices = async (vendorId) => {
		try {
			const auth = getAuth();
			const user = auth.currentUser;
			if (!user) return null;
			const token = await user.getIdToken(true);

			const res = await fetch(
				`${BASE_URL}/vendors/${vendorId}/services`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!res.ok) {
				throw new Error("Failed to fetch vendor services");
			}

			const data = await res.json();
			return data;
		} catch (err) {
			console.error(err);
			showNotification("error", "Failed to fetch vendor services.");
			return null;
		}
	};

	const addService = async (eventId, service) => {
		const auth = getAuth();
		const user = auth.currentUser;
		if (!user) return null;
		const token = await user.getIdToken(true);

		try {
			const res = await fetch(`${BASE_URL}/planner/${eventId}/services`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(service),
			});
			return res;
		} catch (err) {
			console.error("Error Adding Service to Event: ", err);
			return null;
		}
	};

	const showNotification = (type, message) => {
		setNotification({ show: true, type, message });
		setTimeout(() => {
			setNotification({ show: false, type: "", message: "" });
		}, 4000);
	};

	useEffect(() => {
		async function loadInitialData() {
			setLoading(true);
			if (activeTab === "all-events") {
				const allVendors = await fetchAllEventsVendors();
				setVendors(allVendors);
			} else if (activeTab === "event-specific") {
				const eventsData = await fetchEvents();
				setEvents(eventsData);

				if (selectedEvent?.id) {
					const eventVendors = await fetchEventSpecificVendors(
						selectedEvent.id
					);
					setVendors(eventVendors);
				}
			}
			setLoading(false);
		}
		loadInitialData();
	}, [activeTab, selectedEvent]);

	useEffect(() => {
		setModalPurpose(
			activeTab === "event-specific" ? "recommend" : "addVendor"
		);
	}, [activeTab]);

	useEffect(() => {
		if (event) {
			setSelectedEvent(event);
		}
	}, [event]);

	const handleTabChange = (tab) => {
		setActiveTab(tab);
		setVendors([]);
		if (tab === "event-specific" && !selectedEvent) {
			setShowEventModal(true);
		}
	};

	const handleEventSelect = async (selectedEventData) => {
		setSelectedEvent(selectedEventData);
		setLoading(true);
		const eventVendors = await fetchEventSpecificVendors(
			selectedEventData.id
		);
		setVendors(eventVendors);
		setLoading(false);
	};

	const handleViewVendor = async (vendor) => {
		const services = await fetchVendorServices(vendor.id);
		if (services === null) {
			return;
		}
		const vendorInfo = {
			...vendor,
			services: services,
		};
		setSelectedVendor(vendor);
		setSelectedVendorForModal(vendorInfo);
		setShowVendorModal(true);
	};

	const handleAddVendor = async (event, vendor) => {
		const res = await addVendorToEvent(vendor.id, event.id);
		if (res && res.ok) {
			showNotification("success", "Vendor added to event successfully!");
		} else {
			showNotification("error", "Failed to add vendor to event.");
		}
	};

	const handleEventPicked = async (vendor, service) => {
		setService(service);
		if (activeTab === "event-specific") {
			if (selectedEvent) {
				await handleAddVendor(selectedEvent, vendor);
				await handleAddService(selectedEvent.id, vendor, service);
			} else {
				showNotification("info", "Please select an event first.");
			}
		} else {
			setShowVendorModal(false);
			setPendingVendorId(vendor.id);
			const eventsList = await fetchEvents();
			setEvents(eventsList);
			setShowEventModal(true);
		}
	};

	const handleAddService = async (eventId, vendor, service) => {
		const data = {
			vendorId: vendor.id,
			vendorName: vendor.businessName,
			...service,
		};
		const res = await addService(eventId, data);
		if (res && res.ok) {
			showNotification("success", "Service added successfully.");
		} else {
			showNotification("error", "Failed to add service.");
		}
	};

	const handleContactVendor = async (vendor) => {
		if (activeTab === "event-specific" && selectedEvent) {
			openChat(vendor, selectedEvent);
		} else {
			setShowVendorModal(false);
			setPendingChatVendor(vendor);
			const eventsList = await fetchEvents();
			setEvents(eventsList);
			setModalPurpose("chat");
			setShowEventModal(true);
		}
	};

	const openChat = (vendor, event) => {
		const auth = getAuth();
		const currentUserId = auth.currentUser.uid;

		const chatData = {
			plannerId: currentUserId,
			vendorId: vendor.id,
			eventId: event.id,
			currentUser: {
				id: currentUserId,
				name: event.name,
				type: "planner",
			},
			otherUser: {
				id: vendor.id,
				name: vendor.businessName || vendor.name,
				type: "vendor",
			},
		};

		setChatInfo(chatData);
		setShowChat(true);
		setShowVendorModal(false);
	};

	const handleEventSelectionForChat = (selectedEventData) => {
		if (pendingChatVendor) {
			openChat(pendingChatVendor, selectedEventData);
			setPendingChatVendor(null);
		}
	};

	const handleCloseChat = () => {
		setShowChat(false);
		setChatInfo(null);
	};

	const filteredVendors = vendors.filter(
		(v) =>
			(v.businessName?.toLowerCase().includes(search.toLowerCase()) ||
				v.name?.toLowerCase().includes(search.toLowerCase()) ||
				v.category?.toLowerCase().includes(search.toLowerCase())) &&
			(categoryFilter === "All" || v.category === categoryFilter)
	);

	console.log(vendors);

	const categories = [
		"All",
		"Catering",
		"Entertainment",
		"Decor",
		"Photography",
		"Venue",
		"Florist",
		"Music",
	];

	return (
		<main
			data-testid="planner-vendor-marketplace"
			className="vendor-marketplace"
		>
			{showChat && chatInfo && (
				<ChatComponent
					plannerId={chatInfo.plannerId}
					vendorId={chatInfo.vendorId}
					eventId={chatInfo.eventId}
					currentUser={chatInfo.currentUser}
					otherUser={chatInfo.otherUser}
					closeChat={handleCloseChat}
				/>
			)}

			{notification.show && (
				<section
					className={`ps-notification ps-notification-${notification.type}`}
				>
					<section className="ps-notification-content">
						{notification.type === "success" && (
							<CheckCircle className="ps-notification-icon" />
						)}
						{notification.type === "error" && (
							<AlertCircle className="ps-notification-icon" />
						)}
						{notification.type === "info" && (
							<AlertCircle className="ps-notification-icon" />
						)}
						<span>{notification.message}</span>
					</section>
				</section>
			)}

			<header className="marketplace-header">
				<h1 className="marketplace-title">Vendor Marketplace</h1>
				<p className="marketplace-subtitle">
					Discover and connect with top-rated event vendors
				</p>
			</header>

			<nav className="marketplace-tabs">
				<button
					className={`tab-btn ${
						activeTab === "all-events" ? "active" : ""
					}`}
					onClick={() => handleTabChange("all-events")}
				>
					All Events
				</button>
				<button
					className={`tab-btn ${
						activeTab === "event-specific" ? "active" : ""
					}`}
					onClick={() => handleTabChange("event-specific")}
				>
					Event Specific
				</button>
			</nav>

			{activeTab === "event-specific" && (
				<section className="event-selector">
					<label className="event-selector-label">
						Selected Event:
					</label>
					<button
						className="event-select-button"
						onClick={() => setShowEventModal(true)}
					>
						{selectedEvent ? (
							<>
								<strong>{selectedEvent.name}</strong>
								<span>{formatDate(selectedEvent.date)}</span>
							</>
						) : (
							"Choose an event..."
						)}
					</button>
				</section>
			)}

			<section className="marketplace-controls">
				<section className="search-container">
					<input
						type="text"
						placeholder="Search vendors..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="search-input-market"
					/>
				</section>
				<section className="filter-container">
					<select
						value={categoryFilter}
						onChange={(e) => setCategoryFilter(e.target.value)}
						className="category-select"
					>
						{categories.map((category) => (
							<option key={category} value={category}>
								{category === "All"
									? "All Categories"
									: category}
							</option>
						))}
					</select>
				</section>
			</section>

			{loading ? (
				<section className="loading-state">
					<article className="loading-spinner"></article>
					<p>Loading vendors...</p>
				</section>
			) : (
				<section className="vendors-grid-market">
					{filteredVendors.length > 0 ? (
						filteredVendors.map((vendor) => (
							<VendorCard
								key={vendor.id}
								vendor={vendor}
								onViewMore={() => handleViewVendor(vendor)}
							/>
						))
					) : (
						<section className="empty-state">
							<p>No vendors found matching your criteria.</p>
							{activeTab === "event-specific" &&
								!selectedEvent && (
									<p>
										Please select an event to view vendors.
									</p>
								)}
						</section>
					)}
				</section>
			)}

			<Popup
				isOpen={showEventModal}
				onClose={() => {
					setShowEventModal(false);
					setPendingChatVendor(null);
					setPendingVendorId(null);
					setModalPurpose(null);
				}}
			>
				<div className="modal-header">
					<h2>
						{modalPurpose === "chat"
							? "Select Event for Chat"
							: "Select Event"}
					</h2>
				</div>
				<div className="modal-body">
					{events.length === 0 ? (
						<p>Loading events...</p>
					) : (
						<ul className="event-list">
							{events.map((event) => (
								<li key={event.id} className="event-item">
									<button
										className="event-button-market"
										onClick={async () => {
											if (modalPurpose === "chat") {
												handleEventSelectionForChat(
													event
												);
											} else if (pendingVendorId) {
												await handleAddVendor(event, {
													id: pendingVendorId,
												});
												await handleAddService(
													event.id,
													selectedVendorForModal,
													service
												);
												setPendingVendorId(null);
											} else {
												handleEventSelect(event);
											}
											setShowEventModal(false);
											setModalPurpose(null);
										}}
									>
										<strong>{event.name}</strong>
										<span className="event-date">
											{formatDate(event.date)}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</Popup>

			{showVendorModal && (
				<VendorModal
					vendor={selectedVendorForModal}
					addService={handleEventPicked}
					onContactVendor={handleContactVendor}
					onClose={() => {
						setShowVendorModal(false);
						setSelectedVendor(null);
						setSelectedVendorForModal(null);
					}}
				/>
			)}
		</main>
	);
}
