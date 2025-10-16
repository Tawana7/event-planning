import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, FileText, X } from "lucide-react";
import { auth } from "../../firebase";
import "./PlannerContract.css";
import Popup from "../general/popup/Popup.jsx";
import PlannerSignatureView from "./PlannerSignatureView";
import { createSignatureDetailsDocument, getUserIPAddress} from "./PlannerSigAttch.js";
import BASE_URL from "../../apiConfig";
import EventCard from "./EventCardContract.jsx";

const useDebounce = (value, delay) => {
	const [debouncedValue, setDebouncedValue] = useState(value);
	useEffect(() => {
		const handler = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(handler);
	}, [value, delay]);
	return debouncedValue;
};

const PlannerContract = () => {
	const [contracts, setContracts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedContract, setSelectedContract] = useState(null);
	const [showSignModal, setShowSignModal] = useState(false);
	const [signatureData, setSignatureData] = useState({});
	const [isSaving, setIsSaving] = useState(false);
	const [saveStatus, setSaveStatus] = useState("");
	const debouncedSearchTerm = useDebounce(searchTerm, 300);

	const getAuthToken = async () => {
		if (!auth.currentUser) {
			throw new Error("User not authenticated");
		}
		return await auth.currentUser.getIdToken();
	};

	const fetchContracts = useCallback(async () => {
		if (!auth.currentUser) {
			setError("User not authenticated");
			setLoading(false);
			return;
		}

		try {
			const token = await getAuthToken();
			const response = await fetch(`${BASE_URL}/planner/contracts`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!response.ok) {
				throw new Error(
					`Failed to fetch contracts: ${response.status}`
				);
			}

			const data = await response.json();
			console.log("Fetched contracts:", data.contracts); // Debug log
			setContracts(data.contracts || []);
		} catch (err) {
			console.error("Error fetching contracts:", err);
			setError("Failed to load contracts: " + err.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const unsubscribe = auth.onAuthStateChanged(async (user) => {
			if (!user) {
				setError("User not authenticated");
				setLoading(false);
				return;
			}
			await fetchContracts();
		});
		return () => unsubscribe();
	}, [fetchContracts]);

	const dataURLtoBlob = (dataURL) => {
		const arr = dataURL.split(",");
		const mime = arr[0].match(/:(.*?);/)[1];
		const bstr = atob(arr[1]);
		let n = bstr.length;
		const u8arr = new Uint8Array(n);
		while (n--) {
			u8arr[n] = bstr.charCodeAt(n);
		}
		return new Blob([u8arr], { type: mime });
	};

	const uploadSignature = async (fieldId, dataURL, contractId, eventId) => {
		try {
			const token = await getAuthToken();
			const blob = dataURLtoBlob(dataURL);
			const formData = new FormData();
			formData.append("signature", blob, `${fieldId}.png`);

			const response = await fetch(
				`${BASE_URL}/planner/contracts/${eventId}/${contractId}/${fieldId}/signatures/upload`,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				}
			);

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.status}`);
			}

			const data = await response.json();
			return {
				url: data.downloadURL,
				metadata: {
					fieldId,
					signerId: auth.currentUser.uid,
					signerRole: "client",
					contractId,
					eventId,
					signatureUrl: data.downloadURL,
					signedAt: new Date().toISOString(),
					userAgent: navigator.userAgent,
				},
			};
		} catch (error) {
			console.error("Error uploading signature:", error);
			throw error;
		}
	};

	const saveDraftSignature = useCallback(
		async (signatureDataParam) => {
			if (
				!selectedContract ||
				Object.keys(signatureDataParam).length === 0
			) {
				setSaveStatus("No signatures to save");
				return;
			}

			setIsSaving(true);
			setSaveStatus("Saving draft...");

			try {
				const draftSignatures = {};

				for (const [fieldId, dataURL] of Object.entries(
					signatureDataParam
				)) {
					const savedSignature = await uploadSignature(
						fieldId,
						dataURL,
						selectedContract.id,
						selectedContract.eventId
					);
					draftSignatures[fieldId] = savedSignature;
				}

				const token = await getAuthToken();
				const response = await fetch(
					`${BASE_URL}/planner/contracts/${selectedContract.id}/signatures/draft`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							eventId: selectedContract.eventId,
							vendorId: selectedContract.vendorId,
							signatures: draftSignatures,
						}),
					}
				);

				if (!response.ok) {
					throw new Error(`Failed to save draft: ${response.status}`);
				}

				const result = await response.json();

				setContracts((prev) =>
					prev.map((c) =>
						c.id === selectedContract.id
							? {
									...c,
									signatureFields: result.signatureFields,
									draftSignatures,
									lastedited: {
										seconds: Math.floor(Date.now() / 1000),
									},
							  }
							: c
					)
				);

				setSaveStatus("Draft saved successfully!");
				setTimeout(() => setSaveStatus(""), 3000);
			} catch (error) {
				console.error("Error saving draft signature:", error);
				setSaveStatus(`Failed to save draft: ${error.message}`);
				setTimeout(() => setSaveStatus(""), 3000);
			} finally {
				setIsSaving(false);
			}
		},
		[selectedContract]
	);

	const sendSignedContract = async (signatureDataParam) => {
		if (!selectedContract) return;

		const requiredFields = selectedContract.signatureFields.filter(
			(f) => f.signerRole === "client" && f.required
		);
		const signedFieldIds = Object.keys(signatureDataParam);
		const missingRequired = requiredFields.filter(
			(f) => !signedFieldIds.includes(f.id)
		);

		if (missingRequired.length > 0) {
			alert(
				`Please sign all required fields: ${missingRequired
					.map((f) => f.label)
					.join(", ")}`
			);
			return;
		}

		setIsSaving(true);
		setSaveStatus("Finalizing signatures...");

		try {
			const finalSignatures = {};

			// Upload all signatures
			for (const [fieldId, dataURL] of Object.entries(
				signatureDataParam
			)) {
				const savedSignature = await uploadSignature(
					fieldId,
					dataURL,
					selectedContract.id,
					selectedContract.eventId
				);
				finalSignatures[fieldId] = savedSignature;
			}

			// Get IP address for audit trail
			const ipAddress = await getUserIPAddress();

			const signerInfo = {
				ipAddress: ipAddress,
				userAgent: navigator.userAgent,
				signedAt: new Date().toISOString(),
				signerName: selectedContract.clientName,
				signerEmail: selectedContract.clientEmail,
			};

			// Finalize the contract
			const token = await getAuthToken();
			const response = await fetch(
				`${BASE_URL}/planner/contracts/${selectedContract.id}/finalize`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						eventId: selectedContract.eventId,
						vendorId: selectedContract.vendorId,
						signatures: finalSignatures,
						signatureFields: selectedContract.signatureFields,
						signerInfo: signerInfo,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to finalize contract: ${response.status}`
				);
			}

			const result = await response.json();

			// Confirm services
			await fetch(
				`${BASE_URL}/planner/contracts/${selectedContract.id}/confirm-services`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						eventId: selectedContract.eventId,
						vendorId: selectedContract.vendorId,
					}),
				}
			);

			// Generate and download signature details document
			setSaveStatus("Generating signature certificate...");

			const signatureDoc = createSignatureDetailsDocument(
				selectedContract,
				signatureDataParam,
				signerInfo
			);

			// Auto-download the signature details HTML file
			signatureDoc.download();

			// Show success message with instructions
			setTimeout(() => {
				alert(
					`🎉 Contract signed successfully!\n\n` +
						`A signature details document has been downloaded.\n` +
						`You can print it to PDF and attach it to the contract:\n\n` +
						`1. Open the downloaded HTML file\n` +
						`2. Press Ctrl+P (or Cmd+P on Mac)\n` +
						`3. Select "Save as PDF"\n` +
						`4. Attach it to the original contract`
				);
			}, 500);

			// Update contracts list
			setContracts((prev) =>
				prev.map((c) =>
					c.id === selectedContract.id
						? { ...c, ...result.contract }
						: c
				)
			);

			setShowSignModal(false);
			setSelectedContract(null);
			setSignatureData({});
			setSaveStatus("");

			// Refresh contracts
			await fetchContracts();
		} catch (err) {
			console.error("Error finalizing contract:", err);
			alert(`Failed to finalize contract: ${err.message}`);
			setSaveStatus(`Failed to finalize: ${err.message}`);
		} finally {
			setIsSaving(false);
		}
	};

	const deleteContract = useCallback(
		async (eventId, contractId, contractUrl, vendorId) => {
			if (!auth.currentUser) {
				setError("User not authenticated");
				return;
			}

			const confirmDelete = window.confirm(
				"Are you sure you want to delete this contract? This action cannot be undone."
			);
			if (!confirmDelete) return;

			try {
				const token = await getAuthToken();
				const response = await fetch(
					`${BASE_URL}/planner/contracts/${contractId}?eventId=${eventId}&vendorId=${vendorId}&contractUrl=${encodeURIComponent(
						contractUrl
					)}`,
					{
						method: "DELETE",
						headers: { Authorization: `Bearer ${token}` },
					}
				);

				if (!response.ok) {
					throw new Error(
						`Failed to delete contract: ${response.status}`
					);
				}

				setContracts((prev) => prev.filter((c) => c.id !== contractId));
				setSaveStatus("Contract deleted successfully!");
				setTimeout(() => setSaveStatus(""), 5000);
			} catch (error) {
				console.error("Error deleting contract:", error);
				setError(`Failed to delete contract: ${error.message}`);
				setSaveStatus(`Failed to delete contract: ${error.message}`);
				setTimeout(() => setSaveStatus(""), 5000);
			}
		},
		[]
	);

	const loadDraftSignatures = useCallback((contract) => {
		if (contract.signatureFields) {
			const draftData = {};
			contract.signatureFields.forEach((field) => {
				if (field.draftSignature && !field.signed) {
					draftData[field.id] = field.draftSignature;
				}
			});
			setSignatureData(draftData);
		}
	}, []);

	// Helper function to check if contract is actually signed by client
	const isContractSignedByClient = useCallback((contract) => {
		// If no signature fields, it's not an e-signature contract
		if (
			!contract.signatureFields ||
			contract.signatureFields.length === 0
		) {
			return false;
		}

		// Check if all client signature fields are signed
		const clientFields = contract.signatureFields.filter(
			(field) => field.signerRole === "client"
		);

		// If no client fields, nothing to sign
		if (clientFields.length === 0) {
			return false;
		}

		// Check if all client fields are marked as signed
		const allClientFieldsSigned = clientFields.every(
			(field) => field.signed === true
		);

		// Also check workflow status
		const workflowCompleted =
			contract.signatureWorkflow?.workflowStatus === "completed";

		return allClientFieldsSigned && workflowCompleted;
	}, []);

	const groupedContracts = useMemo(() => {
		const groups = {};
		contracts.forEach((contract) => {
			if (!groups[contract.eventId]) {
				groups[contract.eventId] = {
					eventName: contract.eventName,
					eventDate: contract.eventDate,
					contracts: [],
				};
			}
			groups[contract.eventId].contracts.push(contract);
		});
		return groups;
	}, [contracts]);

