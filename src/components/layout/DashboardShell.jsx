import useIncidentStore from '../../store/useIncidentStore';
import Sidebar from './Sidebar';
import DashboardView from '../dashboard/DashboardView';
import IncidentsPage from '../incidents/IncidentsPage';
import ResourcesPage from '../resources/ResourcesPage';

export default function DashboardShell() {
  const currentPage = useIncidentStore(s => s.currentPage);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        {currentPage === 'dashboard' && <DashboardView />}
        {currentPage === 'incidents' && <IncidentsPage />}
        {currentPage === 'resources' && <ResourcesPage />}
      </main>
    </div>
  );
}
