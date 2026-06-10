import './ResultsBadge.css';

interface ResultsBadgeProps {
  /** Number of stores currently shown. */
  count: number;
}

/** Bordered pill showing the live result count, e.g. "10 BODEGAS". */
const ResultsBadge: React.FC<ResultsBadgeProps> = ({ count }) => (
  <span className="results-badge">
    {count} {count === 1 ? 'BODEGA' : 'BODEGAS'}
  </span>
);

export default ResultsBadge;
