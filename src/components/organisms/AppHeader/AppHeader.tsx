import { IonHeader, IonToolbar } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import './AppHeader.scss';

interface AppHeaderProps {
  /** Optional content pinned to the right of the toolbar (e.g. the results badge). */
  end?: React.ReactNode;
}

/** Global app header — the brand wordmark on a blue toolbar. Used by every page. */
const AppHeader: React.FC<AppHeaderProps> = ({ end }) => {
  const { t } = useTranslation();
  return (
    <IonHeader>
      <IonToolbar color="primary">
        <span className="app-title" slot="start">
          {t('app.title')}
        </span>
        {end && (
          <div className="app-header__end" slot="end">
            {end}
          </div>
        )}
      </IonToolbar>
    </IonHeader>
  );
};

export default AppHeader;
