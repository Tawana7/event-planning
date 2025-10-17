import { Calendar, FileText, Edit3, Download, Trash2 } from "lucide-react";
import React from "react";

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

	if (date instanceof Date) {
		return date.toLocaleString();
	}

	if (typeof date === "string") {
		return new Date(date).toLocaleString();
	}

	return String(date);
}

function EventCard({ eventData, setSelectedContract, setShowSignModal,
	 setSignatureData, handleDownloadContract, deleteContract, getContractStatusDisplay,
	  isContractSignedByClient, loadDraftSignatures }) {

	return (
		<section className="event-card-planner-contract">
			<section className="event-info">
				<p>
					<FileText size={16} /> {eventData.eventName}
				</p>
				<p>
					<Calendar size={16} /> Date:{" "}
					{eventData.eventDate
						? formatDate(eventData.eventDate)
						: "No date"}
				</p>
			</section>
			<section className="contract-section">
				{eventData.contracts.length === 0 ? (
					<p>No contracts for this event.</p>
				) : (
					<section className="contracts-list">
						{eventData.contracts.map((contract) => {
							const isSigned = isContractSignedByClient(contract);
							const statusDisplay = getContractStatusDisplay(contract);

							return (
								<section key={contract.id} className="contract-row">
									<section className="contract-info">
										<p className="file-name">
											<button
												className="file-name-btn"
												onClick={() => {
													setSelectedContract(contract);
													loadDraftSignatures(contract);
													setShowSignModal(true);
												}}
												title="View and sign contract"
											>
												{contract.fileName}
											</button>
											<span>
												(
												{contract.lastedited?.seconds
													? new Date(
															contract.lastedited.seconds * 1000
													  ).toLocaleDateString()
													: "Unknown date"}
												)
											</span>
										</p>
										<span
											className={`status-badge-planner-contract status-${statusDisplay.class}`}
										>
											{statusDisplay.text}
										</span>
										{contract.signatureWorkflow?.isElectronic && (
											<span
												className={`signature-badge-planner-contract ${contract.signatureWorkflow.workflowStatus}`}
											>
												{contract.signatureWorkflow.workflowStatus.replace(
													"_",
													" "
												)}
											</span>
										)}
									</section>
									<section className="contract-actions">
										<button
											className="sign-btn"
											onClick={() => {
												setSelectedContract(contract);
												loadDraftSignatures(contract);
												setShowSignModal(true);
											}}
											title={
												isSigned
													? "Contract already signed"
													: "Sign contract"
											}
											disabled={isSigned}
										>
											<Edit3 size={12} />
											{isSigned ? "Signed" : "Sign"}
										</button>
										<button
											className="download-btn small"
											onClick={() =>
												handleDownloadContract(
													contract.contractUrl,
													contract.fileName
												)
											}
											title="Download contract"
										>
											<Download size={12} />
											Download
										</button>
										<button
											className="delete-btn small"
											onClick={() =>
												deleteContract(
													contract.eventId,
													contract.id,
													contract.contractUrl,
													contract.vendorId
												)
											}
											title="Delete contract"
										>
											<Trash2 size={12} />
											Delete
										</button>
									</section>
								</section>
							);
						})}
					</section>
				)}
			</section>
		</section>
	);
}

export default React.memo(EventCard);
