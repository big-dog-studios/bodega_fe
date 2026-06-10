import './BodegaPin.scss';

interface BodegaPinProps {
  /** Single character shown in the pin (e.g. the store's first initial). */
  label?: string;
  /** Selected state — red fill, larger, animated. */
  selected?: boolean;
}

/** Square brand marker for a store on the map — blue tile, orange border, letter. */
const BodegaPin: React.FC<BodegaPinProps> = ({ label = 'B', selected = false }) => (
  <div className={`bodega-pin${selected ? ' bodega-pin--selected' : ''}`}>{label}</div>
);

export default BodegaPin;
