// VendorModal.jsx
import { useState } from "react";
import { X, MapPin, Phone, Mail, Star, Clock, Users, Ruler } from "lucide-react";
import InformationToolTip from "../InformationToolTip";
import VendorHighlightDisplay from "../VendorHighlightDisplay";
import "./VendorDetails.css";

function VendorModal({ vendor, onClose, addService, onContactVendor }) {
  const [activeTab, setActiveTab] = useState("overview");

  const formatChargeType = (service) => {
    if (service.chargeByHour > 0) return "Per Hour";
    if (service.chargePerPerson > 0) return "Per Person";
    if (service.chargePerSquareMeter > 0) return "Per Square Meter";
    return "Fixed Rate";
  };

  const getChargeAmount = (service) => {
    if (service.chargeByHour > 0) return `R ${service.cost}`;
    if (service.chargePerPerson > 0) return `R ${service.chargePerPerson}`;
    if (service.chargePerSquareMeter > 0) return `R ${service.chargePerSquareMeter}`;
    return `R ${service.cost}`;
  };

  const getServiceIcon = (service) => {
    if (service.chargeByHour > 0) return <Clock size={16} />;
    if (service.chargePerPerson > 0) return <Users size={16} />;
    if (service.chargePerSquareMeter > 0) return <Ruler size={16} />;
    return null;
  };

  return (
    <section className="vendor-modal-overlay">
      <section
        data-testid="vendor-view-more-modal"
        className="vendor-modal-container"
      >
        {/* Header */}
        <section className="vendor-modal-header">
          <button
            onClick={onClose}
            className="vendor-modal-close-btn"
          >
            <X size={24} />
          </button>
          <section className="vendor-modal-header-info">
            <img
              src={vendor.profilePic}
              alt={vendor.businessName}
              className="vendor-modal-image"
            />
            <section className="vendor-modal-header-text">
              <h2 className="vendor-modal-business-name">
                {vendor.businessName}
              </h2>
              <p className="vendor-modal-category">
                {vendor.category}
              </p>
              <section className="vendor-modal-rating-location">
                <section className="vendor-modal-rating">
                  <Star size={16} fill="currentColor" />
                  {vendor.rating}
                </section>
                <section className="vendor-modal-location">
                  <MapPin size={14} />
                  <span>{vendor.location}</span>
                </section>
              </section>
            </section>
          </section>
        </section>

        {/* Tabs */}
        <section className="vendor-modal-tabs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`vendor-modal-tab ${
              activeTab === "overview" ? "active-tab" : ""
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`vendor-modal-tab ${
              activeTab === "services" ? "active-tab" : ""
            }`}
          >
            Services ({vendor.services?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("highlights")}
            className={`vendor-modal-tab ${
              activeTab === "highlights" ? "active-tab" : ""
            }`}
          >
            Highlights
          </button>
        </section>

        {/* Content */}
        <section className="vendor-modal-content">
          {activeTab === "overview" && (
            <section className="vendor-modal-overview">
              <h3>About {vendor.businessName}</h3>
              <p className="vendor-description">{vendor.description}</p>
              
              <h3>Contact Information</h3>
              <section className="vendor-modal-contact-grid">
                <section className="vendor-modal-contact-item">
                  <Phone size={18} />
                  <span>{vendor.phone}</span>
                </section>
                <section className="vendor-modal-contact-item">
                  <Mail size={18} />
                  <span>{vendor.email}</span>
                </section>
              </section>

              {vendor.services && vendor.services.length > 0 && (
                <>
                  <h3>Service Summary</h3>
                  <section className="vendor-service-summary">
                    <p>Offers {vendor.services.length} services including:</p>
                    <ul className="service-highlights">
                      {vendor.services.slice(0, 5).map((service, idx) => (
                        <li key={idx}>
                          {service.serviceName} - {getChargeAmount(service)} {formatChargeType(service)}
                        </li>
                      ))}
                      {vendor.services.length > 5 && (
                        <li>...and {vendor.services.length - 5} more</li>
                      )}
                    </ul>
                  </section>
                </>
              )}
            </section>
          )}

          {activeTab === "services" && (
            <section className="vendor-modal-services">
              {vendor.services?.map((service, idx) => (
                <section
                  key={idx}
                  className="vendor-modal-service-card"
                >
                  <section className="vendor-modal-service-header">
                    <div>
                      <h3>{service.serviceName}</h3>
                      <div className="service-type">
                        {getServiceIcon(service)}
                        <span>{formatChargeType(service)}</span>
                      </div>
                    </div>
                    <section className="vendor-modal-service-price">
                      <span className="price-amount">
                        {getChargeAmount(service)}
                      </span>
                    </section>
                  </section>
                  
                  {service.extraNotes && (
                    <p className="vendor-modal-service-notes">
                      {service.extraNotes}
                    </p>
                  )}
                  
                  <section className="vendor-modal-service-actions">
                    <InformationToolTip
                      content={
                        "Clicking this button will add this service to your event as pending. Contact and chat with the vendor to confirm this service."
                      }
                      top={"-20%"}
                      left={"275%"}
                      minWidth={"400px"}
                    >
                      <button
                        className="vendor-modal-footer-btn-primary"
                        onClick={() => addService(vendor, service)}
                      >
                        Track Service
                      </button>
                    </InformationToolTip>
                  </section>
                </section>
              ))}
            </section>
          )}

          {activeTab === "highlights" && (
            <VendorHighlightDisplay vendorId={vendor.id} />
          )}
        </section>

        {/* Footer */}
        <section className="vendor-modal-footer">
          <button
            onClick={onClose}
            className="vendor-modal-footer-btn"
          >
            Close
          </button>
          <button
            className="vendor-modal-footer-btn-primary"
            onClick={() => onContactVendor(vendor)}
          >
            Contact Vendor
          </button>
        </section>
      </section>
    </section>
  );
}

export default VendorModal;