import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Simulator from './pages/Simulator'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/simulator" element={<Simulator />} />
    </Routes>
  )
}

export default App
