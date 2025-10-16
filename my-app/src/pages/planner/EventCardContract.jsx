import { Calendar, FileText, Edit3, Download, Trash2 } from "lucide-react";
import React, {useCallback} from "react";

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

function EventCard({ eventData }) {

    const getContractStatusDisplay = useCallback((contract) => {
        if (!contract.signatureWorkflow?.isElectronic) {
            return { text: "Active", class: "active" };
        }

        const status = contract.signatureWorkflow.workflowStatus;

        switch (status) {
            case "draft":
                return { text: "Draft", class: "draft" };
            case "sent":
                return { text: "Pending Signature", class: "pending" };
            case "partially_signed":
                return { text: "Partially Signed", class: "partial" };
            case "completed":
                return { text: "Signed", class: "completed" };
            default:
                return { text: "Active", class: "active" };
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
