import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Success from "./pages/Success";
import Docs from "./pages/Docs";
import Generate from "./pages/Generate";
import Recover from "./pages/Recover";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-14">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/success" element={<Success />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/recover" element={<Recover />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
