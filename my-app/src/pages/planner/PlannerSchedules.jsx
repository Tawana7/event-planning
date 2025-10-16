import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
	Calendar,
	Clock,
	Upload,
	Plus,
	Download,
	Edit3,
	Trash2,
	Save,
	FileText,
	Database,
	List,
	X,
	ChevronDown,
	ChevronUp,
	AlertCircle,
	CheckCircle,
	ExternalLink,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import "./PlannerSchedules.css";
import BASE_URL from "../../apiConfig";
import Popup from "../general/popup/Popup.jsx";

export default function PlannerSchedules({ event: initialEvent }) {
	const [selectedEvent, setSelectedEvent] = useState(initialEvent);
	const [schedules, setSchedules] = useState({});
	const [showScheduleInputModal, setShowScheduleInputModal] = useState(false);
	const [showExportModal, setShowExportModal] = useState(false);
	const [showCreateScheduleModal, setShowCreateScheduleModal] =
		useState(false);
	const [editingItem, setEditingItem] = useState(null);
	const [selectedEventForSchedule, setSelectedEventForSchedule] =
		useState(null);
	const [expandedSchedules, setExpandedSchedules] = useState({});
	const [selectedScheduleIndex, setSelectedScheduleIndex] = useState(0);
	const [notification, setNotification] = useState({
		show: false,
		type: "",
		message: "",
	});
	const [newScheduleTitle, setNewScheduleTitle] = useState("");
	const fileInputRef = useRef(null);
	const [events, setEvents] = useState([]);
	const [selectedSchedule, setSelectedSchedule] = useState(null);
	const [selectedPdf, setSelectedPdf] = useState(null);
	const [pdfIsSelected, setPdfIsSelected] = useState(false);
	const [itemTime, setItemTime] = useState(getCurrentTimeString());

	const [newScheduleItem, setNewScheduleItem] = useState({
		time: "",
		title: "",
		duration: "",
		description: "",
	});

	//All functions for API calls
	const fetchEvents = async () => {
		const auth = getAuth();
		let user = auth.currentUser;
		while (!user) {
			await new Promise((res) => setTimeout(res, 50)); // wait 50ms
			user = auth.currentUser;
		}
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/planner/me/events`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});
		if (!res.ok) return [];

		const data = await res.json();
		return data.events || [];
	};

	const fetchSchedules = async (eventId) => {
		try {
			const auth = getAuth();
			const user = auth.currentUser;
			const token = await user.getIdToken(true);

			const res = await fetch(
				`${BASE_URL}/planner/${eventId}/schedules`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!res.ok) throw new Error("Failed to fetch Schedules");

			const data = await res.json();
			return data;
		} catch (err) {
			console.error(err);
			alert("Failed to fetch schedules");
			return [];
		}
	};

	const addItem = async (eventId, scheduleId, item) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(
			`${BASE_URL}/planner/${eventId}/schedules/${scheduleId}/items`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(item),
			}
		);

		if (!res.ok) {
			showNotification("error", "Failed to add item");
			return null;
		}
		return res.json();
	};

	const addSchedule = async (eventId, scheduleTitle) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(`${BASE_URL}/planner/${eventId}/schedules`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ scheduleTitle }),
		});

		if (!res.ok) {
			showNotification("error", "Schedule could not be created");
			return null;
		}
		return res.json();
	};

	const uploadSchedulePDF = async (eventId, file, scheduleData) => {
		console.log(scheduleData);
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		if (!file) showNotification("error", "No file provided");

		const formData = new FormData();
		formData.append("file", file);

		//Upload file to firebase storage
		const res = await fetch(
			`${BASE_URL}/planner/schedule-upload/${eventId}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: formData,
			}
		);

		if (!res.ok) {
			showNotification("error", "Failed to upload PDF");
			return;
		}
		showNotification("success", "Uploaded pdf");
		const data = await res.json();
		console.log(data.files);

		scheduleData = {
			...scheduleData,
			permanentUrl: data.files[0].url,
		};
		console.log(scheduleData);

		//Save file link
		const res2 = await fetch(
			`${BASE_URL}/planner/schedule-save/${eventId}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(scheduleData),
			}
		);

		if (!res2.ok) {
			showNotification("error", "Failed to save schedule link");
			return;
		}
		showNotification("success", "Saved schedule link");
	};

	const deleteItem = async (eventId, scheduleId, itemId) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(
			`${BASE_URL}/planner/${eventId}/schedules/${scheduleId}/items/${itemId}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		if (!res.ok) {
			return null;
		}

		return res.json();
	};

	const editItem = async (eventId, scheduleId, itemId, updatedItem) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(
			`${BASE_URL}/planner/${eventId}/schedules/${scheduleId}/items/${itemId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updatedItem),
			}
		);

		if (!res.ok) {
			return null;
		}

		return res.json();
	};

	const deleteSchedule = async (eventId, scheduleId) => {
		const auth = getAuth();
		const user = auth.currentUser;
		const token = await user.getIdToken(true);

		const res = await fetch(
			`${BASE_URL}/planner/${eventId}/schedules/${scheduleId}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		if (!res) {
			return null;
		}

		return res.json();
	};

	//****************************** End of API call functions ******************************//

	const showNotification = (type, message) => {
		setNotification({ show: true, type, message });
		setTimeout(() => {
			setNotification({ show: false, type: "", message: "" });
		}, 4000);
	};

	//All Use Effects
	useEffect(() => {
		async function loadEvents() {
			const events = await fetchEvents();
			setEvents(events);
			if (initialEvent) {
				handleEventSelect(initialEvent);
			}
		}
		loadEvents();
	}, [initialEvent]);

	// Check if schedule is PDF or items list
	const isSchedulePDF = (schedule) => {
		return schedule.url;
	};

	const handleEventSelect = async (event) => {
		setSelectedEvent(event);
		if (!schedules[event.id]) {
			const fetchedSchedules = await fetchSchedules(event.id);
			if (!fetchedSchedules) {
				showNotification("error", "Failed to fetch schedules");
			} else {
				setSchedules((prev) => ({
					...prev,
					[event.id]: fetchedSchedules.schedules || [],
				}));
				setExpandedSchedules((prev) => ({
					...prev,
					[event.id]: fetchedSchedules.schedules.reduce(
						(acc, _, index) => ({ ...acc, [index]: index === 0 }),
						{}
					),
				}));
			}
		}
	};

	const toggleSchedule = (eventId, scheduleIndex) => {
		setExpandedSchedules((prev) => ({
			...prev,
			[eventId]: {
				...prev[eventId],
				[scheduleIndex]: !prev[eventId]?.[scheduleIndex],
			},
		}));
	};

	const handleCreateSchedule = () => {
		setShowCreateScheduleModal(true);
	};

	const handleScheduleCreate = async (type) => {
		if (!selectedEvent) return;

		if (type === "manual") {
			if (!newScheduleTitle.trim()) return;
			const result = await addSchedule(
				selectedEvent.id,
				newScheduleTitle
			);
			if (result) {
				const newSchedule = {
					id: result.id || Date.now(),
					scheduleTitle: newScheduleTitle,
					items: [],
				};

				setSchedules((prev) => ({
					...prev,
					[selectedEvent.id]: [
						...(prev[selectedEvent.id] || []),
						newSchedule,
					],
				}));

				const newIndex = schedules[selectedEvent.id]?.length || 0;
				setExpandedSchedules((prev) => ({
					...prev,
					[selectedEvent.id]: {
						...prev[selectedEvent.id],
						[newIndex]: true,
					},
				}));

				setShowCreateScheduleModal(false);
				setNewScheduleTitle("");
				showNotification("success", "Schedule created successfully!");
			}
		} else if (type === "upload") {
			fileInputRef.current?.click();
		}
	};

	const handleFileUpload = async (event) => {
		const file = selectedPdf;

		if (file && file.type === "application/pdf") {
			if (!newScheduleTitle.trim()) {
				showNotification(
					"error",
					"Please enter a schedule title first"
				);
				return;
			}
			const result = await uploadSchedulePDF(selectedEvent.id, file, {
				title: newScheduleTitle,
			});
			if (result) {
				// Refresh schedules
				const fetchedSchedules = await fetchSchedules(selectedEvent.id);
				if (fetchedSchedules) {
					setSchedules((prev) => ({
						...prev,
						[selectedEvent.id]: fetchedSchedules.schedules || [],
					}));
					showNotification(
						"success",
						`PDF "${file.name}" uploaded and processed successfully!`
					);
				}

				setNewScheduleTitle("");
				setSelectedPdf(null);
				setPdfIsSelected(false);
				closeModals();
			}
		} else {
			showNotification("error", "Please upload a valid PDF file");
		}
		event.target.value = "";
		setNewScheduleTitle("");
		setSelectedPdf(null);
		setShowCreateScheduleModal(false);
	};

	const addScheduleItem = async () => {
		if (!newScheduleItem.time || !newScheduleItem.title) return;

		const eventId = selectedEventForSchedule?.id || selectedEvent?.id;
		if (!validateTime(newScheduleItem.time, selectedEvent)) return;
		const result = await addItem(
			eventId,
			selectedSchedule,
			newScheduleItem
		);

		if (result) {
			setSchedules((prev) => ({
				...prev,
				[eventId]: prev[eventId].map((schedule, index) =>
					index === selectedScheduleIndex
						? {
								...schedule,
								items: [
									...(schedule.items || []),
									{
										...newScheduleItem,
										id: result.id || Date.now(),
									},
								],
						  }
						: schedule
				),
			}));

			setNewScheduleItem({
				time: "",
				title: "",
				duration: "",
				description: "",
			});
			showNotification("success", "Schedule item added successfully!");
		}
	};

	const updateScheduleItem = (scheduleIndex, itemId, field, value) => {
		const schedule = schedules[scheduleIndex];
		if (!schedule) return;

		const item = schedule.items.find((i) => i.id === itemId);
		if (!item) return;

		// Only validate if the field being updated is the time
		if (field === "time" && !validateTime(value, selectedEvent)) {
			return; // invalid time, do not update
		}

		setSchedules((prev) => ({
			...prev,
			[selectedEvent.id]: prev[selectedEvent.id].map((schedule, idx) =>
				idx === scheduleIndex
					? {
							...schedule,
							items: schedule.items.map((item) =>
								item.id === itemId
									? { ...item, [field]: value }
									: item
							),
					  }
					: schedule
			),
		}));
	};

	useEffect(() => {
		console.log(schedules);
	}, [selectedEvent]);

	const saveUpdatedItem = async (eventId, schedule, itemId, updatedItem) => {
		const updateRes = await editItem(
			eventId,
			schedule,
			itemId,
			updatedItem
		);

		if (!updateRes) {
			showNotification("error", "Failed to save changes");
		}
		showNotification("success", "Changes saved successfully");
		setEditingItem(null);
	};

	const deleteScheduleItem = async (scheduleIndex, schedule, itemId) => {
		const deleteResp = await deleteItem(selectedEvent.id, schedule, itemId);
		if (!deleteResp) return;

		setSchedules((prev) => ({
			...prev,
			[selectedEvent.id]: prev[selectedEvent.id].map((schedule, idx) =>
				idx === scheduleIndex
					? {
							...schedule,
							items: schedule.items.filter(
								(item) => item.id !== itemId
							),
					  }
					: schedule
			),
		}));
		showNotification("success", "Schedule item deleted");
	};

	const exportSchedule = (format, scheduleIndex) => {
		const currentSchedule =
			schedules[selectedEvent.id]?.[scheduleIndex]?.items || [];

		if (format === "pdf") {
			const currentSchedule =
				schedules[selectedEvent.id]?.[scheduleIndex]?.items || [];

			if (currentSchedule.length === 0) {
				showNotification("error", "No items to export");
				return;
			}

			const doc = new jsPDF();

			// Title
			doc.setFontSize(18);
			doc.text(selectedEvent.name || "Schedule", 14, 20);

			// Event Info
			doc.setFontSize(12);
			doc.text(
				`Date: ${formatDate(selectedEvent.date) || "N/A"}`,
				14,
				28
			);
			doc.text(`Type: ${selectedEvent.eventCategory || "N/A"}`, 14, 36);
			doc.text(
				`Attendees: ${selectedEvent.expectedGuestCount || "N/A"}`,
				14,
				44
			);

			// Prepare table data
			const tableColumn = [
				"#",
				"Time",
				"Title",
				"Duration (min)",
				"Description",
			];
			const tableRows = [];

			currentSchedule.forEach((item, index) => {
				tableRows.push([
					index + 1,
					item.time || "",
					item.title || "",
					item.duration || "",
					item.description || "",
				]);
			});

			// Add table
			autoTable(doc, {
				startY: 50,
				head: [tableColumn],
				body: tableRows,
				styles: { fontSize: 11 },
				headStyles: {
					fillColor: [30, 144, 255],
					textColor: 255,
					halign: "center",
				},
				columnStyles: {
					0: { cellWidth: 10, halign: "center" },
					1: { cellWidth: 25, halign: "center" },
					2: { cellWidth: 50 },
					3: { cellWidth: 25, halign: "center" },
					4: { cellWidth: 80 },
				},
				theme: "grid",
			});

			// Download PDF
			doc.save(
				`${selectedEvent.name.replace(/\s+/g, "_")}_schedule_${
					scheduleIndex + 1
				}.pdf`
			);
			showNotification("success", "PDF file downloaded successfully!");
		} else if (format === "csv") {
			const csvContent = [
				"Time,Title,Duration (min),Description",
				...currentSchedule.map(
					(item) =>
						`${item.time},"${item.title}",${item.duration || ""},"${
							item.description || ""
						}"`
				),
			].join("\n");

			const blob = new Blob([csvContent], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${selectedEvent.name.replace(/\s+/g, "_")}_schedule_${
				scheduleIndex + 1
			}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			showNotification("success", "CSV file downloaded successfully!");
		} else if (format === "json") {
			const jsonContent = JSON.stringify(
				{
					event: {
						name: selectedEvent.name,
						date: selectedEvent.date,
						type: selectedEvent.eventCategory,
						attendees: selectedEvent.expectedGuestCount,
					},
					schedule: currentSchedule.map((item) => ({
						time: item.time,
						title: item.title,
						duration: parseInt(item.duration) || null,
						description: item.description || "",
					})),
				},
				null,
				2
			);

			const blob = new Blob([jsonContent], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${selectedEvent.name.replace(/\s+/g, "_")}_schedule_${
				scheduleIndex + 1
			}.json`;
			a.click();
			URL.revokeObjectURL(url);
			showNotification("success", "JSON file downloaded successfully!");
		}
		setShowExportModal(false);
	};

	const closeModals = () => {
		setShowScheduleInputModal(false);
		setShowExportModal(false);
		setShowCreateScheduleModal(false);
		setEditingItem(null);
		setNewScheduleTitle("");
		setSelectedPdf(null);
	};

	const saveScheduleAndClose = () => {
		if (newScheduleItem.time && newScheduleItem.title) {
			addScheduleItem();
		}
		setShowScheduleInputModal(false);
		setSelectedEvent(selectedEventForSchedule);
		setSelectedEventForSchedule(null);
	};

	const handleDeleteSchedule = async (eventId, scheduleId) => {
		const deleteRes = await deleteSchedule(eventId, scheduleId);
		if (!deleteRes) {
			showNotification("failer", "Failed to delete schedule");
			return;
		}

		showNotification("success", "Schedule deleted");
	};

	// event.startTime: JS Date of event start
	// event.durationHours: number of hours
	// selectedTime: string from input type="time", e.g., "14:30"

	function validateTime(selectedTime, event) {
		if (!selectedTime) return false;

		// convert "HH:MM" to minutes since midnight
		const [hours, minutes] = selectedTime.split(":").map(Number);
		const selectedMinutes = hours * 60 + minutes;

		const startHours = new Date(formatDate(event.date)).getHours();
		const startMinutes = new Date(formatDate(event.date)).getMinutes();
		const eventStartMinutes = startHours * 60 + startMinutes;

		const eventEndMinutes = eventStartMinutes + event.duration * 60;

		if (selectedMinutes < eventStartMinutes) {
			alert("Selected time cannot be before the event start time!");
			return false;
		}
		if (selectedMinutes > eventEndMinutes) {
			alert("Selected time cannot be after the event end time!");
			return false;
		}

		return true; // valid
	}

	function getCurrentTimeString() {
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, "0");
		const minutes = String(now.getMinutes()).padStart(2, "0");
		return `${hours}:${minutes}`;
	}

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
	return (
		<section className="ps-container">
			{/* Custom Notification */}
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

			{/* Header */}
			<header className="ps-header">
				<section className="ps-header-content">
					<section className="ps-header-title">
						<Calendar className="ps-header-icon" />
						<h1>Schedule Manager</h1>
					</section>
				</section>
			</header>

			<main className="ps-main">
				<section className="ps-grid">
					{/* Events List */}
					<aside className="ps-sidebar">
						<section className="ps-card">
							<section className="ps-card-header">
								<h2 className="ps-section-title">
									<List className="ps-icon" />
									Your Events
								</h2>
							</section>
							<section className="ps-card-content">
								<section className="ps-events-list">
									{events.map((event) => (
										<section
											data-testid="event-card"
											key={event.id}
											onClick={() =>
												handleEventSelect(event)
											}
											className={`ps-event-card ${
												selectedEvent?.id === event.id
													? "ps-event-selected"
													: ""
											}`}
										>
											<h3 className="ps-event-name">
												{event.name}
											</h3>
											<p className="ps-event-date">
												{formatDate(event.date)}
											</p>
											<section className="ps-event-details">
												<span className="ps-event-type">
													{event.eventCategory}
												</span>
												<span className="ps-event-attendees">
													{event.expectedGuestCount}{" "}
													guests
												</span>
											</section>
										</section>
									))}
								</section>
							</section>
						</section>
					</aside>

					{/* Schedule Content */}
					<section className="ps-content">
						{selectedEvent ? (
							<section className="ps-card">
								<section className="ps-card-header">
									<section className="ps-schedule-header">
										<section>
											<h2 className="ps-section-title">
												{selectedEvent.name} Schedules
											</h2>
											<p className="ps-section-subtitle">
												Manage your event timelines and
												activities
											</p>
										</section>
										<button
											onClick={() =>
												handleCreateSchedule("manual")
											}
											className="ps-btn ps-btn-primary"
										>
											<Plus className="ps-icon" />
											New Schedule
										</button>
									</section>
								</section>

								<section className="ps-card-content">
									{(schedules[selectedEvent.id] || [])
										.length === 0 ? (
										<section className="ps-empty">
											<Calendar className="ps-empty-icon" />
											<h3>No Schedules Created</h3>
											<p>
												Create your first schedule to
												start planning your event
												timeline
											</p>
											<button
												onClick={() =>
													handleCreateSchedule(
														"manual"
													)
												}
												className="ps-btn ps-btn-primary"
											>
												<Plus className="ps-icon" />
												Create Schedule
											</button>
										</section>
									) : (
										(schedules[selectedEvent.id] || []).map(
											(schedule, scheduleIndex) => (
												<section
													data-testid="schedule-container"
													key={schedule.id}
													className="ps-schedule"
												>
													<section
														className="ps-schedule-header"
														onClick={() =>
															toggleSchedule(
																selectedEvent.id,
																scheduleIndex
															)
														}
													>
														<h3>
															{
																schedule.scheduleTitle
															}
														</h3>
														<section className="ps-schedule-meta">
															<span className="ps-badge">
																{isSchedulePDF(
																	schedule
																)
																	? "PDF"
																	: `${
																			schedule
																				.items
																				?.length ||
																			0
																	  } items`}
															</span>
															{expandedSchedules[
																selectedEvent.id
															]?.[
																scheduleIndex
															] ? (
																<ChevronUp className="ps-icon" />
															) : (
																<ChevronDown className="ps-icon" />
															)}
														</section>
													</section>

													{expandedSchedules[
														selectedEvent.id
													]?.[scheduleIndex] && (
														<section className="ps-schedule-content">
															{isSchedulePDF(
																schedule
															) ? (
																<section className="ps-pdf-schedule">
																	<FileText className="ps-pdf-icon" />
																	<section className="ps-pdf-info">
																		<h4>
																			PDF
																			Schedule
																			Document
																		</h4>
																		<p>
																			Click
																			the
																			link
																			below
																			to
																			view
																			the
																			schedule
																			PDF:
																		</p>
																		<a
																			href={
																				schedule.url
																			}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="ps-pdf-link"
																		>
																			<ExternalLink className="ps-icon" />
																			Open
																			PDF
																			Schedule:{" "}
																			{schedule.scheduleTitle ||
																				"Schedule Document"}
																		</a>
																	</section>
																</section>
															) : (
																<>
																	<section className="ps-schedule-actions">
																		<button
																			onClick={() => {
																				setSelectedEventForSchedule(
																					selectedEvent
																				);
																				setSelectedScheduleIndex(
																					scheduleIndex
																				);
																				setSelectedSchedule(
																					schedule.id
																				);
																				setShowScheduleInputModal(
																					true
																				);
																			}}
																			className="ps-btn ps-btn-success"
																		>
																			<Edit3 className="ps-icon" />
																			Add
																			Item
																		</button>
																		<button
																			onClick={() => {
																				setSelectedScheduleIndex(
																					scheduleIndex
																				);
																				setShowExportModal(
																					true
																				);
																			}}
																			className="ps-btn ps-btn-info"
																		>
																			<Download className="ps-icon" />
																			Export
																		</button>
																		<button
																			onClick={() =>
																				handleDeleteSchedule(
																					selectedEvent.id,
																					schedule.id
																				)
																			}
																			className="ps-btn ps-btn-delete"
																		>
																			<Trash2 className="ps-icon" />
																			Delete
																			Schedule
																		</button>
																	</section>

																	<section className="ps-items">
																		{(
																			schedule.items ||
																			[]
																		)
																			.length ===
																		0 ? (
																			<section className="ps-empty-items">
																				<Clock className="ps-empty-icon" />
																				<p>
																					No
																					items
																					in
																					this
																					schedule
																					yet
																				</p>
																				<button
																					onClick={() => {
																						setSelectedEventForSchedule(
																							selectedEvent
																						);
																						setSelectedScheduleIndex(
																							scheduleIndex
																						);
																						setSelectedSchedule(
																							schedule.id
																						);
																						setShowScheduleInputModal(
																							true
																						);
																					}}
																					className="ps-btn ps-btn-success ps-btn-sm"
																				>
																					<Plus className="ps-icon" />
																					Add
																					First
																					Item
																				</button>
																			</section>
																		) : (
																			schedule.items.map(
																				(
																					item
																				) => (
																					<section
																						key={
																							item.id
																						}
																						className="ps-item"
																					>
																						{editingItem ===
																						item.id ? (
																							<section className="ps-edit-form">
																								<section className="ps-form-row">
																									<input
																										type="time"
																										defaultValue={
																											itemTime
																										}
																										onChange={(
																											e
																										) =>
																											updateScheduleItem(
																												scheduleIndex,
																												item.id,
																												"time",
																												e
																													.target
																													.value
																											)
																										}
																										className="ps-input"
																									/>
																									<input
																										type="number"
																										placeholder="Duration (min)"
																										defaultValue={
																											item.duration
																										}
																										onChange={(
																											e
																										) =>
																											updateScheduleItem(
																												scheduleIndex,
																												item.id,
																												"duration",
																												e
																													.target
																													.value
																											)
																										}
																										className="ps-input"
																									/>
																								</section>
																								<input
																									type="text"
																									placeholder="Event title"
																									defaultValue={
																										item.title
																									}
																									onChange={(
																										e
																									) =>
																										updateScheduleItem(
																											scheduleIndex,
																											item.id,
																											"title",
																											e
																												.target
																												.value
																										)
																									}
																									className="ps-input"
																								/>
																								<textarea
																									placeholder="Description"
																									defaultValue={
																										item.description
																									}
																									onChange={(
																										e
																									) =>
																										updateScheduleItem(
																											scheduleIndex,
																											item.id,
																											"description",
																											e
																												.target
																												.value
																										)
																									}
																									className="ps-textarea"
																									rows={
																										2
																									}
																								/>
																								<section className="ps-form-actions">
																									<button
																										onClick={() =>
																											saveUpdatedItem(
																												selectedEvent.id,
																												schedule.id,
																												item.id,
																												item
																											)
																										}
																										className="ps-btn ps-btn-success ps-btn-sm"
																									>
																										Save
																									</button>
																									<button
																										onClick={() =>
																											setEditingItem(
																												null
																											)
																										}
																										className="ps-btn ps-btn-secondary ps-btn-sm"
																									>
																										Cancel
																									</button>
																								</section>
																							</section>
																						) : (
																							<section className="ps-item-content">
																								<section className="ps-item-info">
																									<section className="ps-item-time">
																										<span className="ps-time-badge">
																											<Clock className="ps-icon" />
																											{
																												item.time
																											}
																										</span>
																										{item.duration && (
																											<span className="ps-duration">
																												{
																													item.duration
																												}{" "}
																												min
																											</span>
																										)}
																									</section>
																									<h4>
																										{
																											item.title
																										}
																									</h4>
																									{item.description && (
																										<p>
																											{
																												item.description
																											}
																										</p>
																									)}
																								</section>
																								<section className="ps-item-actions">
																									<button
																										data-testid="item-edit-button"
																										onClick={() =>
																											setEditingItem(
																												item.id
																											)
																										}
																										className="ps-btn-icon"
																									>
																										<Edit3 className="ps-icon" />
																									</button>
																									<button
																										onClick={() =>
																											deleteScheduleItem(
																												scheduleIndex,
																												schedule.id,
																												item.id
																											)
																										}
																										className="ps-btn-icon ps-btn-danger"
																									>
																										<Trash2 className="ps-icon" />
																									</button>
																								</section>
																							</section>
																						)}
																					</section>
																				)
																			)
																		)}
																	</section>
																</>
															)}
														</section>
													)}
												</section>
											)
										)
									)}
								</section>
							</section>
						) : (
							<section className="ps-card ps-empty-state">
								<Calendar className="ps-empty-icon" />
								<h3>Select an Event</h3>
								<p>
									Choose an event from your list to start
									managing schedules
								</p>
							</section>
						)}
					</section>
				</section>
			</main>

			{/* Create Schedule Modal */}
			<Popup isOpen={showCreateScheduleModal} onClose={closeModals}>
				<section
					className="ps-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<section className="ps-modal-header">
						<h3>Create New Schedule</h3>
						<button
							onClick={closeModals}
							className="ps-modal-close"
						>
							<X className="ps-icon" />
						</button>
					</section>
					<section className="ps-modal-content">
						<section className="ps-form-group">
							<label>Schedule Title</label>
							<input
								type="text"
								value={newScheduleTitle}
								onChange={(e) =>
									setNewScheduleTitle(e.target.value)
								}
								className="ps-input"
								placeholder="Enter schedule name (e.g., Main Event Timeline)"
							/>
						</section>
						<section>
							<input
								type="file"
								accept="application/pdf"
								ref={fileInputRef}
								style={{ display: "none" }}
								onChange={(e) => {
									if (e.target.files?.[0]) {
										setSelectedPdf(e.target.files[0]);
										setPdfIsSelected(true);
										setNewScheduleTitle(
											String(e.target.files[0].name)
										);
									}
								}}
							/>

							{selectedPdf && (
								<p className="pdf-selected">
									Selected PDF: {selectedPdf.name}
								</p>
							)}
						</section>
						<section className="ps-create-options">
							<button
								onClick={() => handleScheduleCreate("manual")}
								disabled={!newScheduleTitle.trim()}
								className="ps-create-option"
							>
								<Edit3 className="ps-create-icon" />
								<section>
									<section className="ps-option-title">
										Create Manually
									</section>
									<section className="ps-option-subtitle">
										Build schedule item by item
									</section>
								</section>
							</button>
							<button
								onClick={() => handleScheduleCreate("upload")}
								className="ps-create-option"
							>
								<Upload className="ps-create-icon" />
								<section>
									<section className="ps-option-title">
										Upload PDF
									</section>
									<section className="ps-option-subtitle">
										Store and track externally created
										schedules
									</section>
								</section>
							</button>
						</section>
					</section>
					<section className="ps-modal-footer">
						<button
							onClick={closeModals}
							className="ps-btn ps-btn-secondary"
						>
							Cancel
						</button>
						{pdfIsSelected && (
							<button
								onClick={handleFileUpload}
								className="ps-btn ps-btn-secondary"
							>
								Save
							</button>
						)}
					</section>
				</section>
			</Popup>

			{/* Schedule Input Modal */}
			<Popup isOpen={showScheduleInputModal} onClose={closeModals}>
				<section
					className="ps-modal ps-modal-large"
					onClick={(e) => e.stopPropagation()}
				>
					<section className="ps-modal-header">
						<h3>
							Add Schedule Item -{" "}
							{selectedEventForSchedule?.name ||
								selectedEvent?.name}
						</h3>
						<button
							onClick={closeModals}
							className="ps-modal-close"
						>
							<X className="ps-icon" />
						</button>
					</section>
					<section className="ps-modal-content">
						<section className="ps-form-row">
							<section className="ps-form-group">
								<label htmlFor="time">Time</label>
								<input
									id="time"
									type="time"
									value={newScheduleItem.time}
									onChange={(e) =>
										setNewScheduleItem((prev) => ({
											...prev,
											time: e.target.value,
										}))
									}
									className="ps-input"
								/>
							</section>
							<section className="ps-form-group">
								<label htmlFor="duration">
									Duration (minutes)
								</label>
								<input
									id="duration"
									type="number"
									value={newScheduleItem.duration}
									onChange={(e) =>
										setNewScheduleItem((prev) => ({
											...prev,
											duration: e.target.value,
										}))
									}
									className="ps-input"
									placeholder="60"
								/>
							</section>
						</section>
						<section className="ps-form-group">
							<label htmlFor="title">Title</label>
							<input
								id="title"
								type="text"
								value={newScheduleItem.title}
								onChange={(e) =>
									setNewScheduleItem((prev) => ({
										...prev,
										title: e.target.value,
									}))
								}
								className="ps-input"
								placeholder="Event title"
							/>
						</section>
						<section className="ps-form-group">
							<label>Description</label>
							<textarea
								value={newScheduleItem.description}
								onChange={(e) =>
									setNewScheduleItem((prev) => ({
										...prev,
										description: e.target.value,
									}))
								}
								className="ps-textarea"
								rows={4}
								placeholder="Event description"
							/>
						</section>
					</section>
					<section className="ps-modal-footer">
						<button
							onClick={closeModals}
							className="ps-btn ps-btn-secondary"
						>
							Cancel
						</button>
						<button
							onClick={saveScheduleAndClose}
							disabled={
								!newScheduleItem.time || !newScheduleItem.title
							}
							className="ps-btn ps-btn-primary"
						>
							<Save className="ps-icon" />
							Save Item
						</button>
					</section>
				</section>
			</Popup>

			{/* Export Modal */}
			<Popup isOpen={showExportModal} onClose={closeModals}>
				<section
					className="ps-modal"
					onClick={(e) => e.stopPropagation()}
				>
					<section className="ps-modal-header">
						<h3>Export Schedule</h3>
						<button
							onClick={closeModals}
							className="ps-modal-close"
						>
							<X className="ps-icon" />
						</button>
					</section>
					<section className="ps-modal-content">
						<p>
							Export "{selectedEvent?.name}" schedule in your
							preferred format:
						</p>
						<section className="ps-export-options">
							<button
								onClick={() =>
									exportSchedule("pdf", selectedScheduleIndex)
								}
								className="ps-export-option"
							>
								<FileText className="ps-export-icon" />
								<section>
									<section>PDF Document</section>
									<small>
										Formatted schedule for printing
									</small>
								</section>
							</button>
							<button
								onClick={() =>
									exportSchedule("csv", selectedScheduleIndex)
								}
								className="ps-export-option"
							>
								<Database className="ps-export-icon" />
								<section>
									<section>CSV Spreadsheet</section>
									<small>
										Open in Excel or Google Sheets
									</small>
								</section>
							</button>
							<button
								onClick={() =>
									exportSchedule(
										"json",
										selectedScheduleIndex
									)
								}
								className="ps-export-option"
							>
								<Database className="ps-export-icon" />
								<section>
									<section>JSON Data</section>
									<small>
										Structured data for developers
									</small>
								</section>
							</button>
						</section>
					</section>
					<section className="ps-modal-footer">
						<button
							onClick={closeModals}
							className="ps-btn ps-btn-secondary"
						>
							Cancel
						</button>
					</section>
				</section>
			</Popup>
		</section>
	);
}
