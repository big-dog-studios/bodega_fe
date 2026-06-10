import './FeatureBadge.scss';

interface FeatureBadgeProps {
  label: string;
  /** Filled (red) vs outlined treatment. */
  filled?: boolean;
}

/** Small feature tag shown on the store detail sheet (e.g. "HOT FOOD", "TOBACCO"). */
const FeatureBadge: React.FC<FeatureBadgeProps> = ({ label, filled = false }) => (
  <span className={`feature-badge${filled ? ' feature-badge--filled' : ''}`}>{label}</span>
);

export default FeatureBadge;
