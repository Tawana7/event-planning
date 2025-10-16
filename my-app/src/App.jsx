import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";

//main pages imports
import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import OutsideLogin from "./pages/OutsideLogin.jsx";

//planner pages imports
import PlannerApp from "./pages/planner/PlannerApp.jsx";
import PlannerDashboard from "./pages/planner/PlannerDashboard.jsx";
import PlannerContract from "./pages/planner/PlannerContract.jsx";
import NewEvent from "./pages/planner/NewEvent.jsx";
import PlannerRSVP from "./pages/planner/PlannerRSVP.jsx";

//vendor pages imports
import VendorProfile from "./pages/vendor/vendorProfile.jsx";
import VendorApply from "./pages/vendor/vendorApply.jsx";
import VendorWaiting from "./pages/vendor/VendorWaiting.jsx";
import VendorApp from "./pages/vendor/vendorApp.jsx";
import VendorProfileEdit from "./pages/vendor/vendorProfileEdit.jsx";
import VendorHighlights from "./pages/vendor/vendorHighlights/VendorHighlights";

//admin page imports
import Admin from "./pages/admin/Admin.jsx";
import AdminGate from "./pages/admin/AdminGate.jsx";
import AdminPlannerManagement from "./pages/admin/adminPlannerManagement/AdminPlannerManagement.jsx";
import AdminEventManagement from "./pages/admin/adminEventManagement/AdminEventManagement.jsx";
import AdminVendorManagement from "./pages/admin/adminVendorManagement/AdminVendorManagement.jsx";
import AdminReports from "./pages/admin/adminReportsAndAnalytics/AdminReports.jsx";
import AdminVendorApplications from "./pages/admin/adminVendorManagement/AdminVendorApplications.jsx";
import AdminCreateProfile from "./pages/admin/adminProfile/AdminCreateProfile.jsx";
import AdminProfile from "./pages/admin/adminProfile/AdminProfile.jsx";

function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/signup" element={<Signup />} />
				<Route path="/login" element={<Login />} />
				<Route path="/outsidelogin" element={<OutsideLogin />} />
				<Route path="/home" element={<Home />} />
				<Route path="/planner-dashboard" element={<PlannerApp />} />
				<Route
					path="/planner-dashboard"
					element={<PlannerDashboard />}
				/>
				<Route path="/planner/new-event" element={<NewEvent />} />
				<Route
					path="/planner/rsvp/:eventId/:guestToken/accept"
					element={<PlannerRSVP />}
				/>
				<Route
					path="/planner/rsvp/:eventId/:guestToken/decline"
					element={<PlannerRSVP />}
				/>
				'
				<Route path="/vendor-app" element={<VendorApp />} />
				<Route
					path="/vendor/vendor-dashboard"
					element={<VendorProfile />}
				/>
				<Route
					path="/vendor/vendor-edit-profile"
					element={<VendorProfileEdit />}
				/>
				<Route
					path="/vendor/vendor-profile"
					element={<VendorProfile />}
				/>
				<Route path="/vendor/vendor-apply" element={<VendorApply />} />
				<Route path="/vendor-app" element={<VendorApp />} />
				<Route
					path="/vendor/vendor-dashboard"
					element={<VendorProfile />}
				/>
				<Route
					path="/vendor/vendor-edit-profile"
					element={<VendorProfileEdit />}
				/>
				<Route
					path="/vendor/vendor-profile"
					element={<VendorProfile />}
				/>
				<Route path="/vendor/vendor-apply" element={<VendorApply />} />
				<Route path="/planner/new-event" element={<NewEvent />} />
				<Route path="/vendor/waiting" element={<VendorWaiting />} />
				<Route
					path="/planner/contracts"
					element={<PlannerContract />}
				/>
				<Route
					path="/vendor/highlights"
					element={<VendorHighlights />}
				/>
				{/*Admin Routes*/}
				<Route path="/admin" element={<AdminGate />} />
				<Route path="/admin/*" element={<Admin />} />
				<Route
					path="/admin-create-profile"
					element={<AdminCreateProfile />}
				/>
				<Route path="/admin/my-profile" element={<AdminProfile />} />
				<Route
					path="/admin/planner-management"
					element={<AdminPlannerManagement />}
				/>
				<Route
					path="/admin/event-management"
					element={<AdminEventManagement />}
				/>
				<Route
					path="/admin/vendor-management"
					element={<AdminVendorManagement />}
				/>
				<Route path="/admin/reports" element={<AdminReports />} />
				<Route
					path="/admin/vendor-applications"
					element={<AdminVendorApplications />}
				/>
			</Routes>
		</Router>
	);
}

export default App;
