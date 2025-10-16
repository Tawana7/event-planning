import React, { useState } from "react";
import { useAnalyticsData } from "./useAnalyticsData";
import { formatCurrency, formatNumber } from "./formatters";
import AdminReportsKpiCard from "./AdminReportsKpiCard";
import AdminReportsEventsDetailedCharts from "./AdminReportsEventsDetailedCharts";
import AdminReportsVendorsDetailedCharts from "./AdminReportsVendorsDetailedCharts";
import AdminReportsPlannersDetailedCharts from "./AdminReportsPlannersDetailedCharts";
import AdminReportsFinancialDetailedCharts from "./AdminReportsFinancialDetailedCharts";
import Popup from "../../general/popup/Popup.jsx";
import LoadingSpinner from "../../general/loadingspinner/LoadingSpinner.jsx";
import {
	Calendar,
	Users,
	BarChart as BarIcon,
	DollarSign,
	UserCheck,
} from "lucide-react";
import "./AdminReports.css";

const AdminReports = () => {
	const {
		platformSummary,
		monthlyFinancials,
		newEventsData,
		vendorCategoryData,
		eventCategoryData,
		isLoading,
		error,
	} = useAnalyticsData();
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	const [popupContent, setPopupContent] = useState(null);
	const [popupTitle, setPopupTitle] = useState("");

	const handleExpandReports = (section) => {
		setPopupTitle(`Detailed ${section} Analytics`);
		let content;
		switch (section) {
			case "Events":
				content = (
					<AdminReportsEventsDetailedCharts
						{...{
							platformSummary,
							monthlyFinancials,
							newEventsData,
							eventCategoryData,
						}}
					/>
				);
				break;
			case "Vendors":
				content = (
					<AdminReportsVendorsDetailedCharts
						{...{ platformSummary, vendorCategoryData }}
					/>
				);
				break;
			case "Planners":
				content = (
					<AdminReportsPlannersDetailedCharts
						platformSummary={platformSummary}
					/>
				);
				break;
			case "Financial":
				content = (
					<AdminReportsFinancialDetailedCharts
						{...{ platformSummary, monthlyFinancials }}
					/>
				);
				break;
			default:
				content = <p>No detailed view available for {section}</p>;
		}
		setPopupContent(content);
		setIsPopupOpen(true);
	};

	if (isLoading) return <LoadingSpinner text="Loading analytics..." />;

	if (error)
		return (
			<section className="admin-report-error-container">
				<p>Error: {error}</p>
			</section>
		);

	return (
		<main className="admin-report-main-container">
			<section className="admin-report-reports-grid">
				<article className="admin-report-summary-card">
					<header className="admin-report-card-header">
						<Calendar className="admin-report-header-icon" />
						<h2>Events Overview</h2>
					</header>
					<section className="admin-report-card-body">
						<AdminReportsKpiCard
							value={formatNumber(
								platformSummary?.totals?.events
							)}
							label="Total Events"
							icon={Calendar}
						/>
						<AdminReportsKpiCard
							value={
								platformSummary?.eventInsights?.guestStats?.avgGuestsPerEvent?.toFixed(
									1
								) ?? "0"
							}
							label="Avg Guests/Event"
							icon={Users}
						/>
						<AdminReportsKpiCard
							value={formatCurrency(
								platformSummary?.eventInsights?.budget
									?.avgBudgetPerEvent
							)}
							label="Avg Budget/Event"
							icon={DollarSign}
						/>
					</section>
					<footer className="admin-report-card-footer">
						<button onClick={() => handleExpandReports("Events")}>
							<BarIcon size={16} /> Expand Event Reports
						</button>
					</footer>
				</article>

				<article className="admin-report-summary-card">
					<header className="admin-report-card-header">
						<Users className="admin-report-header-icon" />
						<h2>Planners Overview</h2>
					</header>
					<section className="admin-report-card-body">
						<AdminReportsKpiCard
							value={formatNumber(
								platformSummary?.totals?.planners
							)}
							label="Total Planners"
							icon={Users}
						/>
						<AdminReportsKpiCard
							value={
								platformSummary?.plannerInsights?.avgEventsPerPlanner?.toFixed(
									1
								) ?? "0"
							}
							label="Avg Events/Planner"
							icon={Calendar}
						/>
						<AdminReportsKpiCard
							value={formatNumber(
								platformSummary?.totals?.guests
							)}
							label="Total Guests"
							icon={UserCheck}
						/>
					</section>
					<footer className="admin-report-card-footer">
						<button onClick={() => handleExpandReports("Planners")}>
							<BarIcon size={16} /> Expand Planner Reports
						</button>
					</footer>
				</article>

				<article className="admin-report-summary-card">
					<header className="admin-report-card-header">
						<Users className="admin-report-header-icon" />
						<h2>Vendors Overview</h2>
					</header>
					<section className="admin-report-card-body">
						<AdminReportsKpiCard
							value={formatNumber(
								platformSummary?.totals?.vendors
							)}
							label="Total Vendors"
							icon={Users}
						/>
						<AdminReportsKpiCard
							value={`${Math.round(
								(platformSummary?.vendorInsights
									?.vendorServiceRatio || 0) * 100
							)}%`}
							label="With Services"
							icon={UserCheck}
						/>
						<AdminReportsKpiCard
							value={formatNumber(
								platformSummary?.totals?.services
							)}
							label="Total Services"
							icon={Calendar}
						/>
					</section>
					<footer className="admin-report-card-footer">
						<button onClick={() => handleExpandReports("Vendors")}>
							<BarIcon size={16} /> Expand Vendor Reports
						</button>
					</footer>
				</article>

				<article className="admin-report-summary-card">
					<header className="admin-report-card-header">
						<DollarSign className="admin-report-header-icon" />
						<h2>Financial Overview</h2>
					</header>
					<section className="admin-report-card-body">
						<AdminReportsKpiCard
							value={formatCurrency(
								platformSummary?.eventInsights?.budget
									?.totalBudget
							)}
							label="Total Budget"
							icon={DollarSign}
						/>
						<AdminReportsKpiCard
							value={formatCurrency(
								platformSummary?.eventInsights?.budget
									?.totalNegotiatedSpend
							)}
							label="Total Spending"
							icon={DollarSign}
						/>
						<AdminReportsKpiCard
							value={formatCurrency(
								platformSummary?.eventInsights?.budget
									?.avgSpendPerEvent
							)}
							label="Avg Spend/Event"
							icon={DollarSign}
						/>
					</section>
					<footer className="admin-report-card-footer">
						<button
							onClick={() => handleExpandReports("Financial")}
						>
							<BarIcon size={16} /> Expand Financial Reports
						</button>
					</footer>
				</article>
			</section>

			<Popup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)}>
				<section className="admin-report-popup-content">
					<h2>{popupTitle}</h2>
					{popupContent}
				</section>
			</Popup>
		</main>
	);
};

export default AdminReports;
