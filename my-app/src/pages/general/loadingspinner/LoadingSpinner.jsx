import React from "react";
import { Loader } from "lucide-react";
import "./LoadingSpinner.css";

/**
 * A container-based loading indicator. It will center itself within its parent container.
 * @param {object} props - The component props.
 * @param {string} [props.text="Loading..."] - The text to display below the spinner.
 */
const LoadingSpinner = ({ text = "Loading..." }) => {
	return (
		<div
			className="loading-spinner-container"
			role="status"
			aria-label={text}
		>
			<div className="loading-spinner-content">
				<Loader className="loading-spinner-icon" />
				<p className="loading-spinner-text">{text}</p>
			</div>
		</div>
	);
};

export default LoadingSpinner;
