// src/vendor/VendorApp.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	Users,
	Calendar,
	MapPin,
	FileText,
	ArrowLeft,
	Building2,
	BarChart3,
} from "lucide-react";

//Paging imports
import PlannerDashboard from "./PlannerDashboard";
import PlannerVendorMarketplace from "./PlannerVendorMarketplace";

//css import
import "./PlannerApp.css";
import PlannerViewEvent from "./PlannerViewEvent";
import PlannerReview from "./PlannerReview";
import PlannerContract from "./PlannerContract";
import PlannerFloorPlan from "./PlannerFloorPlan";
import PlannerSchedules from "./PlannerSchedules";
import PlannerCalendar from "./PlannerCalendar";

const PlannerApp = () => {
	const [selectedEvent, setSelectedEvent] = useState(null);
	const [activePage, setActivePage] = useState(
		localStorage.getItem("activePage") || "dashboard"
	);

	const handleSetActivePage = (page) => {
		setActivePage(page);
		localStorage.setItem("activePage", page);
	};

	const navigate = useNavigate();

	const navigationItems = [
		{ id: "dashboard", label: "Dashboard", icon: BarChart3 },
		{ id: "events", label: "Events", icon: Calendar },
		{ id: "vendor", label: "Vendor Marketplace", icon: Users },
		{ id: "floorplan", label: "Floorplan", icon: MapPin },
		{ id: "review", label: "Reviews", icon: FileText },
		{ id: "documents", label: "Documents", icon: FileText },
	];

	const renderPlaceholderPage = (pageTitle) => (
		<section className="placeholder-page">
			<section className="placeholder-content">
				<section className="placeholder-icon">
					{navigationItems.find((item) => item.id === activePage)
						?.icon &&
						React.createElement(
							navigationItems.find(
								(item) => item.id === activePage
							).icon,
							{ size: 32 }
						)}
				</section>
				<h1 className="placeholder-title">{pageTitle}</h1>
				<p className="placeholder-text">
					This page is coming soon. All the functionality will be
					built here.
				</p>
				<button
					onClick={() => handleSetActivePage("dashboard")}
					className="back-to-dashboard-btn"
				>
					Back to Dashboard
				</button>
			</section>
		</section>
	);

	const renderCurrentPage = () => {
		switch (activePage) {
			case "dashboard":
				return (
					<PlannerDashboard
						data-testid="planner-dashboard"
						setActivePage={setActivePage}
						onSelectEvent={onSelectEvent} // ✅ Pass the handler
					/>
				);
			case "events":
				return (
					<PlannerCalendar
						setActivePage={setActivePage}
						onSelectEvent={onSelectEvent}
					/>
				);
			case "vendor":
				return (
					<PlannerVendorMarketplace
						setActivePage={setActivePage}
						event={selectedEvent}
					/>
				);
			case "floorplan":
				return <PlannerFloorPlan setActivePage={setActivePage} />;
			case "documents":
				return <PlannerContract setActivePage={setActivePage} />;
			case "selected-event":
				return (
					<PlannerViewEvent
						event={selectedEvent}
						onOpenMarketplace={onOpenMarketplace}
						setActivePage={setActivePage}
					/>
				);
			case "review":
				return <PlannerReview />;
			default:
				return (
					<PlannerDashboard
						setActivePage={setActivePage}
						onSelectEvent={onSelectEvent} // ✅ Also here
					/>
				);
		}
	};

	const onSelectEvent = (event) => {
		setSelectedEvent(event);
		handleSetActivePage("selected-event");
		localStorage.setItem("selectedEvent", JSON.stringify(event));
	};

	const onOpenMarketplace = () => {
		handleSetActivePage("vendor-marketplace");
	};

	return (
		<section className="planner-app">
			{/* Navigation Bar */}
			<nav className="vendor-navbar">
				<section className="navbar-container">
					<section className="navbar-content">
						<section className="navbar-left">
							<button
								className="home-btn"
								onClick={() => navigate("/home")}
							>
								<ArrowLeft size={20} />
								<section>Home</section>
							</button>

							<section className="vendor-logo">
								<Building2 size={24} />
								<section className="logo-text">
									PlannerHub
								</section>
							</section>
						</section>

						<section className="navbar-right">
							{navigationItems.map((item) => {
								const Icon = item.icon;
								return (
									<button
										key={item.id}
										className={`nav-btn ${
											activePage === item.id
												? "active"
												: ""
										}`}
										onClick={() =>
											handleSetActivePage(item.id)
										}
									>
										<Icon size={18} />
										{item.label}
									</button>
								);
							})}
						</section>
					</section>
				</section>
			</nav>

			{/* Main Content */}
			<main className="planner-main">{renderCurrentPage()}</main>
		</section>
	);
};

export default PlannerApp;
