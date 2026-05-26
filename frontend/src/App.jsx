import { Routes, Route } from "react-router-dom";
import CreateRoom from "./pages/CreateRoom.jsx";
import DoctorRoom from "./pages/DoctorRoom.jsx";
import PatientRoom from "./pages/PatientRoom.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateRoom />} />
      <Route path="/doctor/:roomId" element={<DoctorRoom />} />
      <Route path="/patient/:roomId" element={<PatientRoom />} />
    </Routes>
  );
}
