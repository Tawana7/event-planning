import { useState, useEffect } from "react";
import "../../planner/PlannerAllEvents.css";
import { getAuth } from "firebase/auth";
import BASE_URL from "../../../apiConfig";
import LoadingSpinner from "../../general/loadingspinner/LoadingSpinner";

function EventCard({ event, onQuickView, onDeleteEvent }) {
	function formatDate(dateString) {
		if (!dateString) return "";

		let jsDate;

		if (
			typeof dateString === "object" &&
			typeof dateString._seconds === "number"
		) {
			jsDate = new Date(
				dateString._seconds * 1000 +
					(dateString._nanoseconds || 0) / 1e6
			);
		} else if (dateString instanceof Date) {
			jsDate = dateString;
		} else if (typeof dateString === "string") {
			jsDate = new Date(dateString);
		} else {
			return String(dateString);
		}

		if (isNaN(jsDate)) return "Invalid Date";

		const day = String(jsDate.getDate()).padStart(2, "0");
		const monthName = jsDate.toLocaleString("en-US", { month: "long" });
		const year = jsDate.getFullYear();
		const hours = String(jsDate.getHours()).padStart(2, "0");
		const minutes = String(jsDate.getMinutes()).padStart(2, "0");

		return `${day} ${monthName} ${year} @${hours}:${minutes}`;
	}

	const getStatusColor = (status) => {
		switch (status) {
			case "upcoming":
				return "#10b981";
			case "in-progress":
				return "#f59e0b";
			case "completed":
				return "#6b7280";
			default:
				return "#6366f1";
		}
	};

	return (
		<section className="event-card">
			<section className="event-header">
				<h3>{event.name}</h3>
				<section
					className="event-status"
					style={{ backgroundColor: getStatusColor(event.status) }}
				>
					{event.status}
				</section>
			</section>
			<section className="event-details">
				<p className="event-date">{formatDate(event.date)}</p>
				<p className="event-location">{event.location}</p>
				<p className="event-attendees">
					{event.expectedGuestCount} attendees
				</p>
				<p className="event-budget">R{event.budget.toLocaleString()}</p>
			</section>
			<section className="event-description">
				<p>{event.description}</p>
			</section>
			<section className="event-buttons">
				<button
					className="quick-view-btn"
					onClick={() => onQuickView(event)}
				>
					Quick View
				</button>

				<button
					className="delete-btn"
					onClick={() => onDeleteEvent(event.id)}
				>
					Delete
				</button>
			</section>
		</section>
	);
}

export default function AdminAllEvents({ setActivePage, setSelectedEvent }) {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [sortBy, setSortBy] = useState("date");
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true); // track loading state

	const fetchAdminEvents = async () => {
		const auth = getAuth();
		let user = auth.currentUser;

		while (!user) {
			await new Promise((res) => setTimeout(res, 50)); // wait 50ms
			user = auth.currentUser;
		}
		if (!user) {
			console.warn("No user signed in");
			return [];
		}
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/admin/events`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return [];

		const data = await res.json();
		return data.events || [];
	};

	const deleteEvent = async (eventId) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/admin/events/${eventId}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		});

		if (res.ok) {
			setEvents((prev) => prev.filter((e) => e.id !== eventId));
		} else {
			console.error("Failed to delete event");
		}
	};

	useEffect(() => {
		async function loadEvents() {
			setLoading(true);
			const events = await fetchAdminEvents();
			setEvents(events);
			setLoading(false);
		}
		loadEvents();
	}, []);

	const filteredEvents = events
		.filter(
			(event) =>
				(event.name.toLowerCase().includes(search.toLowerCase()) ||
					event.location
						.toLowerCase()
						.includes(search.toLowerCase())) &&
				(statusFilter === "All" || event.status === statusFilter)
		)
		.sort((a, b) => {
			switch (sortBy) {
				case "date":
					return new Date(a.date) - new Date(b.date);
				case "name":
					return a.name.localeCompare(b.name);
				case "budget":
					return b.budget - a.budget;
				case "attendees":
					return b.expectedGuestCount - a.expectedGuestCount;
				default:
					return 0;
			}
		});

	const handleQuickView = (event) => {
		setSelectedEvent(event); // ✅ pass whole event object
		setActivePage("AdminViewEvent");
	};

	return (
		<section className="events-list">
			<section className="events-header">
				<h2>Events</h2>
				<p className="events-subtitle">
					Manage, track, and delete events
				</p>
			</section>

			<section className="events-controls">
				<section className="search-sort">
					<input
						type="text"
						placeholder="Search events..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="search-bar"
					/>
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value)}
						className="sort-select"
					>
						<option value="date">Sort by Date</option>
						<option value="name">Sort by Name</option>
						<option value="budget">Sort by Budget</option>
						<option value="attendees">Sort by Attendees</option>
					</select>
				</section>

				<section className="status-filters">
					<button
						className={`status-filter-btn ${
							statusFilter === "All" ? "active" : ""
						}`}
						onClick={() => setStatusFilter("All")}
					>
						All Events
					</button>
					<button
						className={`status-filter-btn ${
							statusFilter === "upcoming" ? "active" : ""
						}`}
						onClick={() => setStatusFilter("upcoming")}
					>
						Upcoming
					</button>
					<button
						className={`status-filter-btn ${
							statusFilter === "in-progress" ? "active" : ""
						}`}
						onClick={() => setStatusFilter("in-progress")}
					>
						In Progress
					</button>
					<button
						className={`status-filter-btn ${
							statusFilter === "completed" ? "active" : ""
						}`}
						onClick={() => setStatusFilter("completed")}
					>
						Completed
					</button>
				</section>
			</section>

			<section className="events-grid">
				{loading ? (
					<section className="loading">
						<div className="spinner"></div>
						<p>Loading events...</p>
					</section>
				) : filteredEvents.length > 0 ? (
					filteredEvents.map((event) => (
						<EventCard
							key={event.id}
							event={event}
							onQuickView={handleQuickView}
							onDeleteEvent={deleteEvent}
						/>
					))
				) : (
					<section className="no-events">
						<p>No events found matching your criteria</p>
					</section>
				)}
			</section>
		</section>
	);
}
