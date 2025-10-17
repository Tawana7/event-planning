import { MapPin} from "lucide-react";
import "./VendorCardMarket.css";
import placeholder from "../../../assets/elementor-placeholder-image.png";

function VendorCard({ vendor, onViewMore }) {
  // Calculate price range from services
  const getPriceRange = (services) => {
    if (!services || services.length === 0) return "No Services";
    
    const prices = services
      .map(service => {
        if (service.chargeByHour > 0) return service.cost;
        if (service.chargePerPerson > 0) return service.chargePerPerson;
        if (service.chargePerSquareMeter > 0) return service.chargePerSquareMeter;
        return service.cost;
      })
      .filter(price => price > 0);
    
    if (prices.length === 0) return "Contact for pricing";
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    return min === max ? `R ${min}` : `R ${min} - R ${max}`;
  };

  // Get top services (first 3)
  const topServices = vendor.services?.slice(0, 3) || [];

  return (
    <article data-testid="vendor-card" className="vendor-card-market">
        <section className="vendor-content">
            <section className="vendor-cardmarket-left">
                <img
                    src={vendor.profilePic || placeholder}
                    alt={vendor.businessName}
                    className="vendor-image"
                />
                <section className="vendor-details">
                    <h3 className="vendor-name">{vendor.businessName}</h3>
                    <span className="vendor-category">{vendor.category}</span>
                    <section className="vendor-meta">
                        <span className="vendor-location">
                        <MapPin size={14} />
                        {vendor.location}
                        </span>
                    </section>
                </section>
                <button
                    className="btn-viewmore-market"
                    onClick={() => onViewMore(vendor)}
                >
                    View Details
                </button>
            </section>
            <section className="vendor-cardmarket-right">       
                <section className="vendor-summary">
                    <div className="vendor-price-range">
                        <strong>{getPriceRange(vendor.services)}</strong>
                    </div>
                    
                    {vendor.services && vendor.services.length > 0 ? (
                        <div className="vendor-services-preview">
                        <p className="services-label-market">Services offered:</p>
                        <ul className="services-list-market">
                            {topServices.map((service, index) => (
                            <li key={index} className="service-item-market">
                                <span className="service-name-market">{service.serviceName}</span>
                                <span className="service-price-market">
                                {service.chargeByHour > 0 ? "Per hour" : 
                                service.chargePerPerson > 0 ? "Per person" : 
                                service.chargePerSquareMeter > 0 ? "Per m²" : 
                                "Fixed rate"}
                                </span>
                            </li>
                            ))}
                        </ul>
                        {vendor.services.length > 3 && (
                            <p className="more-services">
                            +{vendor.services.length - 3} more services
                            </p>
                        )}
                        </div>
                    ) : (
                        <p className="vendor-no-services">No services listed yet</p>
                    )}
                    
                    {vendor.description && (
                        <p className="vendor-description-preview">
                        {vendor.description}
                        </p>
                    )}
                </section>
                
                <section className="vendor-actions">
                    {/* Empty but kept for structure */}
                </section>
            </section>
        </section>
    </article>
  );
}

export default VendorCard;