import { useTranslation } from 'react-i18next';
import './ResultsBadge.scss';

interface ResultsBadgeProps {
  /** Number of stores currently shown. */
  count: number;
}

/** Bordered pill showing the live result count, e.g. "10 BODEGAS". */
const ResultsBadge: React.FC<ResultsBadgeProps> = ({ count }) => {
  const { t } = useTranslation();
  return <span className="results-badge">{t('results.count', { count })}</span>;
};

export default ResultsBadge;
