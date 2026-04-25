import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardView from '../dashboard/DashboardView';
import IncidentsPage from '../incidents/IncidentsPage';
import ResourcesPage from '../resources/ResourcesPage';
import FloorPlanAdmin from '../dashboard/FloorPlanAdmin';

export default function DashboardShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route index element={<DashboardView />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="floorplan" element={<FloorPlanAdmin />} />
        </Routes>
      </main>
    </div>
  );
}