const filteredEventIds = useMemo(() => {
    return Object.keys(groupedContracts).filter((eventId) => {
        const event = groupedContracts[eventId];
        const searchLower = debouncedSearchTerm.toLowerCase();
        
        // Search by event name or contracts within the event
        const eventNameMatch = event.eventName.toLowerCase().includes(searchLower);
        const contractMatch = event.contracts.some(contract => 
            contract.fileName.toLowerCase().includes(searchLower) ||
            contract.vendorName?.toLowerCase().includes(searchLower)
        );
        
        return eventNameMatch || contractMatch;
    });
}, [groupedContracts, debouncedSearchTerm]);

	const totalContracts = contracts.length;
	const pendingContracts = contracts.filter(
		(c) =>
			c.signatureWorkflow?.workflowStatus === "sent" ||
			c.signatureWorkflow?.workflowStatus === "partially_signed"
	).length;
	const signedContracts = contracts.filter((c) =>
		isContractSignedByClient(c)
	).length;

	const handleDownloadContract = (contractUrl, fileName) => {
		const link = document.createElement("a");
		link.href = contractUrl;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading) {
		return (
			<section className="loading-screen">
				<section className="spinner"></section>
				<p>Loading your contracts...</p>
			</section>
		);
	}

	if (error) {
		return <p className="error">{error}</p>;
	}

	if (contracts.length === 0) {
		return (
			<section className="events-page">
				<header>
					<h1>Contract Management</h1>
					<p>Manage vendor contracts for your events.</p>
				</header>
				<p className="no-events">No contracts found.</p>
			</section>
		);
	}

	return (
		<section className="contracts-page-planner-contract">
			<header>
				<h1>Contract Management</h1>
				<p>Manage vendor contracts for your events.</p>
				<section className="stats-summary">
					<section className="stat-item-planner-contract">
						<FileText size={20} />
						<span>Total Contracts: {totalContracts}</span>
					</section>
					<section className="stat-item-planner-contract pending-stat-planner-contract">
						<span>Pending Signatures: {pendingContracts}</span>
					</section>
					<section className="stat-item-planner-contract signed-stat-planner-contract">
						<span>Signed Contracts: {signedContracts}</span>
					</section>
				</section>
				<section className="search-container-planner-contract">
					<input
						type="text"
						placeholder="Search by event name..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="search-input-planner-contract"
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="clear-search"
						>
							<X size={16} />
						</button>
					)}
				</section>
			</header>
			<section className="events-section-planner-contract">
				<h2 className="section-title-planner-contract">
					<Calendar size={20} />
					Your Events ({filteredEventIds.length})
				</h2>
				<section className="events-list-planner-contract">
					{filteredEventIds.map((eventId) => (
						<EventCard
							key={eventId}
							eventId={eventId}
							eventData={groupedContracts[eventId]}
						/>
					))}
				</section>
			</section>
			{debouncedSearchTerm && filteredEventIds.length === 0 && (
				<section className="no-results">
					<p>No events found matching "{debouncedSearchTerm}"</p>
				</section>
			)}

			{/* Signature Modal */}
			<Popup
				isOpen={showSignModal}
				onClose={() => {
					setShowSignModal(false);
					setSelectedContract(null);
					setSignatureData({});
					setSaveStatus("");
				}}
			>
				{selectedContract && (
					<PlannerSignatureView
						contract={selectedContract}
						onFinalize={sendSignedContract}
						onSaveDraft={saveDraftSignature}
						onClose={() => {
							setShowSignModal(false);
							setSelectedContract(null);
							setSignatureData({});
							setSaveStatus("");
						}}
					/>
				)}
			</Popup>

			{/* Save Status Toast */}
			{saveStatus && (
				<div className="toast-notification">{saveStatus}</div>
			)}
		</section>
	);
};

export default PlannerContract;
