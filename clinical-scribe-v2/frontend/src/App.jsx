import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import DoctorRoom from "./pages/DoctorRoom.jsx";
import PatientRoom from "./pages/PatientRoom.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/doctor/:roomId" element={<DoctorRoom />} />
        <Route path="/room/patient/:roomId" element={<PatientRoom />} />
      </Routes>
    </BrowserRouter>
  );
}
