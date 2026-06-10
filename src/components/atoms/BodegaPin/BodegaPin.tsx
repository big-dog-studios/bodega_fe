import './BodegaPin.scss';

interface BodegaPinProps {
  /** Single character shown in the pin (e.g. the store's first initial). */
  label?: string;
}

/** Square brand marker for a store on the map — blue tile, orange border, letter. */
const BodegaPin: React.FC<BodegaPinProps> = ({ label = 'B' }) => (
  <div className="bodega-pin">{label}</div>
);

export default BodegaPin;
